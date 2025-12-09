import { GoogleGenAI } from "@google/genai";

// Ensure API key is present
if (!process.env.API_KEY) {
  console.error("Missing API_KEY in environment variables.");
}

export const aiClient = new GoogleGenAI({ 
  apiKey: process.env.API_KEY || '' 
});

export const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
export const CHAT_MODEL = 'gemini-2.5-flash';
