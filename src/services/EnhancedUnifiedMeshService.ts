
import { unifiedMeshService } from './UnifiedMeshService';
import { messagePersistenceService } from './MessagePersistenceService';
import { networkAnalyticsService } from './NetworkAnalyticsService';
import { meshNetworkCore } from './MeshNetworkCore';

export interface EnhancedDeviceStatus {
  batteryLevel: number;
  isOnline: boolean;
  isWifiConnected: boolean;
  isBluetoothEnabled: boolean;
  volume: number;
  signalQuality: 'excellent' | 'good' | 'poor' | 'none';
  location?: { lat: number; lng: number };
  networkMetrics: {
    totalPeers: number;
    activePeers: number;
    averageLatency: number;
    networkReliability: number;
    availableTransports: string[];
  };
}

export interface EnhancedTransmission {
  id: string;
  senderId: string;
  channel: number;
  content: string | ArrayBuffer;
  type: 'voice' | 'text' | 'emergency';
  timestamp: number;
  signalStrength: number;
  isEncrypted: boolean;
  audioQuality?: 'excellent' | 'good' | 'fair' | 'poor';
}

class EnhancedUnifiedMeshService {
  private activeChannel: number = 1;
  private isEmergencyMode: boolean = false;
  private deviceLocation: { lat: number; lng: number } | null = null;
  private transmissionListeners: Set<(transmission: EnhancedTransmission) => void> = new Set();
  private statusListeners: Set<(status: EnhancedDeviceStatus) => void> = new Set();

  constructor() {
    this.initializeService();
    this.setupLocationTracking();
    this.setupMeshIntegration();
  }

  private async initializeService() {
    // Initialize mesh network core
    meshNetworkCore.startNetwork();

    // Set up event listeners for mesh events
    meshNetworkCore.on('messageReceived', (packet: any) => {
      this.handleMeshMessage(packet);
    });

    meshNetworkCore.on('nodeDiscovered', (node: any) => {
      networkAnalyticsService.recordEvent(
        'discovery',
        true,
        { nodeId: node.id, capabilities: node.capabilities },
        node.id,
        'mesh',
        undefined,
        undefined,
        node.signalStrength
      );
    });

    // Initialize device registration
    await this.registerDevice();
  }

  private async registerDevice() {
    try {
      const success = await messagePersistenceService.registerDevice({
        device_name: `Radio-${Date.now().toString().slice(-4)}`,
        device_type: 'mesh-radio',
        capabilities: ['voice', 'text', 'emergency', 'mesh'],
        battery_level: this.getBatteryLevel(),
        encryption_public_key: 'generated-key'
      });
      
      if (success) {
        console.log('Device registered successfully');
      }
    } catch (error) {
      console.error('Device registration failed:', error);
    }
  }

  private setupLocationTracking() {
    if ('geolocation' in navigator) {
      navigator.geolocation.watchPosition(
        (position) => {
          this.deviceLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
        },
        (error) => {
          console.warn('Location tracking error:', error);
        },
        { enableHighAccuracy: true, maximumAge: 30000 }
      );
    }
  }

  private setupMeshIntegration() {
    // Integrate with existing unified mesh service
    unifiedMeshService.onDeviceStatusChange((status) => {
      this.notifyStatusListeners();
    });
  }

  private handleMeshMessage(packet: any) {
    const transmission: EnhancedTransmission = {
      id: packet.id,
      senderId: packet.source,
      channel: this.activeChannel,
      content: packet.payload,
      type: packet.type,
      timestamp: packet.timestamp,
      signalStrength: this.calculateSignalStrength(packet),
      isEncrypted: false,
      audioQuality: packet.type === 'voice' ? this.calculateAudioQuality(packet) : undefined
    };

    // Save to database
    this.saveTransmissionToDatabase(transmission);

    // Notify listeners
    this.transmissionListeners.forEach(listener => listener(transmission));

    // Record analytics
    networkAnalyticsService.recordEvent(
      'message',
      true,
      { messageType: packet.type },
      packet.source,
      'mesh',
      packet.latency,
      packet.bandwidth,
      transmission.signalStrength
    );
  }

  private async saveTransmissionToDatabase(transmission: EnhancedTransmission) {
    try {
      await messagePersistenceService.saveMessage({
        device_id: messagePersistenceService.getDeviceId(),
        channel: transmission.channel,
        content: typeof transmission.content === 'string' ? transmission.content : '[Binary Data]',
        message_type: transmission.type,
        is_encrypted: transmission.isEncrypted,
        signal_strength: transmission.signalStrength,
        audio_data: transmission.type === 'voice' && transmission.content instanceof ArrayBuffer 
          ? this.arrayBufferToBase64(transmission.content) 
          : undefined
      });
    } catch (error) {
      console.error('Failed to save transmission to database:', error);
    }
  }

  private calculateSignalStrength(packet: any): number {
    const baseStrength = 100;
    const hopPenalty = (packet.route?.length || 1) * 10;
    return Math.max(10, Math.min(100, baseStrength - hopPenalty));
  }

  private calculateAudioQuality(packet: any): 'excellent' | 'good' | 'fair' | 'poor' {
    const signalStrength = this.calculateSignalStrength(packet);
    if (signalStrength > 80) return 'excellent';
    if (signalStrength > 60) return 'good';
    if (signalStrength > 40) return 'fair';
    return 'poor';
  }

  private getBatteryLevel(): number {
    // Simulate battery level - in real app this would come from native plugin
    return Math.max(10, 100 - (Date.now() % 100000) / 1000);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private notifyStatusListeners() {
    const status = this.getEnhancedDeviceStatus();
    this.statusListeners.forEach(listener => listener(status));
  }

  // Public API
  public setChannel(channel: number) {
    if (channel >= 1 && channel <= 99) {
      this.activeChannel = channel;
      console.log(`Enhanced mesh service switched to channel ${channel}`);
    }
  }

  public getCurrentChannel(): number {
    return this.activeChannel;
  }

  public async transmitVoice(audioData: ArrayBuffer): Promise<boolean> {
    try {
      const messageId = meshNetworkCore.sendMessage('voice', audioData);
      
      if (messageId) {
        // Record local transmission
        const transmission: EnhancedTransmission = {
          id: messageId,
          senderId: 'local',
          channel: this.activeChannel,
          content: audioData,
          type: 'voice',
          timestamp: Date.now(),
          signalStrength: 100,
          isEncrypted: false,
          audioQuality: 'excellent'
        };

        await this.saveTransmissionToDatabase(transmission);
        
        networkAnalyticsService.recordEvent(
          'message',
          true,
          { messageType: 'voice', localTransmission: true },
          'local',
          'mesh'
        );

        return true;
      }
      return false;
    } catch (error) {
      console.error('Voice transmission failed:', error);
      return false;
    }
  }

  public async transmitText(text: string): Promise<boolean> {
    try {
      const messageId = meshNetworkCore.sendMessage('text', { text });
      
      if (messageId) {
        const transmission: EnhancedTransmission = {
          id: messageId,
          senderId: 'local',
          channel: this.activeChannel,
          content: text,
          type: 'text',
          timestamp: Date.now(),
          signalStrength: 100,
          isEncrypted: false
        };

        await this.saveTransmissionToDatabase(transmission);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Text transmission failed:', error);
      return false;
    }
  }

  public async sendEmergencyBeacon(message?: string): Promise<boolean> {
    if (!this.deviceLocation) {
      console.warn('Cannot send emergency beacon without location');
      return false;
    }

    try {
      const success = await messagePersistenceService.sendEmergencyBeacon(
        this.deviceLocation,
        message || 'Emergency situation - immediate assistance required'
      );

      if (success) {
        // Also broadcast via mesh
        const emergencyMessage = meshNetworkCore.sendMessage('emergency', {
          location: this.deviceLocation,
          message: message || 'Emergency situation',
          timestamp: Date.now()
        });

        this.isEmergencyMode = true;
        this.notifyStatusListeners();

        return !!emergencyMessage;
      }
      return false;
    } catch (error) {
      console.error('Emergency beacon failed:', error);
      return false;
    }
  }

  public getEnhancedDeviceStatus(): EnhancedDeviceStatus {
    const baseStatus = unifiedMeshService.getDeviceStatus();
    const meshStats = meshNetworkCore.getNetworkStats();
    const analytics = networkAnalyticsService.getAnalytics();

    return {
      ...baseStatus,
      location: this.deviceLocation,
      networkMetrics: {
        totalPeers: meshStats.discoveredNodes,
        activePeers: meshStats.discoveredNodes,
        averageLatency: analytics.averageLatency,
        networkReliability: analytics.successRate,
        availableTransports: ['mesh', 'wifi-direct', 'bluetooth']
      }
    };
  }

  public onTransmission(listener: (transmission: EnhancedTransmission) => void) {
    this.transmissionListeners.add(listener);
    return () => this.transmissionListeners.delete(listener);
  }

  public onStatusChange(listener: (status: EnhancedDeviceStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.getEnhancedDeviceStatus());
    return () => this.statusListeners.delete(listener);
  }

  public getPeersOnCurrentChannel(): number {
    return meshNetworkCore.getDiscoveredNodes().length;
  }

  public toggleEmergencyMode(): boolean {
    this.isEmergencyMode = !this.isEmergencyMode;
    this.notifyStatusListeners();
    return this.isEmergencyMode;
  }

  public getEmergencyMode(): boolean {
    return this.isEmergencyMode;
  }

  public async factoryReset(): Promise<void> {
    // Clear all stored data
    localStorage.removeItem('orad-device-id');
    localStorage.removeItem('orad-offline-messages');
    localStorage.removeItem('orad-radio-settings');
    
    // Reset services
    meshNetworkCore.shutdown();
    networkAnalyticsService.clearAnalytics();
    
    // Reinitialize
    await this.initializeService();
    
    console.log('Factory reset completed');
  }
}

export const enhancedUnifiedMeshService = new EnhancedUnifiedMeshService();
