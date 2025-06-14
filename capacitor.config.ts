// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.orad.app',
  appName: 'ORAD',
  webDir: 'dist',
  plugins: {
    NativeAudio: { androidPriority: 'HIGH' },
    MeshNetworking: { bleScanInterval: 5000 }
  },
  android: {
    minWebViewVersion: 112,
    buildOptions: {
      // Prevents namespace conflicts
      // namespace: 'com.orad.app' // Removed due to error: 'namespace' does not exist in type
    }
  }
};

export default config;