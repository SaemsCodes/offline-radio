
import { registerPlugin } from '@capacitor/core';
import type { MeshNetworkingPlugin, MeshMessage, MeshPeer } from '../plugins/mesh-networking-plugin';
import { MeshServiceWorker } from './MeshServiceWorker';

const MeshNetworking = registerPlugin<MeshNetworkingPlugin>('MeshNetworking');

export class NativeMeshBridge {
  private static instance: NativeMeshBridge | null = null;
  private isInitialized = false;
  private meshServiceWorker: MeshServiceWorker;
  private eventListeners: Map<string, Function[]> = new Map();

  private constructor() {
    this.meshServiceWorker = MeshServiceWorker.getInstance();
  }

  static getInstance(): NativeMeshBridge {
    if (!NativeMeshBridge.instance) {
      NativeMeshBridge.instance = new NativeMeshBridge();
    }
    return NativeMeshBridge.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Start native mesh network
      await MeshNetworking.startNetwork();
      
      // Set up native event listeners
      await MeshNetworking.addListener('peerDiscovered', (peer: MeshPeer) => {
        this.emit('peerDiscovered', peer);
        console.log('Native peer discovered:', peer.id);
      });

      await MeshNetworking.addListener('peerLost', (peerId: string) => {
        this.emit('peerLost', peerId);
        console.log('Native peer lost:', peerId);
      });

      await MeshNetworking.addListener('messageReceived', (message: MeshMessage) => {
        this.emit('messageReceived', message);
        // Queue message in service worker for background processing
        this.meshServiceWorker.queueMessage(message);
      });

      await MeshNetworking.addListener('routeDiscovered', (route) => {
        this.emit('routeDiscovered', route);
        console.log('Native route discovered:', route);
      });

      await MeshNetworking.addListener('networkStatusChanged', (status) => {
        this.emit('networkStatusChanged', status);
        console.log('Native network status changed:', status);
      });

      this.isInitialized = true;
      console.log('Native mesh bridge initialized successfully');
    } catch (error) {
      console.error('Failed to initialize native mesh bridge:', error);
      throw error;
    }
  }

  async sendMessage(message: MeshMessage): Promise<boolean> {
    try {
      const result = await MeshNetworking.sendMessage({ message });
      return result.success;
    } catch (error) {
      console.error('Failed to send message via native bridge:', error);
      return false;
    }
  }

  async getConnectedPeers(): Promise<MeshPeer[]> {
    try {
      const result = await MeshNetworking.getConnectedPeers();
      return result.peers;
    } catch (error) {
      console.error('Failed to get connected peers:', error);
      return [];
    }
  }

  async discoverRoute(destination: string): Promise<void> {
    try {
      await MeshNetworking.discoverRoute({ destination });
    } catch (error) {
      console.error('Failed to discover route:', error);
    }
  }

  async getNetworkStatus() {
    try {
      return await MeshNetworking.getNetworkStatus();
    } catch (error) {
      console.error('Failed to get network status:', error);
      return {
        isConnected: false,
        activeTransports: [],
        peerCount: 0,
        batteryLevel: null,
        currentBandwidth: 0
      };
    }
  }

  async enableEmergencyMode(): Promise<void> {
    try {
      await MeshNetworking.enableEmergencyMode();
      console.log('Emergency mode enabled');
    } catch (error) {
      console.error('Failed to enable emergency mode:', error);
    }
  }

  async sendEmergencyBeacon(message?: string): Promise<number> {
    try {
      const result = await MeshNetworking.sendEmergencyBeacon({ message });
      return result.peersReached;
    } catch (error) {
      console.error('Failed to send emergency beacon:', error);
      return 0;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await MeshNetworking.stopNetwork();
      await MeshNetworking.removeAllListeners();
      this.eventListeners.clear();
      this.isInitialized = false;
      console.log('Native mesh bridge shutdown successfully');
    } catch (error) {
      console.error('Failed to shutdown native bridge:', error);
    }
  }

  // Event system for bridge
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}
