import React from 'react';
import { AppMode } from '../types';

interface HeaderProps {
  currentMode: AppMode;
  onNavigate: (mode: AppMode) => void;
}

const Header: React.FC<HeaderProps> = ({ currentMode, onNavigate }) => {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => onNavigate(AppMode.HOME)}>
            <div className="bg-primary rounded-lg p-2 mr-2">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <span className="font-bold text-xl text-gray-900">FluentFlow</span>
          </div>
          <nav className="flex space-x-4">
            {currentMode !== AppMode.HOME && (
              <button 
                onClick={() => onNavigate(AppMode.HOME)}
                className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Exit Session
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;