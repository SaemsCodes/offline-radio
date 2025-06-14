// src/types/native.d.ts
declare module '@capacitor/core' {
    interface PluginRegistry {
      NativeAudio: {
        startRecording(options: { usePTT: boolean }): Promise<void>;
      };
      MeshNetworking: {
        joinMesh(): Promise<void>;
        getConnectedPeers(): Promise<{ peers: string[] }>;
      };
    }
  }