
import { MeshNetworking, type MeshPeer, type MeshMessage, type MeshNetworkStatus } from '../plugins/mesh-networking-plugin';

export interface ChannelTransmission {
  id: string;
  senderId: string;
  channel: number;
  content: string | ArrayBuffer;
  type: 'voice' | 'text';
  timestamp: number;
  signalStrength: number;
}

export interface DeviceStatus {
  batteryLevel: number;
  isOnline: boolean;
  isWifiConnected: boolean;
  isBluetoothEnabled: boolean;
  volume: number;
  signalQuality: 'excellent' | 'good' | 'poor' | 'none';
}

class UnifiedMeshService {
  private activeChannel: number = 1;
  private deviceId: string = '';
  private isNativeEnvironment: boolean = false;
  private webRTCPeers: Map<string, RTCPeerConnection> = new Map();
  private channelListeners: Map<number, Set<(transmission: ChannelTransmission) => void>> = new Map();
  private peersByChannel: Map<number, Set<string>> = new Map();
  private deviceStatus: DeviceStatus = {
    batteryLevel: 100,
    isOnline: navigator.onLine,
    isWifiConnected: false,
    isBluetoothEnabled: false,
    volume: 7,
    signalQuality: 'none'
  };
  private statusListeners: Set<(status: DeviceStatus) => void> = new Set();
  private transmissionHistory: Map<string, ChannelTransmission> = new Map();

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    this.deviceId = this.generateDeviceId();
    this.isNativeEnvironment = window.navigator.userAgent.includes('Capacitor');

    if (this.isNativeEnvironment) {
      await this.initializeNative();
    } else {
      await this.initializeWeb();
    }

    this.setupNetworkListeners();
    this.startPeriodicUpdates();
  }

  private async initializeNative() {
    try {
      await MeshNetworking.startNetwork();
      
      MeshNetworking.addListener('peerDiscovered', (peer: MeshPeer) => {
        this.handlePeerDiscovered(peer.id);
      });

      MeshNetworking.addListener('peerLost', (peerId: string) => {
        this.handlePeerLost(peerId);
      });

      MeshNetworking.addListener('messageReceived', (message: MeshMessage) => {
        this.handleIncomingMessage(message);
      });

      console.log('Native mesh service initialized');
    } catch (error) {
      console.error('Native initialization failed, falling back to web:', error);
      await this.initializeWeb();
    }
  }

  private async initializeWeb() {
    // Initialize WebRTC-based mesh networking for web
    this.initializeWebRTCDiscovery();
    this.simulatePeersForDemo();
    console.log('Web mesh service initialized');
  }

  private initializeWebRTCDiscovery() {
    // Use BroadcastChannel for local peer discovery
    const channel = new BroadcastChannel('mesh-radio-discovery');
    
    channel.postMessage({
      type: 'peer-announcement',
      peerId: this.deviceId,
      channel: this.activeChannel,
      timestamp: Date.now()
    });

    channel.onmessage = (event) => {
      if (event.data.type === 'peer-announcement' && event.data.peerId !== this.deviceId) {
        this.handlePeerDiscovered(event.data.peerId);
      } else if (event.data.type === 'message' && event.data.channel === this.activeChannel) {
        this.handleWebMessage(event.data);
      }
    };
  }

  private simulatePeersForDemo() {
    setTimeout(() => {
      const mockPeers = [
        { id: 'ALPHA-001', channel: 1 },
        { id: 'BETA-002', channel: 1 },
        { id: 'CHARLIE-003', channel: 2 }
      ];

      mockPeers.forEach(peer => {
        this.addPeerToChannel(peer.channel, peer.id);
      });
    }, 1000);
  }

  private generateDeviceId(): string {
    return `DEVICE-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.deviceStatus.isOnline = true;
      this.updateSignalQuality();
      this.notifyStatusListeners();
    });

    window.addEventListener('offline', () => {
      this.deviceStatus.isOnline = false;
      this.updateSignalQuality();
      this.notifyStatusListeners();
    });
  }

  private startPeriodicUpdates() {
    setInterval(() => {
      this.updateSignalQuality();
      this.notifyStatusListeners();
    }, 5000);
  }

  private handlePeerDiscovered(peerId: string) {
    this.addPeerToChannel(this.activeChannel, peerId);
    console.log(`Peer discovered: ${peerId} on channel ${this.activeChannel}`);
  }

  private handlePeerLost(peerId: string) {
    this.peersByChannel.forEach((peers, channel) => {
      peers.delete(peerId);
      if (peers.size === 0) {
        this.peersByChannel.delete(channel);
      }
    });
    this.updateSignalQuality();
  }

  private addPeerToChannel(channel: number, peerId: string) {
    if (!this.peersByChannel.has(channel)) {
      this.peersByChannel.set(channel, new Set());
    }
    this.peersByChannel.get(channel)!.add(peerId);
    this.updateSignalQuality();
  }

  private handleIncomingMessage(message: MeshMessage) {
    const transmission: ChannelTransmission = {
      id: message.id,
      senderId: message.sender,
      channel: this.extractChannelFromPayload(message.payload) || this.activeChannel,
      content: message.payload,
      type: message.type as 'voice' | 'text',
      timestamp: message.timestamp,
      signalStrength: 85
    };

    this.processTransmission(transmission);
  }

  private handleWebMessage(data: any) {
    const transmission: ChannelTransmission = {
      id: data.id,
      senderId: data.senderId,
      channel: data.channel,
      content: data.content,
      type: data.type,
      timestamp: data.timestamp,
      signalStrength: 75
    };

    this.processTransmission(transmission);
  }

  private processTransmission(transmission: ChannelTransmission) {
    if (transmission.channel !== this.activeChannel) return;

    this.transmissionHistory.set(transmission.id, transmission);

    const listeners = this.channelListeners.get(transmission.channel);
    if (listeners) {
      listeners.forEach(listener => listener(transmission));
    }
  }

  private extractChannelFromPayload(payload: string | Uint8Array): number | null {
    try {
      if (typeof payload === 'string') {
        const parsed = JSON.parse(payload);
        return parsed.channel || null;
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  }

  private updateSignalQuality() {
    const channelPeers = this.peersByChannel.get(this.activeChannel)?.size || 0;
    
    if (channelPeers >= 3) {
      this.deviceStatus.signalQuality = 'excellent';
    } else if (channelPeers >= 1) {
      this.deviceStatus.signalQuality = 'good';
    } else if (this.deviceStatus.isOnline) {
      this.deviceStatus.signalQuality = 'poor';
    } else {
      this.deviceStatus.signalQuality = 'none';
    }
  }

  private notifyStatusListeners() {
    this.statusListeners.forEach(listener => listener(this.deviceStatus));
  }

  // Public API
  public setChannel(channel: number) {
    if (channel >= 1 && channel <= 99) {
      this.activeChannel = channel;
      this.updateSignalQuality();
    }
  }

  public getCurrentChannel(): number {
    return this.activeChannel;
  }

  public getPeersOnCurrentChannel(): number {
    return this.peersByChannel.get(this.activeChannel)?.size || 0;
  }

  public async transmitText(text: string): Promise<boolean> {
    try {
      const messageData = {
        id: `text-${Date.now()}`,
        senderId: this.deviceId,
        channel: this.activeChannel,
        content: text,
        type: 'text',
        timestamp: Date.now()
      };

      if (this.isNativeEnvironment) {
        const message: MeshMessage = {
          id: messageData.id,
          sender: this.deviceId,
          destination: 'broadcast',
          payload: JSON.stringify({ channel: this.activeChannel, text }),
          timestamp: Date.now(),
          hops: 0,
          type: 'text',
          maxHops: 5
        };
        
        const result = await MeshNetworking.sendMessage({ message });
        return result.success;
      } else {
        // Web implementation using BroadcastChannel
        const channel = new BroadcastChannel('mesh-radio-discovery');
        channel.postMessage({ type: 'message', ...messageData });
        return true;
      }
    } catch (error) {
      console.error('Text transmission failed:', error);
      return false;
    }
  }

  public async transmitVoice(audioData: ArrayBuffer): Promise<boolean> {
    console.log('Voice transmission simulated');
    // For now, just simulate voice transmission
    return true;
  }

  public onChannelTransmission(channel: number, listener: (transmission: ChannelTransmission) => void) {
    if (!this.channelListeners.has(channel)) {
      this.channelListeners.set(channel, new Set());
    }
    this.channelListeners.get(channel)!.add(listener);

    return () => {
      const listeners = this.channelListeners.get(channel);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.channelListeners.delete(channel);
        }
      }
    };
  }

  public onDeviceStatusChange(listener: (status: DeviceStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.deviceStatus);

    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public getDeviceStatus(): DeviceStatus {
    return { ...this.deviceStatus };
  }

  public setVolume(volume: number) {
    this.deviceStatus.volume = Math.max(0, Math.min(10, volume));
    this.notifyStatusListeners();
  }

  public async shutdown() {
    try {
      if (this.isNativeEnvironment) {
        await MeshNetworking.stopNetwork();
      }
      this.channelListeners.clear();
      this.statusListeners.clear();
      this.peersByChannel.clear();
      this.webRTCPeers.clear();
    } catch (error) {
      console.error('Shutdown failed:', error);
    }
  }
}

export const unifiedMeshService = new UnifiedMeshService();
