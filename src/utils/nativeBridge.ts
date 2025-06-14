// src/utils/nativeBridge.ts
import { registerPlugin } from './capacitorUtils';

// Define base plugin interface
interface Plugin {
  addListener(eventName: string, listenerFunc: (...args: any[]) => void): Promise<any>;
  removeAllListeners(): Promise<void>;
}

// Define plugin interfaces
interface NativeAudioPlugin extends Plugin {
  startRecording(options: { usePTT: boolean }): Promise<void>;
  stopRecording(): Promise<void>;
  transmitAudio(options: { audioData: string }): Promise<void>;
}

interface MeshNetworkingPlugin extends Plugin {
  joinMesh(): Promise<void>;
  getConnectedPeers(): Promise<{ peers: string[] }>;
  sendEmergencyBeacon(): Promise<void>;
}

// Register plugins using custom function
const NativeAudio = registerPlugin<NativeAudioPlugin>('NativeAudio');
const MeshNetworking = registerPlugin<MeshNetworkingPlugin>('MeshNetworking');

// Audio bridge implementation
export const audioBridge = {
  startRecording: async (usePTT = true) => {
    try {
      await NativeAudio.startRecording({ usePTT });
    } catch (error) {
      console.error('Native audio recording failed:', error);
      startWebAudioCapture();
    }
  },

  stopRecording: async () => {
    try {
      await NativeAudio.stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  },

  transmitAudio: async (audioData: ArrayBuffer) => {
    try {
      // Convert to base64 for efficient transfer
      const base64Data = arrayBufferToBase64(audioData);
      await NativeAudio.transmitAudio({ audioData: base64Data });
    } catch (error) {
      console.error('Audio transmission failed:', error);
    }
  }
};

// Mesh networking bridge
export const meshBridge = {
  joinMesh: async () => {
    try {
      await MeshNetworking.joinMesh();
    } catch (error) {
      console.error('Mesh join failed:', error);
      initializeWebSocketMesh();
    }
  },

  getConnectedPeers: async () => {
    try {
      const result = await MeshNetworking.getConnectedPeers();
      return result.peers;
    } catch (error) {
      console.error('Peer fetch failed:', error);
      return [];
    }
  },

  sendEmergencyBeacon: async () => {
    try {
      await MeshNetworking.sendEmergencyBeacon();
    } catch (error) {
      console.error('Emergency beacon failed:', error);
    }
  }
};

// Utility functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Fallback implementations
function startWebAudioCapture() {
  console.warn('Using Web Audio fallback');
  // Implement browser-based audio capture
}

function initializeWebSocketMesh() {
  console.warn('Using WebSocket mesh fallback');
  // Implement pure-JS mesh networking
}

// Mock implementations for browser development
if (typeof window !== 'undefined') {
  const mockNativeAudio = {
    startRecording: () => new Promise<void>(resolve => {
      console.log('[MOCK] Native audio recording started');
      resolve();
    }),
    stopRecording: () => new Promise<void>(resolve => {
      console.log('[MOCK] Native audio recording stopped');
      resolve();
    }),
    transmitAudio: () => new Promise<void>(resolve => {
      console.log('[MOCK] Audio transmitted');
      resolve();
    })
  };

  const mockMeshNetworking = {
    joinMesh: () => new Promise<void>(resolve => {
      console.log('[MOCK] Joined mesh network');
      resolve();
    }),
    getConnectedPeers: () => new Promise<{ peers: string[] }>(resolve => {
      resolve({ peers: ['mock-peer-1', 'mock-peer-2'] });
    }),
    sendEmergencyBeacon: () => new Promise<void>(resolve => {
      console.log('[MOCK] Emergency beacon sent');
      resolve();
    })
  };

  Object.assign(NativeAudio, mockNativeAudio);
  Object.assign(MeshNetworking, mockMeshNetworking);
}
