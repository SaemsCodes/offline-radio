
import { registerPlugin } from '@capacitor/core';

export interface PluginListenerHandle {
  remove: () => Promise<void>;
}

export interface MeshPeer {
  id: string;
  name: string;
  protocol: 'wifi-direct' | 'ble' | 'websocket' | 'internet';
  signalStrength: number;
  lastSeen: number;
  isDirect: boolean;
}

export interface MeshMessage {
  id: string;
  sender: string;
  destination: string; // 'broadcast' or specific peer ID
  payload: string | Uint8Array;
  timestamp: number;
  hops: number;
  type: 'text' | 'voice' | 'emergency' | 'route-request';
  // Add routing metadata
  nextHop?: string;
  path?: string[];
  maxHops: number;
}

export interface RouteDiscoveryResult {
  destination: string;
  path: string[];
  latency: number;
  success: boolean;
}

export interface MeshNetworkStatus {
  isConnected: boolean;
  activeTransports: string[];
  peerCount: number;
  batteryLevel: number | null;
  currentBandwidth: number;
}

export interface MeshNetworkingPlugin {
  // Core Methods
  getConnectedPeers(): Promise<{ peers: MeshPeer[] }>;
  sendMessage(options: { message: MeshMessage }): Promise<{ success: boolean }>;
  discoverRoute(options: { destination: string }): Promise<RouteDiscoveryResult>;
  
  // Network Management
  startNetwork(): Promise<{ success: boolean }>;
  stopNetwork(): Promise<void>;
  getNetworkStatus(): Promise<MeshNetworkStatus>;
  
  // Emergency Features
  enableEmergencyMode(): Promise<void>;
  sendEmergencyBeacon(options: { message?: string }): Promise<{ peersReached: number }>;
  
  // Event Listeners
  addListener(
    eventName: 'peerDiscovered',
    listenerFunc: (peer: MeshPeer) => void,
  ): PluginListenerHandle;
  
  addListener(
    eventName: 'peerLost',
    listenerFunc: (peerId: string) => void,
  ): PluginListenerHandle;
  
  addListener(
    eventName: 'messageReceived',
    listenerFunc: (message: MeshMessage) => void,
  ): PluginListenerHandle;
  
  addListener(
    eventName: 'routeDiscovered',
    listenerFunc: (route: RouteDiscoveryResult) => void,
  ): PluginListenerHandle;
  
  addListener(
    eventName: 'networkStatusChanged',
    listenerFunc: (status: MeshNetworkStatus) => void,
  ): PluginListenerHandle;
  
  addListener(
    eventName: 'emergencyAlert',
    listenerFunc: (alert: { sender: string; location?: string }) => void,
  ): PluginListenerHandle;
  
  // Remove all listeners
  removeAllListeners(): Promise<void>;
}

const MeshNetworking = registerPlugin<MeshNetworkingPlugin>('MeshNetworking');

// Export as default and named for flexibility
export default MeshNetworking;
export { MeshNetworking };
