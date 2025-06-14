// src/typings/capacitor.d.ts
declare module '@capacitor/core' {
    export interface PluginRegistry {
      NativeAudio: any;
      MeshNetworking: any;
    }
    
    // Explicitly declare the registerPlugin function
    export function registerPlugin<T>(pluginName: string): T;
  }