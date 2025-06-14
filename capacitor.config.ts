
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.orad.app',
  appName: 'ORAD',
  webDir: 'dist',
  plugins: {
    NativeAudio: { 
      androidPriority: 'HIGH' 
    },
    MeshNetworking: { 
      bleScanInterval: 5000,
      wifiDirectEnabled: true,
      enableBackgroundDiscovery: true,
      maxPeers: 32,
      routingProtocol: 'AODV'
    }
  },
  android: {
    minWebViewVersion: 112,
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined
    }
  },
  server: {
    url: "https://65090bb5-dbea-4585-9bad-6ab3475294f8.lovableproject.com?forceHideBadge=true",
    cleartext: true
  }
};

export default config;
