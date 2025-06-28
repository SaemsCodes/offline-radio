import { EventEmitter } from 'events';

export interface DiscoveredPeer {
  id: string;
  name: string;
  transport: string;
  address: string;
  signalStrength: number;
  capabilities: string[];
  lastSeen: number;
  isReachable: boolean;
}

export interface NetworkTransport {
  type: string;
  isAvailable: boolean;
  lastSeen: number;
  capabilities: string[];
}

class NetworkDiscoveryService extends EventEmitter {
  private discoveredPeers: Map<string, DiscoveredPeer> = new Map();
  private availableTransports: NetworkTransport[] = [
    { type: 'webrtc', isAvailable: false, lastSeen: 0, capabilities: ['voice', 'text', 'file'] },
    { type: 'websocket', isAvailable: false, lastSeen: 0, capabilities: ['text', 'file'] },
    { type: 'bluetooth', isAvailable: false, lastSeen: 0, capabilities: ['voice', 'text'] },
    { type: 'mdns', isAvailable: false, lastSeen: 0, capabilities: ['discovery'] }
  ];
  private discoveryInterval: NodeJS.Timeout | null = null;
  private optimizationInterval: NodeJS.Timeout | null = null;
  private eventLog: Array<{ timestamp: number; category: string; event: string; metadata: Record<string, any> }> = [];

  constructor() {
    super();
    this.setupTransportDetection();
  }

  private setupTransportDetection() {
    // Detect WebRTC support
    if (typeof RTCPeerConnection !== 'undefined') {
      const transport = this.availableTransports.find(t => t.type === 'webrtc');
      if (transport) {
        transport.isAvailable = true;
        transport.lastSeen = Date.now();
      }
    }

    // Detect WebSocket support
    if (typeof WebSocket !== 'undefined') {
      const transport = this.availableTransports.find(t => t.type === 'websocket');
      if (transport) {
        transport.isAvailable = true;
        transport.lastSeen = Date.now();
      }
    }

    // Detect Bluetooth support
    if ('bluetooth' in navigator) {
      const transport = this.availableTransports.find(t => t.type === 'bluetooth');
      if (transport) {
        transport.isAvailable = true;
        transport.lastSeen = Date.now();
      }
    }

    // mDNS is available in local network environments
    const transport = this.availableTransports.find(t => t.type === 'mdns');
    if (transport) {
      transport.isAvailable = true;
      transport.lastSeen = Date.now();
    }
  }

  async startDiscovery(): Promise<void> {
    this.logEvent('discovery', 'start', { timestamp: Date.now() });

    // Initialize available transports
    await this.initializeMDNSDiscovery();
    await this.initializeWebRTCDiscovery();
    await this.initializeWebSocketDiscovery();
    await this.initializeBluetoothDiscovery();

    // Start periodic discovery
    this.discoveryInterval = setInterval(() => {
      this.performDiscovery();
    }, 10000); // Every 10 seconds

    // Start optimization cycle
    this.optimizationInterval = setInterval(() => {
      this.optimizeTransports();
    }, 30000); // Every 30 seconds

    // Initial discovery
    await this.performDiscovery();
  }

  private async initializeMDNSDiscovery(): Promise<void> {
    try {
      // Simulate mDNS discovery for local network peers
      const mockLocalPeers = [
        {
          id: 'mdns-peer-1',
          name: 'Local Radio 1',
          transport: 'mdns',
          address: '192.168.1.100',
          signalStrength: 95,
          capabilities: ['voice', 'text'],
          lastSeen: Date.now(),
          isReachable: true
        },
        {
          id: 'mdns-peer-2',
          name: 'Local Radio 2',
          transport: 'mdns',
          address: '192.168.1.101',
          signalStrength: 88,
          capabilities: ['voice', 'text'],
          lastSeen: Date.now(),
          isReachable: true
        }
      ];

      // Simulate discovery delay
      setTimeout(() => {
        mockLocalPeers.forEach(peer => this.handleDiscoveredPeer(peer));
      }, 2000);

      this.logEvent('transport', 'mdns-initialized', { peerCount: mockLocalPeers.length });
    } catch (error) {
      this.logEvent('transport', 'mdns-failed', { error: (error as Error).message });
    }
  }

  private async initializeWebRTCDiscovery(): Promise<void> {
    try {
      if (typeof RTCPeerConnection === 'undefined') {
        throw new Error('WebRTC not supported');
      }

      // Set up WebRTC peer discovery through signaling server simulation
      const mockWebRTCPeers = [
        {
          id: 'webrtc-peer-1',
          name: 'Remote Radio Alpha',
          transport: 'webrtc',
          address: 'webrtc://peer-alpha',
          signalStrength: 75,
          capabilities: ['voice', 'text', 'file'],
          lastSeen: Date.now(),
          isReachable: true
        },
        {
          id: 'webrtc-peer-2',
          name: 'Remote Radio Beta',
          transport: 'webrtc',
          address: 'webrtc://peer-beta',
          signalStrength: 62,
          capabilities: ['voice', 'text'],
          lastSeen: Date.now(),
          isReachable: true
        }
      ];

      setTimeout(() => {
        mockWebRTCPeers.forEach(peer => this.handleDiscoveredPeer(peer));
      }, 3000);

      this.logEvent('transport', 'webrtc-initialized', { peerCount: mockWebRTCPeers.length });
    } catch (error) {
      this.logEvent('transport', 'webrtc-failed', { error: (error as Error).message });
    }
  }

  private async initializeWebSocketDiscovery(): Promise<void> {
    try {
      if (typeof WebSocket === 'undefined') {
        throw new Error('WebSocket not supported');
      }

      // Simulate WebSocket server discovery
      const mockWSPeers = [
        {
          id: 'ws-peer-1',
          name: 'Server Radio 1',
          transport: 'websocket',
          address: 'ws://mesh-server:8080',
          signalStrength: 85,
          capabilities: ['text', 'file'],
          lastSeen: Date.now(),
          isReachable: true
        }
      ];

      setTimeout(() => {
        mockWSPeers.forEach(peer => this.handleDiscoveredPeer(peer));
      }, 1500);

      this.logEvent('transport', 'websocket-initialized', { peerCount: mockWSPeers.length });
    } catch (error) {
      this.logEvent('transport', 'websocket-failed', { error: (error as Error).message });
    }
  }

  private async initializeBluetoothDiscovery(): Promise<void> {
    try {
      if (!('bluetooth' in navigator)) {
        throw new Error('Bluetooth not supported');
      }

      // Simulate Bluetooth device discovery
      const mockBTPeers = [
        {
          id: 'bt-peer-1',
          name: 'BT Radio Charlie',
          transport: 'bluetooth',
          address: '00:11:22:33:44:55',
          signalStrength: 45,
          capabilities: ['voice', 'text'],
          lastSeen: Date.now(),
          isReachable: true
        }
      ];

      setTimeout(() => {
        mockBTPeers.forEach(peer => this.handleDiscoveredPeer(peer));
      }, 4000);

      this.logEvent('transport', 'bluetooth-initialized', { peerCount: mockBTPeers.length });
    } catch (error) {
      this.logEvent('transport', 'bluetooth-failed', { error: (error as Error).message });
    }
  }

  private async performDiscovery(): Promise<void> {
    // Simulate ongoing peer discovery
    const now = Date.now();
    
    // Update signal strengths for existing peers
    for (const peer of this.discoveredPeers.values()) {
      // Simulate signal fluctuation
      const fluctuation = (Math.random() - 0.5) * 10;
      peer.signalStrength = Math.max(0, Math.min(100, peer.signalStrength + fluctuation));
      peer.lastSeen = now;
    }

    // Occasionally discover new peers
    if (Math.random() < 0.1) { // 10% chance
      const newPeer: DiscoveredPeer = {
        id: `discovered-${Date.now()}`,
        name: `Radio-${Math.random().toString(36).substr(2, 6)}`,
        transport: ['webrtc', 'websocket', 'bluetooth'][Math.floor(Math.random() * 3)],
        address: `addr-${Math.random().toString(36).substr(2, 8)}`,
        signalStrength: Math.floor(Math.random() * 100),
        capabilities: ['voice', 'text'],
        lastSeen: now,
        isReachable: true
      };
      this.handleDiscoveredPeer(newPeer);
    }

    this.logEvent('discovery', 'cycle-complete', { 
      peerCount: this.discoveredPeers.size,
      timestamp: now 
    });
  }

  private handleDiscoveredPeer(peer: DiscoveredPeer): void {
    const existingPeer = this.discoveredPeers.get(peer.id);
    
    if (existingPeer) {
      // Update existing peer
      existingPeer.lastSeen = Date.now();
      existingPeer.signalStrength = peer.signalStrength;
      existingPeer.isReachable = peer.isReachable;
    } else {
      // Add new peer
      this.discoveredPeers.set(peer.id, peer);
      this.emit('peer-discovered', peer);
    }

    // Update transport availability
    const transport = this.availableTransports.find(t => t.type === peer.transport);
    if (transport) {
      transport.lastSeen = Date.now();
      transport.isAvailable = true;
    }
  }

  private optimizeTransports(): void {
    const now = Date.now();
    const STALE_THRESHOLD = 60000; // 60 seconds

    // Remove stale peers
    for (const [peerId, peer] of this.discoveredPeers.entries()) {
      if (now - peer.lastSeen > STALE_THRESHOLD) {
        this.discoveredPeers.delete(peerId);
        this.emit('peer-lost', peerId);
      }
    }

    // Update transport availability
    this.availableTransports.forEach(transport => {
      transport.isAvailable = now - transport.lastSeen < STALE_THRESHOLD;
    });

    this.emit('transports-optimized', this.availableTransports);
  }

  getDiscoveredPeers(): DiscoveredPeer[] {
    return Array.from(this.discoveredPeers.values());
  }

  getAvailableTransports(): NetworkTransport[] {
    return [...this.availableTransports];
  }

  getPeerById(peerId: string): DiscoveredPeer | undefined {
    return this.discoveredPeers.get(peerId);
  }

  async testConnection(peerId: string): Promise<boolean> {
    const peer = this.discoveredPeers.get(peerId);
    if (!peer) {
      return false;
    }

    try {
      // Simplified connection test
      const testData = JSON.stringify({ type: 'ping', timestamp: Date.now() });
      
      // In a real implementation, this would test the actual connection
      // For now, we'll simulate based on signal strength
      const success = peer.signalStrength > 30 && peer.isReachable;
      
      if (success) {
        peer.lastSeen = Date.now();
        peer.isReachable = true;
      }
      
      return success;
    } catch (error) {
      console.error(`Connection test failed for peer ${peerId}:`, error);
      peer.isReachable = false;
      return false;
    }
  }

  private logEvent(category: string, event: string, metadata: Record<string, any> = {}): void {
    const logEntry = {
      timestamp: Date.now(),
      category,
      event,
      metadata: metadata as Record<string, any>
    };
    
    this.eventLog.push(logEntry);
    
    // Keep only recent events
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-500);
    }
  }

  getEventLog(): Array<{ timestamp: number; category: string; event: string; metadata: Record<string, any> }> {
    return [...this.eventLog];
  }

  async stopDiscovery(): Promise<void> {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }

    this.logEvent('discovery', 'stop', { timestamp: Date.now() });
  }

  shutdown(): void {
    this.stopDiscovery();
    this.discoveredPeers.clear();
    this.eventLog = [];
    this.removeAllListeners();
  }
}

export const networkDiscoveryService = new NetworkDiscoveryService();
