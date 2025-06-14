// src/utils/capacitorUtils.ts
import type { Plugin } from '@capacitor/core';

// Define the registerPlugin function explicitly
export const registerPlugin = <T extends Plugin>(pluginName: string) => {
  try {
    // Try Capacitor's native implementation
    const { Plugins } = require('@capacitor/core');
    return Plugins[pluginName] as T;
  } catch {
    try {
      // Try modern Capacitor 5+ export
      const { registerPlugin: coreRegisterPlugin } = require('@capacitor/core');
      return coreRegisterPlugin<T>(pluginName);
    } catch {
      // Fallback to mock implementation
      return {
        addListener: () => ({ remove: () => {} }),
        startRecording: () => Promise.resolve(),
        stopRecording: () => Promise.resolve(),
        transmitAudio: () => Promise.resolve(),
        joinMesh: () => Promise.resolve(),
        getConnectedPeers: () => Promise.resolve({ peers: [] }),
        sendEmergencyBeacon: () => Promise.resolve(),
      } as unknown as T;
    }
  }
};