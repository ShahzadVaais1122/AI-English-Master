import { Modality } from "@google/genai";

export enum AppMode {
  HOME = 'HOME',
  LIVE_AUDIO = 'LIVE_AUDIO',
  TEXT_CHAT = 'TEXT_CHAT'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isCorrection?: boolean;
  correctionDetail?: string; // If the model provides specific grammar feedback
}

// Audio Types
export interface AudioConfig {
  sampleRate: number;
}

export interface LiveSessionState {
  isConnected: boolean;
  isSpeaking: boolean;
  error: string | null;
  volume: number;
}
