import { MeshNetworking, type MeshPeer, type MeshMessage, type MeshNetworkStatus } from '../plugins/mesh-networking-plugin';
import { webrtcCommunication } from './WebRTCCommunication';
import { deviceStatusManager } from './DeviceStatusManager';

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

  constructor() {
    this.initializeService();
    this.setupIntegrations();
  }

  private async initializeService() {
    try {
      // Check if we're in a native environment
      this.isNativeMode = window.navigator.userAgent.includes('Capacitor');
      
      if (this.isNativeMode) {
        // Initialize native mesh networking
        await MeshNetworking.startNetwork();
        this.setupNativeListeners();
      } else {
        // Use WebRTC for web-based testing
        this.initializeWebRTCMode();
      }
      
      console.log(`Channel mesh service initialized in ${this.isNativeMode ? 'native' : 'WebRTC'} mode`);
    } catch (error) {
      console.error('Failed to initialize channel mesh service:', error);
      // Always fallback to WebRTC mode
      this.initializeWebRTCMode();
    }
  }

  private initializeWebRTCMode() {
    console.log('Running in WebRTC communication mode');
    this.deviceId = `WEBRTC-${Math.random().toString(36).substr(2, 9)}`;
    this.isNativeMode = false;
    
    // Set up WebRTC event listeners
    webrtcCommunication.on('peer-connected', (peerId: string) => {
      this.addPeerToChannel(this.activeChannel, peerId);
      console.log(`WebRTC peer connected: ${peerId}`);
    });

    webrtcCommunication.on('peer-disconnected', (peerId: string) => {
      this.handlePeerLost(peerId);
      console.log(`WebRTC peer disconnected: ${peerId}`);
    });

    webrtcCommunication.on('message-received', (transmission: any) => {
      this.handleWebRTCMessage(transmission);
    });

    webrtcCommunication.on('audio-received', (audioData: any) => {
      this.handleWebRTCAudio(audioData);
    });
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
      this.updateFromNativeStatus(status);
    });
  }

  private setupIntegrations() {
    // Integrate with device status manager
    deviceStatusManager.onStatusChange((status) => {
      // Update our internal status to match real device status
      this.notifyStatusListeners();
    });
  }

  private handleWebRTCMessage(transmission: any) {
    const channelTransmission: ChannelTransmission = {
      id: transmission.id || `webrtc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      senderId: transmission.senderId,
      channel: transmission.channel,
      content: transmission.content,
      type: 'text',
      timestamp: transmission.timestamp,
      signalStrength: 85 + Math.random() * 15
    };

    this.processTransmission(channelTransmission);
  }

  private handleWebRTCAudio(audioData: any) {
    const audioTransmission: ChannelTransmission = {
      id: `audio-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      senderId: audioData.senderId,
      channel: audioData.channel,
      content: audioData.audioData,
      type: 'voice',
      timestamp: audioData.timestamp,
      signalStrength: 80 + Math.random() * 20
    };

    this.processTransmission(audioTransmission);
  }

  private processTransmission(transmission: ChannelTransmission) {
    // Only process messages for the current channel
    if (transmission.channel !== this.activeChannel) {
      return;
    }

    // Store transmission
    this.transmissionHistory.set(transmission.id, transmission);

    // Notify channel listeners
    const listeners = this.channelListeners.get(transmission.channel);
    if (listeners) {
      listeners.forEach(listener => listener(transmission));
    }

    console.log(`Processed transmission on channel ${transmission.channel}:`, transmission);
  }

  private async updateDeviceStatus(networkStatus?: MeshNetworkStatus) {
    try {
      // Check if we're in a native environment
      const isNative = window.navigator.userAgent.includes('Capacitor');
      
      if (isNative) {
        // Get real battery level from native plugin
        const status = networkStatus || await MeshNetworking.getNetworkStatus();
        this.deviceStatus.batteryLevel = status.batteryLevel || this.deviceStatus.batteryLevel;
        this.deviceStatus.isBluetoothEnabled = status.activeTransports.includes('bluetooth');
        this.deviceStatus.isWifiConnected = status.activeTransports.includes('wifi-direct');
      }
      
      this.updateSignalQuality();
      this.notifyStatusListeners();
    } catch (error) {
      console.error('Failed to update device status:', error);
    }
  }

  private updateSignalQuality() {
    const channelPeers = this.peersByChannel.get(this.activeChannel)?.size || 0;
    
    if (channelPeers >= 3) {
      this.deviceStatus.signalQuality = 'excellent';
    } else if (channelPeers >= 1) {
      this.deviceStatus.signalQuality = 'good';
    } else if (this.deviceStatus.isOnline || this.deviceStatus.isWifiConnected) {
      this.deviceStatus.signalQuality = 'poor';
    } else {
      this.deviceStatus.signalQuality = 'none';
    }
  }

  private handlePeerDiscovered(peer: MeshPeer) {
    // Add peer to appropriate channel (use protocol as channel indicator)
    const channel = parseInt(peer.protocol.split('-')[1]) || 1;
    this.addPeerToChannel(channel, peer.id);
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
  }

  private addPeerToChannel(channel: number, peerId: string) {
    if (!this.peersByChannel.has(channel)) {
      this.peersByChannel.set(channel, new Set());
    }
    this.peersByChannel.get(channel)!.add(peerId);
    this.updateSignalQuality();
  }

  private handleIncomingMessage(message: MeshMessage) {
    // Extract channel from message metadata or use current channel
    const channel = this.extractChannelFromMessage(message) || this.activeChannel;
    
    // Only process messages for the current channel
    if (channel !== this.activeChannel) {
      return;
    }

    const transmission: ChannelTransmission = {
      id: message.id,
      senderId: message.sender,
      channel,
      content: message.payload,
      type: message.type as 'voice' | 'text',
      timestamp: message.timestamp,
      signalStrength: this.calculateSignalStrength(message)
    };

    // Store transmission
    this.transmissionHistory.set(transmission.id, transmission);

    // Notify channel listeners
    const listeners = this.channelListeners.get(channel);
    if (listeners) {
      listeners.forEach(listener => listener(transmission));
    }

    console.log(`Received transmission on channel ${channel}:`, transmission);
  }

  private extractChannelFromMessage(message: MeshMessage): number | null {
    try {
      // Try to parse channel from message content or metadata
      if (typeof message.payload === 'string') {
        const parsed = JSON.parse(message.payload);
        return parsed.channel || null;
      }
    } catch {
      // If parsing fails, return null
    }
    return null;
  }

  private calculateSignalStrength(message: MeshMessage): number {
    // Calculate signal strength based on hops and network quality
    const baseStrength = 100;
    const hopPenalty = message.hops * 15;
    const qualityBonus = this.deviceStatus.signalQuality === 'excellent' ? 10 : 0;
    
    return Math.max(10, Math.min(100, baseStrength - hopPenalty + qualityBonus));
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
        // Native channel switching logic
        this.updateSignalQuality();
      } else {
        // WebRTC channel switching
        webrtcCommunication.setChannel(channel);
      }
      
      console.log(`Switched to channel ${channel}`);
    }
  }

  public getCurrentChannel(): number {
    return this.activeChannel;
  }

  public getPeersOnChannel(channel: number): number {
    if (this.isNativeMode) {
      return this.peersByChannel.get(channel)?.size || 0;
    } else {
      return webrtcCommunication.getPeerCount();
    }
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
            audioData: this.arrayBufferToBase64(audioData)
          }),
          timestamp: Date.now(),
          hops: 0,
          type: 'voice',
          maxHops: 5
        };

        const result = await MeshNetworking.sendMessage({ message });
        return result.success;
      } else {
        // Use WebRTC
        return webrtcCommunication.sendAudioData(audioData);
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
            text
          }),
          timestamp: Date.now(),
          hops: 0,
          type: 'text',
          maxHops: 5
        };

        const result = await MeshNetworking.sendMessage({ message });
        return result.success;
      } else {
        // Use WebRTC
        return webrtcCommunication.sendTextMessage(text);
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
    listener(this.deviceStatus);

    // Return unsubscribe function
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public getDeviceStatus(): DeviceStatus {
    // Get real device status from device status manager
    const realStatus = deviceStatusManager.getStatus();
    
    return {
      batteryLevel: realStatus.batteryLevel,
      isOnline: realStatus.isOnline,
      isWifiConnected: realStatus.isWifiConnected,
      isBluetoothEnabled: realStatus.isBluetoothEnabled,
      volume: realStatus.volume,
      signalQuality: realStatus.signalQuality
    };
  }

  public isConnected(): boolean {
    if (this.isNativeMode) {
      return this.getPeersOnCurrentChannel() > 0;
    } else {
      return webrtcCommunication.isNetworkConnected();
    }
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
      await MeshNetworking.stopNetwork();
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
