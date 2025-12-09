import React, { useEffect, useRef, useState, useCallback } from 'react';
import { aiClient, LIVE_MODEL } from '../services/ai';
import { createPcmBlob, decodeBase64, decodeAudioData } from '../utils/audio';
import { LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';

// Define the tool for pronunciation feedback
const pronunciationTipTool: FunctionDeclaration = {
  name: "showPronunciationTip",
  parameters: {
    type: Type.OBJECT,
    description: "Display a visual tip for a specific word the user mispronounced.",
    properties: {
      word: {
        type: Type.STRING,
        description: "The word that was mispronounced.",
      },
      tip: {
        type: Type.STRING,
        description: "A concise, actionable tip on how to pronounce it (e.g., 'Tongue between teeth', 'Long E sound').",
      },
      phonetic: {
        type: Type.STRING,
        description: "Simple phonetic spelling if helpful (optional).",
      }
    },
    required: ["word", "tip"],
  },
};

interface PronunciationTip {
  word: string;
  tip: string;
  phonetic?: string;
}

const LiveTutor: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [userTranscript, setUserTranscript] = useState<string>(''); 
  const [aiTranscript, setAiTranscript] = useState<string>('');
  const [currentTip, setCurrentTip] = useState<PronunciationTip | null>(null);

  // Refs for audio handling to avoid re-renders
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const tipTimeoutRef = useRef<number | null>(null);

  const SYSTEM_INSTRUCTION = `You are an encouraging and patient English pronunciation tutor. 
  Your goal is to have a natural spoken conversation with the user to help them practice. 
  
  CRITICAL INSTRUCTIONS FOR FEEDBACK:
  1. Listen carefully to the user's pronunciation and grammar.
  2. If the user makes a pronunciation mistake, GENTLY correct them. 
  3. WHENEVER you correct a pronunciation, you MUST use the 'showPronunciationTip' tool to display the word and a specific tip on the user's screen.
  4. Explain the correction verbally as well (e.g., "I noticed you said 'sink' for 'think'. Try putting your tongue between your teeth.").
  5. If the user speaks well, continue the conversation naturally.
  6. Keep your verbal responses concise (under 40 words usually) to keep the flow.`;

  // Visualization loop
  const drawVisualizer = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Simple ripple effect based on volume/activity
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const baseRadius = 40;
    
    // If AI is speaking, use a different color
    ctx.fillStyle = aiSpeaking ? 'rgba(79, 70, 229, 0.2)' : 'rgba(16, 185, 129, 0.2)';
    
    // Animate radius based on volume (simulated for now or passed from processor)
    const pulse = (Date.now() / 1000) * 5;
    const scale = isConnected ? 1 + Math.sin(pulse) * 0.1 + (volume * 2) : 1;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * scale, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = aiSpeaking ? '#4F46E5' : (isConnected ? '#10B981' : '#9CA3AF');
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 0.8, 0, 2 * Math.PI);
    ctx.fill();

    animationFrameRef.current = requestAnimationFrame(drawVisualizer);
  };

  useEffect(() => {
    drawVisualizer();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isConnected, volume, aiSpeaking]);


  const startSession = async () => {
    setStatus('connecting');
    setErrorMessage(null);
    setUserTranscript('');
    setAiTranscript('');
    setCurrentTip(null);

    try {
      // 1. Setup Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      outputContextRef.current = new AudioContextClass({ sampleRate: 24000 });

      // 2. Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 3. Setup Output Node
      const outputNode = outputContextRef.current.createGain();
      outputNode.connect(outputContextRef.current.destination);

      // 4. Initialize Gemini Live Session
      const sessionPromise = aiClient.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          inputAudioTranscription: {}, // To see what AI heard
          outputAudioTranscription: {}, // To show what AI is saying
          tools: [{ functionDeclarations: [pronunciationTipTool] }],
        },
        callbacks: {
          onopen: () => {
            console.log("Session opened");
            setStatus('active');
            setIsConnected(true);

            // Connect Mic to Processor
            if (!inputContextRef.current) return;
            const source = inputContextRef.current.createMediaStreamSource(stream);
            sourceRef.current = source;
            
            // ScriptProcessor for raw PCM capture
            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Simple volume calculation for visualizer
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(rms);

              const pcmBlob = createPcmBlob(inputData);
              
              // Send data
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Transcription (User)
            if (message.serverContent?.inputTranscription?.text) {
               setUserTranscript(message.serverContent.inputTranscription.text);
            }

            // Handle Transcription (AI)
            if (message.serverContent?.outputTranscription?.text) {
              setAiTranscript(prev => prev + message.serverContent.outputTranscription.text);
            }
            if (message.serverContent?.turnComplete) {
               // Optional: clear transcripts on turn complete or keep them
               // We'll keep them to form a running log if we wanted, but for now just current turn
               setAiTranscript(''); 
            }
            
            // Handle Tool Calls (Pronunciation Tips)
            if (message.toolCall) {
              const calls = message.toolCall.functionCalls;
              if (calls && calls.length > 0) {
                 calls.forEach(call => {
                    if (call.name === 'showPronunciationTip') {
                       const args = call.args as unknown as PronunciationTip;
                       console.log("Tip received:", args);
                       setCurrentTip(args);
                       
                       // Clear tip after 8 seconds
                       if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);
                       tipTimeoutRef.current = window.setTimeout(() => setCurrentTip(null), 8000);
                    }
                 });

                 // Send response back to acknowledge tool execution
                 sessionPromise.then(session => {
                    session.sendToolResponse({
                       functionResponses: calls.map(c => ({
                          id: c.id,
                          name: c.name,
                          response: { result: "OK" }
                       }))
                    });
                 });
              }
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setAiSpeaking(true);
              if (!outputContextRef.current) return;

              // Ensure timing
              nextStartTimeRef.current = Math.max(
                nextStartTimeRef.current,
                outputContextRef.current.currentTime
              );

              const audioBuffer = await decodeAudioData(
                decodeBase64(base64Audio),
                outputContextRef.current,
                24000,
                1
              );

              const source = outputContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              
              source.onended = () => {
                audioSourcesRef.current.delete(source);
                if (audioSourcesRef.current.size === 0) {
                  setAiSpeaking(false);
                }
              };

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioSourcesRef.current.add(source);
            }

            // Handle Interruptions
            if (message.serverContent?.interrupted) {
              audioSourcesRef.current.forEach(src => src.stop());
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setAiSpeaking(false);
              setAiTranscript('');
            }
          },
          onclose: () => {
            console.log("Session closed");
            stopSession();
          },
          onerror: (e) => {
            console.error("Session error", e);
            setErrorMessage("Connection error. Please try again.");
            stopSession();
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (err) {
      console.error("Failed to start session", err);
      setErrorMessage("Could not access microphone or connect.");
      setStatus('error');
    }
  };

  const stopSession = useCallback(() => {
    setIsConnected(false);
    setStatus('idle');
    setAiSpeaking(false);
    if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);

    // Stop Mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Disconnect Audio Nodes
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close Contexts
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }

    // Close Session
    if (sessionPromiseRef.current) {
       sessionPromiseRef.current.then(session => {
          try {
             session.close();
          } catch(e) {
             console.warn("Error closing session explicitly:", e);
          }
       });
       sessionPromiseRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center border border-gray-100 relative overflow-hidden">
        
        {/* Pronunciation Tip Overlay */}
        {currentTip && (
          <div className="absolute top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-200 p-4 z-20 animate-slide-down shadow-md">
             <div className="flex items-start">
                <div className="flex-shrink-0 bg-yellow-400 rounded-full p-1 mr-3">
                   <svg className="w-5 h-5 text-yellow-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="text-left">
                   <h4 className="font-bold text-yellow-800 text-lg">Pronunciation Tip</h4>
                   <p className="text-yellow-900 font-medium text-xl mt-1">"{currentTip.word}"</p>
                   {currentTip.phonetic && <p className="text-gray-500 text-sm font-mono">/{currentTip.phonetic}/</p>}
                   <p className="text-yellow-800 text-sm mt-1">{currentTip.tip}</p>
                </div>
                <button 
                  onClick={() => setCurrentTip(null)}
                  className="ml-auto text-yellow-700 hover:text-yellow-900"
                >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
          </div>
        )}

        <h2 className="text-2xl font-bold text-gray-800 mb-6 mt-2">Live Speaking Practice</h2>
        
        <div className="relative h-64 w-full flex items-center justify-center bg-gray-50 rounded-2xl mb-8 overflow-hidden border border-gray-100">
          <canvas 
            ref={canvasRef} 
            width={300} 
            height={300}
            className="absolute top-0 left-0 w-full h-full"
          />
          <div className="z-10 flex flex-col items-center pointer-events-none">
             {status === 'active' && (
                <div className={`text-3xl font-bold transition-all duration-300 ${aiSpeaking ? 'text-primary scale-110' : 'text-gray-400'}`}>
                  {aiSpeaking ? 'Listening to AI...' : 'Your Turn'}
                </div>
             )}
             {status === 'idle' && <div className="text-gray-400 text-lg">Ready to start?</div>}
             {status === 'connecting' && <div className="text-primary text-lg animate-pulse">Connecting...</div>}
          </div>
        </div>

        {/* Captions Area */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100 min-h-[5rem] max-h-32 overflow-y-auto flex flex-col justify-end text-left">
            {userTranscript && (
               <p className="text-sm text-gray-500 mb-1">
                 <span className="font-bold text-gray-400">You:</span> {userTranscript}
               </p>
            )}
            {aiTranscript && (
               <p className="text-sm text-indigo-600 font-medium animate-pulse">
                  <span className="font-bold text-indigo-400">AI:</span> {aiTranscript}
               </p>
            )}
            {!userTranscript && !aiTranscript && (
               <p className="text-sm text-gray-300 italic text-center">Conversation text will appear here...</p>
            )}
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        <div className="flex justify-center">
          {!isConnected ? (
            <button
              onClick={startSession}
              disabled={status === 'connecting'}
              className="group relative flex items-center justify-center py-3 px-8 border border-transparent text-lg font-medium rounded-full text-white bg-primary hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-lg transition-all transform hover:scale-105"
            >
               <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
               Start Conversation
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="group relative flex items-center justify-center py-3 px-8 border border-transparent text-lg font-medium rounded-full text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-lg transition-all transform hover:scale-105"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              End Session
            </button>
          )}
        </div>
        
        <p className="mt-6 text-xs text-gray-400">
           Tip: Try mispronouncing a word to test the AI's feedback!
        </p>
      </div>
    </div>
  );
};

export default LiveTutor;