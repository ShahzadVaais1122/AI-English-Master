import { Blob } from '@google/genai';

/**
 * Converts a Float32Array of audio data into the specific Blob format required by Gemini Live API.
 * The API expects raw PCM 16-bit integers.
 */
export function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Convert float (-1.0 to 1.0) to int16 (-32768 to 32767)
    int16[i] = data[i] * 32768;
  }
  return {
    data: encodeBase64(new Uint8Array(int16.buffer)),
    // The supported audio MIME type is 'audio/pcm'.
    mimeType: 'audio/pcm;rate=16000',
  };
}

/**
 * Decodes a base64 string manually to a Uint8Array.
 * Do not use window.atob directly for large streams in all environments, 
 * but for this web context, we implement a robust manual decoder if needed, 
 * or wrap standard methods.
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes a Uint8Array to a base64 string.
 */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes raw PCM data (Int16) received from the API into an AudioBuffer 
 * that the browser's AudioContext can play.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert int16 back to float (-1.0 to 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
