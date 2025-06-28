
import { meshNetworkCore, type MeshNode, type MeshPacket } from './MeshNetworkCore';

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
  networkMetrics: {
    totalPeers: number;
    activePeers: number;
    averageLatency: number;
    networkReliability: number;
    availableTransports: string[];
  };
}

class UnifiedMeshService {
  private activeChannel: number = 1;
  private channelListeners: Map<number, Set<(transmission: ChannelTransmission) => void>> = new Map();
  private statusListeners: Set<(status: DeviceStatus) => void> = new Set();
  private deviceStatus: DeviceStatus = {
    batteryLevel: 100,
    isOnline: navigator.onLine,
    isWifiConnected: false,
    isBluetoothEnabled: false,
    volume: 7,
    signalQuality: 'none',
    networkMetrics: {
      totalPeers: 0,
      activePeers: 0,
      averageLatency: 0,
      networkReliability: 0,
      availableTransports: ['webrtc', 'websocket']
    }
  };

  constructor() {
    this.initializeService();
  }

  private initializeService() {
    // Set up mesh network listeners
    meshNetworkCore.on('messageReceived', (packet: MeshPacket) => {
      this.handleIncomingMessage(packet);
    });

    meshNetworkCore.on('nodeDiscovered', (node: MeshNode) => {
      this.updateDeviceStatus();
    });

    meshNetworkCore.on('nodeLost', () => {
      this.updateDeviceStatus();
    });

    // Periodic status updates
    setInterval(() => {
      this.updateDeviceStatus();
    }, 5000);
  }

  private handleIncomingMessage(packet: MeshPacket) {
    if (packet.type === 'voice' || packet.type === 'text') {
      const transmission: ChannelTransmission = {
        id: packet.id,
        senderId: packet.source,
        channel: packet.payload?.channel || this.activeChannel,
        content: packet.payload?.content || packet.payload,
        type: packet.type,
        timestamp: packet.timestamp,
        signalStrength: Math.random() * 100 // Simulated
      };

      // Notify channel listeners
      const listeners = this.channelListeners.get(transmission.channel);
      if (listeners) {
        listeners.forEach(listener => listener(transmission));
      }
    }
  }

  private updateDeviceStatus() {
    const nodes = meshNetworkCore.getDiscoveredNodes();
    const stats = meshNetworkCore.getNetworkStats();
    
    this.deviceStatus = {
      ...this.deviceStatus,
      batteryLevel: stats.batteryLevel,
      signalQuality: nodes.length > 3 ? 'excellent' : nodes.length > 1 ? 'good' : nodes.length > 0 ? 'poor' : 'none',
      networkMetrics: {
        totalPeers: nodes.length,
        activePeers: nodes.filter(n => n.lastSeen > Date.now() - 60000).length,
        averageLatency: 150,
        networkReliability: nodes.length > 0 ? 85 : 0,
        availableTransports: ['webrtc', 'websocket', 'bluetooth']
      }
    };

    // Notify status listeners
    this.statusListeners.forEach(listener => listener(this.deviceStatus));
  }

  public setChannel(channel: number) {
    if (channel >= 1 && channel <= 99) {
      this.activeChannel = channel;
    }
  }

  public getCurrentChannel(): number {
    return this.activeChannel;
  }

  public getPeersOnCurrentChannel(): number {
    return meshNetworkCore.getDiscoveredNodes().length;
  }

  public async transmitVoice(audioData: ArrayBuffer): Promise<boolean> {
    const messageId = meshNetworkCore.sendMessage('voice', {
      channel: this.activeChannel,
      content: audioData,
      timestamp: Date.now()
    });
    
    return !!messageId;
  }

  public async transmitText(text: string): Promise<boolean> {
    const messageId = meshNetworkCore.sendMessage('text', {
      channel: this.activeChannel,
      content: text,
      timestamp: Date.now()
    });
    
    return !!messageId;
  }

  public onChannelTransmission(channel: number, listener: (transmission: ChannelTransmission) => void) {
    if (!this.channelListeners.has(channel)) {
      this.channelListeners.set(channel, new Set());
    }
    this.channelListeners.get(channel)!.add(listener);

    // Return unsubscribe function
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
    // Immediately call with current status
    listener(this.deviceStatus);

    // Return unsubscribe function
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public getDeviceStatus(): DeviceStatus {
    return { ...this.deviceStatus };
  }

  public setVolume(volume: number) {
    this.deviceStatus.volume = Math.max(0, Math.min(10, volume));
    this.statusListeners.forEach(listener => listener(this.deviceStatus));
  }

  public async shutdown() {
    meshNetworkCore.shutdown();
    this.channelListeners.clear();
    this.statusListeners.clear();
  }
}

// Export singleton instance
export const unifiedMeshService = new UnifiedMeshService();
