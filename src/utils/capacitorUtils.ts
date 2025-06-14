
// src/utils/capacitorUtils.ts

// Define the Plugin interface
export interface Plugin {
  addListener(eventName: string, listenerFunc: (...args: any[]) => void): Promise<any>;
  removeAllListeners(): Promise<void>;
}

// Define the registerPlugin function explicitly
export const registerPlugin = <T extends Plugin>(pluginName: string): T => {
  try {
    // Try Capacitor's native implementation
    const { Plugins } = require('@capacitor/core');
    return Plugins[pluginName] as T;
  } catch {
    try {
      // Try modern Capacitor 5+ export
      const { registerPlugin: coreRegisterPlugin } = require('@capacitor/core');
      return coreRegisterPlugin(pluginName) as T;
    } catch {
      // Fallback to mock implementation
      return {
        addListener: () => Promise.resolve({ remove: () => Promise.resolve() }),
        removeAllListeners: () => Promise.resolve(),
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
