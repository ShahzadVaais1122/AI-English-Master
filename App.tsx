import React, { useState } from 'react';
import Header from './components/Header';
import LiveTutor from './components/LiveTutor';
import TextTutor from './components/TextTutor';
import { AppMode } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);

  const renderContent = () => {
    switch (mode) {
      case AppMode.LIVE_AUDIO:
        return <LiveTutor />;
      case AppMode.TEXT_CHAT:
        return <TextTutor />;
      case AppMode.HOME:
      default:
        return (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center mb-16">
              <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
                Master English with <span className="text-primary">AI</span>
              </h1>
              <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500">
                Choose your preferred way to learn. Speak naturally with our AI tutor or improve your writing through interactive chat.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 max-w-4xl mx-auto">
              {/* Card 1: Live Audio */}
              <div 
                onClick={() => setMode(AppMode.LIVE_AUDIO)}
                className="group relative bg-white rounded-2xl shadow-sm hover:shadow-2xl border border-gray-100 p-8 cursor-pointer transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="absolute top-0 right-0 -mt-4 -mr-4 bg-secondary text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  NEW
                </div>
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-indigo-100 text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Voice Conversation</h3>
                <p className="text-gray-500 mb-4">
                  Practice speaking in real-time. The AI listens to your pronunciation and grammar, correcting you gently as you speak.
                </p>
                <span className="text-primary font-medium group-hover:text-indigo-700 flex items-center">
                  Start Speaking 
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </div>

              {/* Card 2: Text Chat */}
              <div 
                onClick={() => setMode(AppMode.TEXT_CHAT)}
                className="group bg-white rounded-2xl shadow-sm hover:shadow-2xl border border-gray-100 p-8 cursor-pointer transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-secondary mb-6 group-hover:bg-secondary group-hover:text-white transition-colors">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Text Chat</h3>
                <p className="text-gray-500 mb-4">
                  Write to the AI. It will analyze your sentences for errors, provide corrected versions, and reply naturally.
                </p>
                <span className="text-secondary font-medium group-hover:text-green-700 flex items-center">
                  Start Chatting
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </div>
            </div>
            
            <div className="mt-20 border-t border-gray-200 pt-10 text-center">
              <p className="text-gray-400">Powered by Google Gemini 2.5 Flash</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header currentMode={mode} onNavigate={setMode} />
      <main>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;