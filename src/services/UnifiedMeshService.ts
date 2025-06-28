import { MeshNetworking, type MeshPeer, type MeshMessage, type MeshNetworkStatus } from '../plugins/mesh-networking-plugin';
import { audioManager } from './AudioManager';
import { EncryptionService, createEncryptionService, type EncryptedMessage } from './EncryptionService';

export interface ChannelTransmission {
  id: string;
  senderId: string;
  channel: number;
  content: string | ArrayBuffer;
  type: 'voice' | 'text';
  timestamp: number;
  signalStrength: number;
  encrypted?: boolean;
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
  private discoveryChannel: BroadcastChannel | null = null;
  private encryptionService: EncryptionService | null = null;

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    this.deviceId = this.generateDeviceId();
    this.isNativeEnvironment = window.navigator.userAgent.includes('Capacitor');

    // Initialize encryption service
    this.encryptionService = createEncryptionService(this.deviceId);
    await this.encryptionService.initialize();

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
    this.initializeWebRTCDiscovery();
    this.simulatePeersForDemo();
    console.log('Web mesh service initialized');
  }

  private initializeWebRTCDiscovery() {
    this.discoveryChannel = new BroadcastChannel('mesh-radio-discovery');
    
    this.discoveryChannel.postMessage({
      type: 'peer-announcement',
      peerId: this.deviceId,
      channel: this.activeChannel,
      timestamp: Date.now()
    });

    this.discoveryChannel.onmessage = (event) => {
      if (event.data.type === 'peer-announcement' && event.data.peerId !== this.deviceId) {
        this.handlePeerDiscovered(event.data.peerId);
      } else if (event.data.type === 'message' && event.data.channel === this.activeChannel) {
        this.handleWebMessage(event.data);
      } else if (event.data.type === 'voice' && event.data.channel === this.activeChannel) {
        this.handleWebVoiceMessage(event.data);
      } else if (event.data.type === 'encrypted-message' && event.data.channel === this.activeChannel) {
        this.handleEncryptedMessage(event.data);
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
      signalStrength: 85,
      encrypted: false
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
      signalStrength: 75,
      encrypted: false
    };

    this.processTransmission(transmission);
  }

  private async handleWebVoiceMessage(data: any) {
    try {
      const audioData = Uint8Array.from(atob(data.audioData), c => c.charCodeAt(0));
      
      const transmission: ChannelTransmission = {
        id: data.id,
        senderId: data.senderId,
        channel: data.channel,
        content: audioData.buffer,
        type: 'voice',
        timestamp: data.timestamp,
        signalStrength: 75,
        encrypted: false
      };

      this.processTransmission(transmission);
    } catch (error) {
      console.error('Failed to process voice message:', error);
    }
  }

  private async handleEncryptedMessage(data: any) {
    if (!this.encryptionService) return;

    try {
      const encryptedMessage: EncryptedMessage = {
        data: new Uint8Array(data.encryptedData).buffer,
        iv: new Uint8Array(data.iv).buffer,
        senderPublicKey: new Uint8Array(data.senderPublicKey).buffer
      };

      const decryptedData = await this.encryptionService.decryptMessage(encryptedMessage, data.senderId);
      
      let content: string | ArrayBuffer;
      if (data.type === 'text') {
        content = new TextDecoder().decode(decryptedData);
      } else {
        content = decryptedData;
      }

      const transmission: ChannelTransmission = {
        id: data.id,
        senderId: data.senderId,
        channel: data.channel,
        content,
        type: data.type,
        timestamp: data.timestamp,
        signalStrength: 75,
        encrypted: true
      };

      this.processTransmission(transmission);
    } catch (error) {
      console.error('Failed to decrypt message:', error);
    }
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
      
      if (this.discoveryChannel) {
        this.discoveryChannel.postMessage({
          type: 'channel-change',
          peerId: this.deviceId,
          channel: this.activeChannel,
          timestamp: Date.now()
        });
      }
    }
  }

  public getCurrentChannel(): number {
    return this.activeChannel;
  }

  public getPeersOnCurrentChannel(): number {
    return this.peersByChannel.get(this.activeChannel)?.size || 0;
  }

  public async transmitText(text: string, encrypt: boolean = false): Promise<boolean> {
    try {
      if (encrypt && this.encryptionService) {
        return await this.transmitEncryptedText(text);
      }

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
        if (this.discoveryChannel) {
          this.discoveryChannel.postMessage({ type: 'message', ...messageData });
        }
        return true;
      }
    } catch (error) {
      console.error('Text transmission failed:', error);
      return false;
    }
  }

  private async transmitEncryptedText(text: string): Promise<boolean> {
    if (!this.encryptionService) return false;

    const pairedDevices = this.encryptionService.getPairedDevices().filter(d => d.verified);
    if (pairedDevices.length === 0) {
      console.warn('No paired devices for encrypted transmission');
      return false;
    }

    try {
      // For simplicity, encrypt for the first paired device
      // In a real implementation, you'd encrypt for all paired devices or specific recipients
      const recipient = pairedDevices[0];
      const encryptedMessage = await this.encryptionService.encryptMessage(text, recipient.deviceId);

      const messageData = {
        id: `encrypted-text-${Date.now()}`,
        senderId: this.deviceId,
        channel: this.activeChannel,
        type: 'text',
        timestamp: Date.now(),
        encryptedData: Array.from(new Uint8Array(encryptedMessage.data)),
        iv: Array.from(new Uint8Array(encryptedMessage.iv)),
        senderPublicKey: Array.from(new Uint8Array(encryptedMessage.senderPublicKey))
      };

      if (this.discoveryChannel) {
        this.discoveryChannel.postMessage({ type: 'encrypted-message', ...messageData });
      }
      return true;
    } catch (error) {
      console.error('Encrypted text transmission failed:', error);
      return false;
    }
  }

  public async transmitVoice(audioData: ArrayBuffer, encrypt: boolean = false): Promise<boolean> {
    try {
      if (encrypt && this.encryptionService) {
        return await this.transmitEncryptedVoice(audioData);
      }

      if (this.isNativeEnvironment) {
        const message: MeshMessage = {
          id: `voice-${Date.now()}`,
          sender: this.deviceId,
          destination: 'broadcast',
          payload: new Uint8Array(audioData),
          timestamp: Date.now(),
          hops: 0,
          type: 'voice',
          maxHops: 5
        };
        
        const result = await MeshNetworking.sendMessage({ message });
        return result.success;
      } else {
        const uint8Array = new Uint8Array(audioData);
        const base64Audio = btoa(String.fromCharCode(...uint8Array));
        
        const voiceData = {
          id: `voice-${Date.now()}`,
          senderId: this.deviceId,
          channel: this.activeChannel,
          type: 'voice',
          audioData: base64Audio,
          timestamp: Date.now()
        };

        if (this.discoveryChannel) {
          this.discoveryChannel.postMessage({ type: 'voice', ...voiceData });
        }
        return true;
      }
    } catch (error) {
      console.error('Voice transmission failed:', error);
      return false;
    }
  }

  private async transmitEncryptedVoice(audioData: ArrayBuffer): Promise<boolean> {
    if (!this.encryptionService) return false;

    const pairedDevices = this.encryptionService.getPairedDevices().filter(d => d.verified);
    if (pairedDevices.length === 0) {
      console.warn('No paired devices for encrypted transmission');
      return false;
    }

    try {
      const recipient = pairedDevices[0];
      const encryptedMessage = await this.encryptionService.encryptMessage(audioData, recipient.deviceId);

      const messageData = {
        id: `encrypted-voice-${Date.now()}`,
        senderId: this.deviceId,
        channel: this.activeChannel,
        type: 'voice',
        timestamp: Date.now(),
        encryptedData: Array.from(new Uint8Array(encryptedMessage.data)),
        iv: Array.from(new Uint8Array(encryptedMessage.iv)),
        senderPublicKey: Array.from(new Uint8Array(encryptedMessage.senderPublicKey))
      };

      if (this.discoveryChannel) {
        this.discoveryChannel.postMessage({ type: 'encrypted-message', ...messageData });
      }
      return true;
    } catch (error) {
      console.error('Encrypted voice transmission failed:', error);
      return false;
    }
  }

  // Encryption service access methods
  public getEncryptionService(): EncryptionService | null {
    return this.encryptionService;
  }

  public async generatePairingCode(): Promise<string> {
    if (!this.encryptionService) throw new Error('Encryption service not available');
    return await this.encryptionService.generatePairingCode();
  }

  public async processPairingCode(code: string) {
    if (!this.encryptionService) throw new Error('Encryption service not available');
    return await this.encryptionService.processPairingCode(code);
  }

  public async verifyPairing(deviceId: string, code: string): Promise<boolean> {
    if (!this.encryptionService) throw new Error('Encryption service not available');
    return await this.encryptionService.verifyPairing(deviceId, code);
  }

  public removePairing(deviceId: string): void {
    if (this.encryptionService) {
      this.encryptionService.removePairing(deviceId);
    }
  }

  public async rotateKeys(): Promise<void> {
    if (this.encryptionService) {
      await this.encryptionService.rotateKeys();
    }
  }

  public getPairedDevices() {
    return this.encryptionService ? this.encryptionService.getPairedDevices() : [];
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
      
      if (this.discoveryChannel) {
        this.discoveryChannel.close();
        this.discoveryChannel = null;
      }
      
      this.channelListeners.clear();
      this.statusListeners.clear();
      this.peersByChannel.clear();
      this.webRTCPeers.clear();
      
      await audioManager.destroy();
    } catch (error) {
      console.error('Shutdown failed:', error);
    }
  }
}

export const unifiedMeshService = new UnifiedMeshService();
