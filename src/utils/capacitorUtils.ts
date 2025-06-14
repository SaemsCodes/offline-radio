
export interface Plugin {
  addListener(eventName: string, listenerFunc: (...args: any[]) => void): Promise<any>;
  removeAllListeners(): Promise<void>;
}

export const registerPlugin = <T extends Plugin>(pluginName: string): T => {
  try {
    // Check if we're in a Capacitor environment
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      const { Capacitor } = (window as any);
      if (Capacitor.isPluginAvailable(pluginName)) {
        return Capacitor.Plugins[pluginName] as T;
      }
    }
    
    // Try legacy Capacitor imports
    try {
      const { Plugins } = require('@capacitor/core');
      if (Plugins[pluginName]) {
        return Plugins[pluginName] as T;
      }
    } catch {
      // Ignore legacy import errors
    }

    // Try modern Capacitor 5+ export
    try {
      const { registerPlugin: coreRegisterPlugin } = require('@capacitor/core');
      return coreRegisterPlugin(pluginName) as T;
    } catch {
      // Ignore modern import errors
    }
  } catch (error) {
    console.warn(`Plugin ${pluginName} not available, using fallback:`, error);
  }

  // Enhanced fallback implementation
  return {
    addListener: (eventName: string, listenerFunc: (...args: any[]) => void) => {
      console.log(`[${pluginName}] Mock listener added for event: ${eventName}`);
      return Promise.resolve({ remove: () => Promise.resolve() });
    },
    removeAllListeners: () => {
      console.log(`[${pluginName}] Mock removeAllListeners called`);
      return Promise.resolve();
    },
    startNetwork: () => {
      console.log(`[${pluginName}] Mock startNetwork called`);
      return Promise.resolve({ success: false });
    },
    stopNetwork: () => {
      console.log(`[${pluginName}] Mock stopNetwork called`);
      return Promise.resolve();
    },
    getNetworkStatus: () => {
      console.log(`[${pluginName}] Mock getNetworkStatus called`);
      return Promise.resolve({
        isConnected: false,
        activeTransports: [],
        peerCount: 0,
        batteryLevel: 100,
        currentBandwidth: 0
      });
    },
    sendMessage: (options: any) => {
      console.log(`[${pluginName}] Mock sendMessage called:`, options);
      return Promise.resolve({ success: false });
    },
    getConnectedPeers: () => {
      console.log(`[${pluginName}] Mock getConnectedPeers called`);
      return Promise.resolve({ peers: [] });
    },
    discoverRoute: (options: any) => {
      console.log(`[${pluginName}] Mock discoverRoute called:`, options);
      return Promise.resolve({ 
        destination: options.destination,
        path: [],
        latency: 0,
        success: false
      });
    },
    enableEmergencyMode: () => {
      console.log(`[${pluginName}] Mock enableEmergencyMode called`);
      return Promise.resolve();
    },
    sendEmergencyBeacon: (options: any) => {
      console.log(`[${pluginName}] Mock sendEmergencyBeacon called:`, options);
      return Promise.resolve({ peersReached: 0 });
    }
  } as unknown as T;
};
