import { MeshNetworking, type MeshPeer, type MeshMessage, type MeshNetworkStatus } from '../plugins/mesh-networking-plugin';
import { audioManager } from './AudioManager';
import { EncryptionService, createEncryptionService, type EncryptedMessage } from './EncryptionService';
import { networkDiscoveryService, type DiscoveredPeer } from './NetworkDiscoveryService';
import { createAdaptiveRoutingService, type AdaptiveRoutingService, type QualityOfService } from './AdaptiveRoutingService';
import { connectionPoolService, type PooledConnection } from './ConnectionPoolService';
import { productionErrorHandler } from './ProductionErrorHandler';
import { messagePersistenceService } from './MessagePersistenceService';
import { networkAnalyticsService } from './NetworkAnalyticsService';

export interface ChannelTransmission {
  id: string;
  senderId: string;
  channel: number;
  content: string | ArrayBuffer;
  type: 'voice' | 'text';
  timestamp: number;
  signalStrength: number;
  encrypted?: boolean;
  routeInfo?: {
    hops: number;
    latency: number;
    transport: string;
  };
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
    signalQuality: 'none',
    networkMetrics: {
      totalPeers: 0,
      activePeers: 0,
      averageLatency: 0,
      networkReliability: 0,
      availableTransports: []
    }
  };
  private statusListeners: Set<(status: DeviceStatus) => void> = new Set();
  private transmissionHistory: Map<string, ChannelTransmission> = new Map();
  private discoveryChannel: BroadcastChannel | null = null;
  private encryptionService: EncryptionService | null = null;
  private routingService: AdaptiveRoutingService | null = null;

  constructor() {
    this.initializeService();
    this.setupProductionFeatures();
    this.setupEmergencyHandling();
  }

  private setupProductionFeatures() {
    // Set up message retry handling
    window.addEventListener('mesh-retry-message', (event: any) => {
      const { messageId } = event.detail;
      this.retryFailedMessage(messageId);
    });

    // Set up error logging for critical operations
    this.setupErrorLogging();
  }

  private setupErrorLogging() {
    // Override console.error to capture errors
    const originalError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('mesh') || message.includes('network') || message.includes('audio')) {
        productionErrorHandler.logError('system', message, undefined, {
          args: args.filter(arg => typeof arg !== 'object')
        });
      }
      originalError.apply(console, args);
    };
  }

  private async retryFailedMessage(messageId: string) {
    try {
      const canRetry = messagePersistenceService.retryFailedMessage(messageId);
      if (canRetry) {
        networkAnalyticsService.recordEvent('message', false, { 
          retry: true, 
          messageId 
        });
      }
    } catch (error) {
      productionErrorHandler.logError('system', 'Failed to retry message', error as Error, { messageId });
    }
  }

  private async initializeService() {
    this.deviceId = this.generateDeviceId();
    this.isNativeEnvironment = window.navigator.userAgent.includes('Capacitor');

    // Initialize encryption service
    this.encryptionService = createEncryptionService(this.deviceId);
    await this.encryptionService.initialize();

    // Initialize adaptive routing
    this.routingService = createAdaptiveRoutingService(this.deviceId);

    // Initialize network discovery
    await this.initializeNetworkDiscovery();

    if (this.isNativeEnvironment) {
      await this.initializeNative();
    } else {
      await this.initializeWeb();
    }

    this.setupNetworkListeners();
    this.startPeriodicUpdates();
  }

  private async initializeNetworkDiscovery() {
    // Set up network discovery event listeners
    networkDiscoveryService.on('peer-discovered', (peer: DiscoveredPeer) => {
      this.handlePeerDiscovered(peer);
    });

    networkDiscoveryService.on('peer-lost', (peerId: string) => {
      this.handlePeerLost(peerId);
    });

    networkDiscoveryService.on('transports-optimized', (transports) => {
      this.updateNetworkMetrics();
    });

    // Start network discovery
    await networkDiscoveryService.startDiscovery();
  }

  private async initializeNative() {
    try {
      await MeshNetworking.startNetwork();
      
      MeshNetworking.addListener('peerDiscovered', (peer: MeshPeer) => {
        // Convert MeshPeer to DiscoveredPeer format
        const discoveredPeer: DiscoveredPeer = {
          id: peer.id,
          name: peer.name || `Peer-${peer.id.slice(-6)}`,
          transport: 'webrtc', // Default transport for native peers
          address: (peer as any).address || 'native',
          signalStrength: 80,
          capabilities: (peer as any).capabilities || ['voice', 'text'],
          lastSeen: Date.now(),
          isReachable: true
        };
        this.handlePeerDiscovered(discoveredPeer);
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
        this.handlePeerDiscovered(event.data);
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

  private handlePeerDiscovered(peer: DiscoveredPeer) {
    try {
      this.addPeerToChannel(this.activeChannel, peer.id);
      
      // Add route to routing table
      if (this.routingService) {
        this.routingService.addRoute(peer.id, peer.id, {
          latency: 100 - peer.signalStrength,
          reliability: peer.signalStrength,
          transport: peer.transport,
          bandwidth: this.estimateBandwidth(peer.transport)
        });
      }

      // Record analytics
      networkAnalyticsService.recordEvent('discovery', true, {
        transport: peer.transport,
        signalStrength: peer.signalStrength
      }, peer.id, peer.transport, undefined, undefined, peer.signalStrength);

      console.log(`Peer discovered: ${peer.name} (${peer.id}) via ${peer.transport}`);
    } catch (error) {
      productionErrorHandler.logError('network', 'Failed to handle peer discovery', error as Error, {
        peerId: peer.id,
        transport: peer.transport
      });
    }
  }

  private estimateBandwidth(transport: string): number {
    switch (transport) {
      case 'webrtc': return 2000000; // 2Mbps
      case 'websocket': return 1000000; // 1Mbps
      case 'bluetooth': return 100000; // 100Kbps
      case 'mdns': return 10000000; // 10Mbps (local network)
      default: return 500000; // 500Kbps
    }
  }

  private handlePeerLost(peerId: string) {
    try {
      this.peersByChannel.forEach((peers, channel) => {
        peers.delete(peerId);
        if (peers.size === 0) {
          this.peersByChannel.delete(channel);
        }
      });

      // Record analytics
      networkAnalyticsService.recordEvent('disconnection', true, {}, peerId);

      this.updateNetworkMetrics();
    } catch (error) {
      productionErrorHandler.logError('network', 'Failed to handle peer loss', error as Error, {
        peerId
      });
    }
  }

  private addPeerToChannel(channel: number, peerId: string) {
    if (!this.peersByChannel.has(channel)) {
      this.peersByChannel.set(channel, new Set());
    }
    this.peersByChannel.get(channel)!.add(peerId);
    this.updateNetworkMetrics();
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.deviceStatus.isOnline = true;
      this.updateNetworkMetrics();
      this.notifyStatusListeners();
    });

    window.addEventListener('offline', () => {
      this.deviceStatus.isOnline = false;
      this.updateNetworkMetrics();
      this.notifyStatusListeners();
    });
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

  private updateNetworkMetrics() {
    const discoveredPeers = networkDiscoveryService.getDiscoveredPeers();
    const availableTransports = networkDiscoveryService.getAvailableTransports();
    const routingMetrics = this.routingService?.getRouteMetrics();
    const connectionMetrics = connectionPoolService.getMetrics();

    this.deviceStatus.networkMetrics = {
      totalPeers: discoveredPeers.length,
      activePeers: discoveredPeers.filter(p => p.isReachable).length,
      averageLatency: routingMetrics?.averageLatency || connectionMetrics.averageLatency,
      networkReliability: routingMetrics?.networkReliability || 95,
      availableTransports: availableTransports.filter(t => t.isAvailable).map(t => t.type)
    };

    // Update signal quality based on network metrics
    const activePeers = this.deviceStatus.networkMetrics.activePeers;
    const reliability = this.deviceStatus.networkMetrics.networkReliability;

    if (activePeers >= 3 && reliability >= 90) {
      this.deviceStatus.signalQuality = 'excellent';
    } else if (activePeers >= 2 && reliability >= 75) {
      this.deviceStatus.signalQuality = 'good';
    } else if (activePeers >= 1 && reliability >= 50) {
      this.deviceStatus.signalQuality = 'poor';
    } else {
      this.deviceStatus.signalQuality = 'none';
    }
  }

  private startPeriodicUpdates() {
    setInterval(() => {
      this.updateNetworkMetrics();
      this.notifyStatusListeners();
    }, 5000);
  }

  private notifyStatusListeners() {
    this.statusListeners.forEach(listener => listener(this.deviceStatus));
  }

  // Public API
  public setChannel(channel: number) {
    if (channel >= 1 && channel <= 99) {
      this.activeChannel = channel;
      this.updateNetworkMetrics();
      
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

  // Enhanced transmission methods with routing and connection pooling
  public async transmitText(text: string, encrypt: boolean = false, priority: 'low' | 'normal' | 'high' | 'emergency' = 'normal'): Promise<boolean> {
    const startTime = performance.now();
    const messageId = `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Store message for persistence
      messagePersistenceService.storeMessage(
        messageId,
        this.deviceId,
        this.activeChannel,
        text,
        'text',
        encrypt,
        priority,
        undefined,
        priority === 'emergency' ? undefined : 24 * 60 * 60 * 1000 // 24 hour expiry for non-emergency
      );

      let success = false;

      if (encrypt && this.encryptionService) {
        success = await this.transmitEncryptedText(text, priority);
      } else {
        const qos: QualityOfService = {
          priority,
          maxLatency: priority === 'emergency' ? 100 : priority === 'high' ? 200 : 1000,
          minBandwidth: 10000,
          requiresEncryption: encrypt,
          allowRetransmission: priority !== 'emergency'
        };

        const messageData = {
          id: messageId,
          senderId: this.deviceId,
          channel: this.activeChannel,
          content: text,
          type: 'text',
          timestamp: Date.now(),
          priority
        };

        if (this.isNativeEnvironment) {
          const message: MeshMessage = {
            id: messageId,
            sender: this.deviceId,
            destination: 'broadcast',
            payload: JSON.stringify({ channel: this.activeChannel, text }),
            timestamp: Date.now(),
            hops: 0,
            type: 'text',
            maxHops: priority === 'emergency' ? 10 : 5
          };
          
          const result = await MeshNetworking.sendMessage({ message });
          success = result.success;
        } else {
          success = await this.broadcastToOptimalPeers(messageData, qos);
          
          if (this.discoveryChannel) {
            this.discoveryChannel.postMessage({ type: 'message', ...messageData });
          }
        }
      }

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Update metrics and analytics
      productionErrorHandler.updateMetrics(responseTime, success);
      networkAnalyticsService.recordEvent('message', success, {
        type: 'text',
        priority,
        encrypted: encrypt,
        responseTime
      });

      if (success) {
        messagePersistenceService.markDelivered(messageId, responseTime);
      }

      return success;
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      productionErrorHandler.logError('network', 'Text transmission failed', error as Error, {
        messageId,
        priority,
        encrypted: encrypt,
        responseTime
      });

      productionErrorHandler.updateMetrics(responseTime, false);
      networkAnalyticsService.recordEvent('message', false, {
        type: 'text',
        priority,
        encrypted: encrypt,
        error: (error as Error).message
      });

      return false;
    }
  }

  private async broadcastToOptimalPeers(messageData: any, qos: QualityOfService): Promise<boolean> {
    const discoveredPeers = networkDiscoveryService.getDiscoveredPeers();
    const successfulTransmissions: string[] = [];

    for (const peer of discoveredPeers) {
      try {
        // Get best route to peer
        const route = this.routingService?.getBestRoute(peer.id, qos);
        if (!route) continue;

        // Get or create connection
        const connection = await connectionPoolService.acquireConnection(
          peer.id, 
          route.transport as any
        );
        
        if (connection) {
          const success = await connectionPoolService.sendMessage(peer.id, messageData);
          if (success) {
            successfulTransmissions.push(peer.id);
          }
        }
      } catch (error) {
        console.warn(`Failed to transmit to peer ${peer.id}:`, error);
      }
    }

    return successfulTransmissions.length > 0;
  }

  private async transmitEncryptedText(text: string, priority: 'low' | 'normal' | 'high' | 'emergency' = 'normal'): Promise<boolean> {
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
        senderPublicKey: Array.from(new Uint8Array(encryptedMessage.senderPublicKey)),
        priority
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

  public async transmitVoice(audioData: ArrayBuffer, encrypt: boolean = false, priority: 'normal' | 'high' | 'emergency' = 'normal'): Promise<boolean> {
    const startTime = performance.now();
    const messageId = `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Store voice message for persistence (with shorter expiry due to size)
      messagePersistenceService.storeMessage(
        messageId,
        this.deviceId,
        this.activeChannel,
        audioData,
        'voice',
        encrypt,
        priority,
        undefined,
        priority === 'emergency' ? undefined : 2 * 60 * 60 * 1000 // 2 hour expiry for voice
      );

      let success = false;

      if (encrypt && this.encryptionService) {
        success = await this.transmitEncryptedVoice(audioData, priority);
      } else {
        const qos: QualityOfService = {
          priority,
          maxLatency: priority === 'emergency' ? 150 : 300,
          minBandwidth: 64000,
          requiresEncryption: encrypt,
          allowRetransmission: false
        };

        if (this.isNativeEnvironment) {
          const message: MeshMessage = {
            id: messageId,
            sender: this.deviceId,
            destination: 'broadcast',
            payload: new Uint8Array(audioData),
            timestamp: Date.now(),
            hops: 0,
            type: 'voice',
            maxHops: priority === 'emergency' ? 10 : 5
          };
          
          const result = await MeshNetworking.sendMessage({ message });
          success = result.success;
        } else {
          const uint8Array = new Uint8Array(audioData);
          const base64Audio = btoa(String.fromCharCode(...uint8Array));
          
          const voiceData = {
            id: messageId,
            senderId: this.deviceId,
            channel: this.activeChannel,
            type: 'voice',
            audioData: base64Audio,
            timestamp: Date.now(),
            priority
          };

          success = await this.broadcastToOptimalPeers(voiceData, qos);

          if (this.discoveryChannel) {
            this.discoveryChannel.postMessage({ type: 'voice', ...voiceData });
          }
        }
      }

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Update metrics and analytics
      productionErrorHandler.updateMetrics(responseTime, success);
      networkAnalyticsService.recordEvent('message', success, {
        type: 'voice',
        priority,
        encrypted: encrypt,
        audioSize: audioData.byteLength,
        responseTime
      });

      if (success) {
        messagePersistenceService.markDelivered(messageId, responseTime);
      }

      return success;
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      productionErrorHandler.logError('audio', 'Voice transmission failed', error as Error, {
        messageId,
        priority,
        encrypted: encrypt,
        audioSize: audioData.byteLength,
        responseTime
      });

      productionErrorHandler.updateMetrics(responseTime, false);
      networkAnalyticsService.recordEvent('message', false, {
        type: 'voice',
        priority,
        encrypted: encrypt,
        error: (error as Error).message
      });

      return false;
    }
  }

  private async transmitEncryptedVoice(audioData: ArrayBuffer, priority: 'normal' | 'high' | 'emergency' = 'normal'): Promise<boolean> {
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
        senderPublicKey: Array.from(new Uint8Array(encryptedMessage.senderPublicKey)),
        priority
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

  // Enhanced network information methods
  public getNetworkStatus() {
    try {
      return {
        deviceMetrics: this.deviceStatus,
        discoveredPeers: networkDiscoveryService.getDiscoveredPeers(),
        availableTransports: networkDiscoveryService.getAvailableTransports(),
        routingMetrics: this.routingService?.getRouteMetrics(),
        connectionMetrics: connectionPoolService.getMetrics(),
        systemMetrics: productionErrorHandler.getMetrics(),
        messageStats: messagePersistenceService.getStats(),
        networkAnalytics: networkAnalyticsService.getAnalytics()
      };
    } catch (error) {
      productionErrorHandler.logError('system', 'Failed to get network status', error as Error);
      return {
        deviceMetrics: this.deviceStatus,
        discoveredPeers: [],
        availableTransports: [],
        routingMetrics: null,
        connectionMetrics: { activeConnections: 0, totalConnections: 0, averageLatency: 0 },
        systemMetrics: productionErrorHandler.getMetrics(),
        messageStats: messagePersistenceService.getStats(),
        networkAnalytics: networkAnalyticsService.getAnalytics()
      };
    }
  }

  public async optimizeNetwork(): Promise<void> {
    // Trigger network optimization
    this.updateNetworkMetrics();
    
    // Force route recalculation
    if (this.routingService) {
      const discoveredPeers = networkDiscoveryService.getDiscoveredPeers();
      for (const peer of discoveredPeers) {
        this.routingService.addRoute(peer.id, peer.id, {
          latency: 100 - peer.signalStrength,
          reliability: peer.signalStrength,
          transport: peer.transport,
          bandwidth: this.estimateBandwidth(peer.transport)
        });
      }
    }
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
      
      await networkDiscoveryService.stopDiscovery();
      this.routingService?.shutdown();
      connectionPoolService.shutdown();
      messagePersistenceService.shutdown();
      networkAnalyticsService.shutdown();
      
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
      productionErrorHandler.logError('system', 'Shutdown failed', error as Error);
    }
  }

  private setupEmergencyHandling() {
    // Listen for emergency beacon events
    document.addEventListener('emergency-beacon-sent', (event: any) => {
      const { beacon, alert } = event.detail;
      this.broadcastEmergencyBeacon(beacon, alert);
    });

    document.addEventListener('emergency-beacon-retransmit', (event: any) => {
      const { beacon } = event.detail;
      this.retransmitEmergencyBeacon(beacon);
    });
  }

  private async broadcastEmergencyBeacon(beacon: any, alert: any) {
    try {
      const emergencyMessage = {
        type: 'emergency-beacon',
        beacon,
        alert,
        timestamp: Date.now()
      };

      // Broadcast with highest priority
      await this.transmitText(
        JSON.stringify(emergencyMessage),
        true, // encrypted
        'emergency' // highest priority
      );

      console.log('Emergency beacon broadcasted:', beacon.id);
    } catch (error) {
      productionErrorHandler.logError('emergency', 'Failed to broadcast emergency beacon', error as Error, {
        beaconId: beacon.id
      });
    }
  }

  private async retransmitEmergencyBeacon(beacon: any) {
    try {
      const retransmissionMessage = {
        type: 'emergency-retransmission',
        beacon,
        retransmissionCount: beacon.retransmissionCount,
        timestamp: Date.now()
      };

      await this.transmitText(
        JSON.stringify(retransmissionMessage),
        true,
        'emergency'
      );

      console.log(`Emergency beacon retransmitted (${beacon.retransmissionCount}/10):`, beacon.id);
    } catch (error) {
      productionErrorHandler.logError('emergency', 'Failed to retransmit emergency beacon', error as Error, {
        beaconId: beacon.id,
        retransmissionCount: beacon.retransmissionCount
      });
    }
  }
}

export const unifiedMeshService = new UnifiedMeshService();
