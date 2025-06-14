import { MeshNetworking, type MeshPeer, type MeshMessage, type MeshNetworkStatus, type RouteDiscoveryResult } from '../plugins/mesh-networking-plugin';

class MeshService {
  private peerCache: Map<string, MeshPeer> = new Map();
  private messageQueue: MeshMessage[] = [];
  private isEmergencyMode = false;
  private networkStatus: MeshNetworkStatus = {
    isConnected: false,
    activeTransports: [],
    peerCount: 0,
    batteryLevel: null,
    currentBandwidth: 0
  };

  constructor() {
    this.setupEventListeners();
  }

  async initialize() {
    try {
      const { success } = await MeshNetworking.startNetwork();
      if (success) {
        this.networkStatus = await MeshNetworking.getNetworkStatus();
        console.log('Mesh network initialized', this.networkStatus);
        this.processMessageQueue();
      } else {
        console.error('Mesh network failed to start');
        this.networkStatus.isConnected = false;
      }
    } catch (error) {
      console.error('Network initialization failed:', error);
      this.networkStatus.isConnected = false;
    }
  }

  private setupEventListeners() {
    MeshNetworking.addListener('peerDiscovered', (peer) => {
      this.peerCache.set(peer.id, peer);
      this.updateNetworkStatus({ peerCount: this.peerCache.size });
    });

    MeshNetworking.addListener('peerLost', (peerId) => {
      this.peerCache.delete(peerId);
      this.updateNetworkStatus({ peerCount: this.peerCache.size });
    });

    MeshNetworking.addListener('messageReceived', (message) => {
      if (message.type === 'emergency') {
        this.handleEmergencyMessage(message);
      } else {
        // Dispatch custom event for UI
        const event = new CustomEvent('meshMessage', { detail: message });
        document.dispatchEvent(event);
      }
    });

    MeshNetworking.addListener('networkStatusChanged', (status) => {
      this.networkStatus = status;
      // Dispatch custom event for UI
      const event = new CustomEvent('meshNetworkStatus', { detail: status });
      document.dispatchEvent(event);
    });

    MeshNetworking.addListener('emergencyAlert', (alert) => {
      // Trigger visual/sound alarm
      console.warn('EMERGENCY ALERT FROM:', alert.sender);
      // Dispatch custom event for UI
      const event = new CustomEvent('emergencyAlert', { detail: alert });
      document.dispatchEvent(event);
    });
  }

  async getConnectedPeers(): Promise<MeshPeer[]> {
    try {
      const { peers } = await MeshNetworking.getConnectedPeers();
      peers.forEach(peer => this.peerCache.set(peer.id, peer));
      return peers;
    } catch (error) {
      console.error('Failed to get peers:', error);
      return Array.from(this.peerCache.values());
    }
  }

  async sendMessage(
    content: string | Uint8Array, 
    destination: string = 'broadcast',
    type: MeshMessage['type'] = 'text'
  ): Promise<boolean> {
    const message: MeshMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      sender: 'local',
      destination,
      payload: content,
      timestamp: Date.now(),
      hops: 0,
      type,
      maxHops: 5
    };

    if (!this.networkStatus.isConnected) {
      this.messageQueue.push(message);
      return false;
    }

    try {
      const { success } = await MeshNetworking.sendMessage({ message });
      return success;
    } catch (error) {
      console.error('Message send failed:', error);
      this.messageQueue.push(message);
      return false;
    }
  }

  async discoverRoute(destination: string): Promise<string[] | null> {
    if (!this.peerCache.has(destination)) {
      return null;
    }

    try {
      const result = await MeshNetworking.discoverRoute({ destination });
      return result.success ? result.path : null;
    } catch (error) {
      console.error('Route discovery failed:', error);
      return null;
    }
  }

  async enableEmergencyMode() {
    if (this.isEmergencyMode) return;
    
    try {
      await MeshNetworking.enableEmergencyMode();
      this.isEmergencyMode = true;
      
      // Send emergency beacon with location
      await MeshNetworking.sendEmergencyBeacon({ 
        message: 'EMERGENCY ACTIVATED' 
      });
    } catch (error) {
      console.error('Failed to activate emergency mode:', error);
    }
  }

  private handleEmergencyMessage(message: MeshMessage) {
    // Prioritize emergency messages
    if (typeof message.payload === 'string') {
      console.warn(`EMERGENCY: ${message.payload}`);
      // Dispatch custom event for UI
      const event = new CustomEvent('emergencyMessage', { detail: message });
      document.dispatchEvent(event);
    }
    
    // Forward to all peers if not originator
    if (message.sender !== 'local') {
      this.sendMessage(message.payload, 'broadcast', 'emergency');
    }
  }

  private async processMessageQueue() {
    while (this.messageQueue.length > 0 && this.networkStatus.isConnected) {
      const message = this.messageQueue.shift()!;
      try {
        await MeshNetworking.sendMessage({ message });
      } catch (error) {
        // Requeue if failed
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  private updateNetworkStatus(update: Partial<MeshNetworkStatus>) {
    this.networkStatus = { ...this.networkStatus, ...update };
  }

  async shutdown() {
    try {
      await MeshNetworking.stopNetwork();
      MeshNetworking.removeAllListeners();
    } catch (error) {
      console.error('Network shutdown failed:', error);
    }
  }
}

// Singleton instance
export const meshService = new MeshService();

// Initialize on app start
meshService.initialize();