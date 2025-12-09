import React, { useState, useRef, useEffect } from 'react';
import { aiClient, CHAT_MODEL } from '../services/ai';
import { ChatMessage } from '../types';
import { GenerateContentResponse } from '@google/genai';

const TextTutor: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize chat logic
  const chatSession = useRef(aiClient.chats.create({
    model: CHAT_MODEL,
    config: {
      systemInstruction: `You are an expert English tutor. When the user sends a message:
      1. Analyze it for grammatical, spelling, or stylistic errors.
      2. If there are errors, start your response with a section marked "**Correction:**" containing the corrected sentence and a brief explanation.
      3. If the English is perfect, start with "**Excellent!**" 
      4. Then, continue the conversation naturally in a new paragraph or section.
      Keep the tone encouraging and helpful.`,
    }
  }));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const resultStream = await chatSession.current.sendMessageStream({ message: userMsg.text });
      
      const botMsgId = (Date.now() + 1).toString();
      let fullText = '';
      
      // Temporary message placeholder
      setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: '' }]);

      for await (const chunk of resultStream) {
        const c = chunk as GenerateContentResponse;
        const text = c.text;
        if (text) {
          fullText += text;
          setMessages(prev => 
            prev.map(msg => msg.id === botMsgId ? { ...msg, text: fullText } : msg)
          );
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        text: "I'm sorry, I encountered an error connecting to the service. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Helper to render message content with specific formatting for corrections
  const renderMessageContent = (text: string) => {
    // Check for "Correction:" pattern to style it differently
    const parts = text.split(/(\*\*Correction:\*\*|\*\*Excellent!\*\*)/g);
    
    if (parts.length > 1) {
      return (
        <div>
          {parts.map((part, index) => {
            if (part === '**Correction:**') {
              return <span key={index} className="block font-bold text-amber-600 mb-1">Correction:</span>;
            }
            if (part === '**Excellent!**') {
              return <span key={index} className="block font-bold text-green-600 mb-1">Excellent!</span>;
            }
            return <span key={index}>{part}</span>;
          })}
        </div>
      );
    }
    return <p>{text}</p>;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 max-w-4xl mx-auto shadow-2xl overflow-hidden md:rounded-b-xl">
      <div className="bg-white p-4 border-b border-gray-200 flex justify-between items-center">
        <div>
           <h2 className="text-lg font-bold text-gray-800">Chat & Correct</h2>
           <p className="text-xs text-gray-500">I'll correct your grammar as we chat.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <p>Start chatting to practice your writing!</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-primary text-white rounded-br-none' 
                  : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
              }`}
            >
              {msg.role === 'model' ? renderMessageContent(msg.text) : msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-gray-100 flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
            className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`p-3 rounded-full text-white transition-all transform hover:scale-105 active:scale-95 ${
              !input.trim() || isLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-primary hover:bg-indigo-700 shadow-md'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextTutor;