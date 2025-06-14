
import { MeshNetworking, type MeshPeer, type MeshMessage, type MeshNetworkStatus } from '../plugins/mesh-networking-plugin';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

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

class ChannelMeshService {
  private activeChannel: number = 1;
  private deviceId: string = '';
  private channelListeners: Map<number, Set<(transmission: ChannelTransmission) => void>> = new Map();
  private peersByChannel: Map<number, Set<string>> = new Map();
  private statusListeners: Set<(status: DeviceStatus) => void> = new Set();
  private transmissionHistory: Map<string, ChannelTransmission> = new Map();
  private isNativeMode: boolean = false;
  private networkStatus: MeshNetworkStatus = {
    isConnected: false,
    activeTransports: [],
    peerCount: 0,
    batteryLevel: null,
    currentBandwidth: 0
  };
  private deviceInfo: any = {};

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    try {
      // Check if we're in a native environment
      this.isNativeMode = Capacitor.isNativePlatform();
      
      // Get device information
      this.deviceInfo = await Device.getInfo();
      this.deviceId = `MESH-${this.deviceInfo.model}-${Date.now()}`;
      
      if (this.isNativeMode) {
        console.log('Initializing native mesh networking');
        await this.initializeNativeMesh();
      } else {
        console.log('Running in web mode - using fallback simulation');
        this.initializeWebMode();
      }
      
      console.log(`Channel mesh service initialized in ${this.isNativeMode ? 'native' : 'web'} mode`);
    } catch (error) {
      console.error('Failed to initialize channel mesh service:', error);
      this.initializeWebMode();
    }
  }

  private async initializeNativeMesh() {
    try {
      // Start native mesh network
      const result = await MeshNetworking.startNetwork();
      if (result.success) {
        this.setupNativeListeners();
        this.networkStatus = await MeshNetworking.getNetworkStatus();
        console.log('Native mesh network started successfully:', this.networkStatus);
      } else {
        throw new Error('Failed to start native mesh network');
      }
    } catch (error) {
      console.error('Native mesh initialization failed:', error);
      this.initializeWebMode();
    }
  }

  private setupNativeListeners() {
    // Set up native mesh networking listeners
    MeshNetworking.addListener('peerDiscovered', (peer: MeshPeer) => {
      console.log('Native peer discovered:', peer);
      this.handlePeerDiscovered(peer);
    });

    MeshNetworking.addListener('peerLost', (peerId: string) => {
      console.log('Native peer lost:', peerId);
      this.handlePeerLost(peerId);
    });

    MeshNetworking.addListener('messageReceived', (message: MeshMessage) => {
      console.log('Native message received:', message);
      this.handleIncomingMessage(message);
    });

    MeshNetworking.addListener('networkStatusChanged', (status: MeshNetworkStatus) => {
      this.networkStatus = status;
      this.updateSignalQuality();
      this.notifyStatusListeners();
    });
  }

  private initializeWebMode() {
    console.log('Initializing web fallback mode');
    this.isNativeMode = false;
    this.networkStatus.isConnected = true;
    this.networkStatus.activeTransports = ['wifi'];
    
    // Simulate some peers for testing
    setTimeout(() => {
      this.addPeerToChannel(this.activeChannel, 'web-peer-1');
      this.addPeerToChannel(this.activeChannel, 'web-peer-2');
    }, 2000);
  }

  private handlePeerDiscovered(peer: MeshPeer) {
    // Extract channel from peer protocol or use default
    const channel = this.extractChannelFromPeer(peer) || this.activeChannel;
    this.addPeerToChannel(channel, peer.id);
    
    console.log(`Peer ${peer.id} discovered on channel ${channel}`);
  }

  private extractChannelFromPeer(peer: MeshPeer): number | null {
    try {
      // Try to extract channel from peer name or protocol
      if (peer.name.includes('CH-')) {
        const channelMatch = peer.name.match(/CH-(\d+)/);
        return channelMatch ? parseInt(channelMatch[1]) : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private handlePeerLost(peerId: string) {
    // Remove peer from all channels
    this.peersByChannel.forEach((peers, channel) => {
      peers.delete(peerId);
      if (peers.size === 0) {
        this.peersByChannel.delete(channel);
      }
    });
    this.updateSignalQuality();
    this.notifyStatusListeners();
  }

  private addPeerToChannel(channel: number, peerId: string) {
    if (!this.peersByChannel.has(channel)) {
      this.peersByChannel.set(channel, new Set());
    }
    this.peersByChannel.get(channel)!.add(peerId);
    this.updateSignalQuality();
    this.notifyStatusListeners();
  }

  private handleIncomingMessage(message: MeshMessage) {
    try {
      // Parse message payload to extract channel and content
      const payload = this.parseMessagePayload(message.payload);
      
      // Only process messages for the current channel
      if (payload.channel !== this.activeChannel) {
        return;
      }

      const transmission: ChannelTransmission = {
        id: message.id,
        senderId: message.sender,
        channel: payload.channel,
        content: payload.content || message.payload,
        type: message.type as 'voice' | 'text',
        timestamp: message.timestamp,
        signalStrength: this.calculateSignalStrength(message)
      };

      this.processTransmission(transmission);
    } catch (error) {
      console.error('Failed to handle incoming message:', error);
    }
  }

  private parseMessagePayload(payload: string | Uint8Array): any {
    try {
      if (typeof payload === 'string') {
        return JSON.parse(payload);
      } else {
        // Handle binary payload (voice data)
        return {
          channel: this.activeChannel,
          content: payload,
          type: 'voice'
        };
      }
    } catch {
      return {
        channel: this.activeChannel,
        content: payload,
        type: typeof payload === 'string' ? 'text' : 'voice'
      };
    }
  }

  private processTransmission(transmission: ChannelTransmission) {
    // Store transmission
    this.transmissionHistory.set(transmission.id, transmission);

    // Notify channel listeners
    const listeners = this.channelListeners.get(transmission.channel);
    if (listeners) {
      listeners.forEach(listener => listener(transmission));
    }

    console.log(`Processed transmission on channel ${transmission.channel}:`, transmission);
  }

  private calculateSignalStrength(message: MeshMessage): number {
    // Calculate signal strength based on hops and network quality
    const baseStrength = 100;
    const hopPenalty = message.hops * 15;
    const qualityBonus = this.networkStatus.isConnected ? 10 : 0;
    
    return Math.max(10, Math.min(100, baseStrength - hopPenalty + qualityBonus));
  }

  private updateSignalQuality() {
    const channelPeers = this.peersByChannel.get(this.activeChannel)?.size || 0;
    
    if (channelPeers >= 3) {
      this.deviceStatus.signalQuality = 'excellent';
    } else if (channelPeers >= 1) {
      this.deviceStatus.signalQuality = 'good';
    } else if (this.networkStatus.isConnected) {
      this.deviceStatus.signalQuality = 'poor';
    } else {
      this.deviceStatus.signalQuality = 'none';
    }
  }

  private deviceStatus: DeviceStatus = {
    batteryLevel: 100,
    isOnline: false,
    isWifiConnected: false,
    isBluetoothEnabled: false,
    volume: 7,
    signalQuality: 'none'
  };

  private async updateDeviceStatus() {
    try {
      if (this.isNativeMode) {
        // Get real device status from native APIs
        const batteryInfo = await Device.getBatteryInfo();
        if (batteryInfo) {
          this.deviceStatus.batteryLevel = Math.round(batteryInfo.batteryLevel || 100);
        }

        const networkStatus = await Network.getStatus();
        this.deviceStatus.isOnline = networkStatus.connected;
        this.deviceStatus.isWifiConnected = networkStatus.connectionType === 'wifi';
        
        // Update from mesh network status
        this.deviceStatus.isBluetoothEnabled = this.networkStatus.activeTransports.includes('bluetooth');
      } else {
        // Web fallback - simulate values
        this.deviceStatus.isOnline = navigator.onLine;
        this.deviceStatus.isWifiConnected = true;
        this.deviceStatus.isBluetoothEnabled = false;
      }
      
      this.updateSignalQuality();
      this.notifyStatusListeners();
    } catch (error) {
      console.error('Failed to update device status:', error);
    }
  }

  private notifyStatusListeners() {
    const status = this.getDeviceStatus();
    this.statusListeners.forEach(listener => listener(status));
  }

  // Public API methods
  public setChannel(channel: number) {
    if (channel >= 1 && channel <= 99) {
      this.activeChannel = channel;
      
      if (this.isNativeMode) {
        // Update our device name to include channel info for peer discovery
        this.deviceId = `MESH-${this.deviceInfo.model}-CH-${channel}`;
      }
      
      this.updateSignalQuality();
      console.log(`Switched to channel ${channel}`);
    }
  }

  public getCurrentChannel(): number {
    return this.activeChannel;
  }

  public getPeersOnChannel(channel: number): number {
    return this.peersByChannel.get(channel)?.size || 0;
  }

  public getPeersOnCurrentChannel(): number {
    return this.getPeersOnChannel(this.activeChannel);
  }

  public async transmitVoice(audioData: ArrayBuffer): Promise<boolean> {
    try {
      if (this.isNativeMode) {
        // Use native mesh networking
        const message: MeshMessage = {
          id: `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sender: this.deviceId,
          destination: 'broadcast',
          payload: JSON.stringify({
            channel: this.activeChannel,
            audioData: this.arrayBufferToBase64(audioData),
            type: 'voice'
          }),
          timestamp: Date.now(),
          hops: 0,
          type: 'voice',
          maxHops: 5
        };

        const result = await MeshNetworking.sendMessage({ message });
        console.log('Voice transmission result:', result);
        return result.success;
      } else {
        // Web simulation
        console.log('Simulated voice transmission');
        return true;
      }
    } catch (error) {
      console.error('Voice transmission failed:', error);
      return false;
    }
  }

  public async transmitText(text: string): Promise<boolean> {
    try {
      if (this.isNativeMode) {
        // Use native mesh networking
        const message: MeshMessage = {
          id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sender: this.deviceId,
          destination: 'broadcast',
          payload: JSON.stringify({
            channel: this.activeChannel,
            text,
            type: 'text'
          }),
          timestamp: Date.now(),
          hops: 0,
          type: 'text',
          maxHops: 5
        };

        const result = await MeshNetworking.sendMessage({ message });
        console.log('Text transmission result:', result);
        return result.success;
      } else {
        // Web simulation
        console.log('Simulated text transmission:', text);
        return true;
      }
    } catch (error) {
      console.error('Text transmission failed:', error);
      return false;
    }
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
    this.updateDeviceStatus();

    // Return unsubscribe function
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public getDeviceStatus(): DeviceStatus {
    return { ...this.deviceStatus };
  }

  public isConnected(): boolean {
    return this.networkStatus.isConnected && this.getPeersOnCurrentChannel() > 0;
  }

  public setVolume(volume: number) {
    this.deviceStatus.volume = Math.max(0, Math.min(10, volume));
    this.notifyStatusListeners();
  }

  public getTransmissionHistory(channel?: number): ChannelTransmission[] {
    const transmissions = Array.from(this.transmissionHistory.values());
    if (channel !== undefined) {
      return transmissions.filter(t => t.channel === channel);
    }
    return transmissions;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  public async shutdown() {
    try {
      if (this.isNativeMode) {
        await MeshNetworking.stopNetwork();
        await MeshNetworking.removeAllListeners();
      }
      this.channelListeners.clear();
      this.statusListeners.clear();
      this.peersByChannel.clear();
      this.transmissionHistory.clear();
    } catch (error) {
      console.error('Failed to shutdown mesh service:', error);
    }
  }
}

// Export singleton instance
export const channelMeshService = new ChannelMeshService();
