
import { EventEmitter } from 'events';

export interface DiscoveredPeer {
  id: string;
  name: string;
  transport: 'webrtc' | 'websocket' | 'bluetooth' | 'mdns';
  address: string;
  port?: number;
  signalStrength: number;
  capabilities: string[];
  lastSeen: number;
  isReachable: boolean;
}

export interface NetworkTransport {
  type: 'webrtc' | 'websocket' | 'bluetooth' | 'mdns';
  isAvailable: boolean;
  quality: number; // 0-100
  latency: number;
  bandwidth: number;
  batteryImpact: 'low' | 'medium' | 'high';
}

export class NetworkDiscoveryService extends EventEmitter {
  private discoveredPeers: Map<string, DiscoveredPeer> = new Map();
  private availableTransports: Map<string, NetworkTransport> = new Map();
  private discoveryInterval: number | null = null;
  private isDiscovering: boolean = false;
  private bluetoothAdvertising: boolean = false;
  private mdnsService: any = null;

  constructor() {
    super();
    this.initializeTransports();
  }

  private async initializeTransports() {
    // Initialize WebRTC transport
    if (window.RTCPeerConnection) {
      this.availableTransports.set('webrtc', {
        type: 'webrtc',
        isAvailable: true,
        quality: 95,
        latency: 50,
        bandwidth: 1000000, // 1Mbps
        batteryImpact: 'medium'
      });
    }

    // Initialize WebSocket transport
    this.availableTransports.set('websocket', {
      type: 'websocket',
      isAvailable: true,
      quality: 85,
      latency: 100,
      bandwidth: 500000, // 500Kbps
      batteryImpact: 'low'
    });

    // Check Bluetooth LE availability
    if ('bluetooth' in navigator && navigator.bluetooth) {
      try {
        const bluetooth = navigator.bluetooth as any;
        const isAvailable = bluetooth.getAvailability ? await bluetooth.getAvailability() : false;
        this.availableTransports.set('bluetooth', {
          type: 'bluetooth',
          isAvailable,
          quality: 70,
          latency: 200,
          bandwidth: 100000, // 100Kbps
          batteryImpact: 'high'
        });
      } catch (error) {
        console.warn('Bluetooth not available:', error);
      }
    }

    // Initialize mDNS/Bonjour service discovery (simulated for web)
    this.initializeMDNS();

    this.emit('transports-initialized', Array.from(this.availableTransports.values()));
  }

  private initializeMDNS() {
    // In a real implementation, this would use native mDNS/Bonjour
    // For web, we simulate service discovery via broadcast channels
    this.availableTransports.set('mdns', {
      type: 'mdns',
      isAvailable: true,
      quality: 90,
      latency: 25,
      bandwidth: 10000000, // 10Mbps (local network)
      batteryImpact: 'low'
    });

    // Simulate mDNS service registration
    const serviceChannel = new BroadcastChannel('mdns-service-discovery');
    
    serviceChannel.onmessage = (event) => {
      if (event.data.type === 'service-announcement') {
        this.handleMDNSPeerDiscovery(event.data);
      }
    };

    // Announce our service
    serviceChannel.postMessage({
      type: 'service-announcement',
      serviceId: `mesh-radio-${Math.random().toString(36).substr(2, 9)}`,
      serviceName: 'Mesh Radio Service',
      transport: 'mdns',
      capabilities: ['voice', 'text', 'encryption'],
      timestamp: Date.now()
    });
  }

  private handleMDNSPeerDiscovery(data: any) {
    if (data.serviceId === this.getOwnServiceId()) return;

    const peer: DiscoveredPeer = {
      id: data.serviceId,
      name: data.serviceName,
      transport: 'mdns',
      address: 'local',
      signalStrength: 95,
      capabilities: data.capabilities || [],
      lastSeen: Date.now(),
      isReachable: true
    };

    this.discoveredPeers.set(peer.id, peer);
    this.emit('peer-discovered', peer);
  }

  private getOwnServiceId(): string {
    return `mesh-radio-${window.location.hostname}`;
  }

  async startDiscovery(): Promise<void> {
    if (this.isDiscovering) return;

    this.isDiscovering = true;
    console.log('Starting network discovery...');

    // Start WebRTC peer discovery
    this.startWebRTCDiscovery();

    // Start Bluetooth LE discovery
    await this.startBluetoothDiscovery();

    // Start periodic discovery updates
    this.discoveryInterval = window.setInterval(() => {
      this.updatePeerReachability();
      this.optimizeTransports();
    }, 5000);

    this.emit('discovery-started');
  }

  private startWebRTCDiscovery() {
    const webrtcChannel = new BroadcastChannel('webrtc-peer-discovery');
    
    webrtcChannel.postMessage({
      type: 'peer-announcement',
      peerId: this.getOwnServiceId(),
      transport: 'webrtc',
      capabilities: ['voice', 'text', 'file-transfer'],
      timestamp: Date.now()
    });

    webrtcChannel.onmessage = (event) => {
      if (event.data.type === 'peer-announcement' && event.data.peerId !== this.getOwnServiceId()) {
        const peer: DiscoveredPeer = {
          id: event.data.peerId,
          name: `WebRTC Peer ${event.data.peerId.substr(-6)}`,
          transport: 'webrtc',
          address: 'webrtc',
          signalStrength: 80,
          capabilities: event.data.capabilities || [],
          lastSeen: Date.now(),
          isReachable: true
        };

        this.discoveredPeers.set(peer.id, peer);
        this.emit('peer-discovered', peer);
      }
    };
  }

  private async startBluetoothDiscovery() {
    const bluetoothTransport = this.availableTransports.get('bluetooth');
    if (!bluetoothTransport?.isAvailable) return;

    try {
      // Request Bluetooth LE advertising
      if ('bluetooth' in navigator && 'requestDevice' in navigator.bluetooth) {
        // In a real implementation, this would start BLE advertising
        this.bluetoothAdvertising = true;
        console.log('Bluetooth LE advertising started');
        
        // Simulate discovering Bluetooth peers
        setTimeout(() => {
          const mockBluetoothPeer: DiscoveredPeer = {
            id: 'ble-device-001',
            name: 'Bluetooth Mesh Device',
            transport: 'bluetooth',
            address: 'aa:bb:cc:dd:ee:ff',
            signalStrength: 65,
            capabilities: ['voice', 'emergency'],
            lastSeen: Date.now(),
            isReachable: true
          };

          this.discoveredPeers.set(mockBluetoothPeer.id, mockBluetoothPeer);
          this.emit('peer-discovered', mockBluetoothPeer);
        }, 2000);
      }
    } catch (error) {
      console.warn('Bluetooth discovery failed:', error);
    }
  }

  private updatePeerReachability() {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds

    this.discoveredPeers.forEach((peer, id) => {
      if (now - peer.lastSeen > staleThreshold) {
        peer.isReachable = false;
        peer.signalStrength = Math.max(0, peer.signalStrength - 10);
        
        if (peer.signalStrength === 0) {
          this.discoveredPeers.delete(id);
          this.emit('peer-lost', id);
        } else {
          this.emit('peer-updated', peer);
        }
      }
    });
  }

  private optimizeTransports() {
    const networkMetrics = this.getNetworkMetrics();
    
    // Adjust transport quality based on current conditions
    this.availableTransports.forEach((transport, type) => {
      if (type === 'webrtc' && networkMetrics.packetLoss > 5) {
        transport.quality = Math.max(50, transport.quality - 10);
      } else if (type === 'bluetooth' && networkMetrics.batteryLevel < 20) {
        transport.quality = Math.max(30, transport.quality - 15);
      }
    });

    this.emit('transports-optimized', Array.from(this.availableTransports.values()));
  }

  private getNetworkMetrics() {
    return {
      packetLoss: Math.random() * 2, // 0-2%
      latency: 50 + Math.random() * 100, // 50-150ms
      batteryLevel: 75 + Math.random() * 25, // 75-100%
      signalStrength: 80 + Math.random() * 20 // 80-100%
    };
  }

  async stopDiscovery(): Promise<void> {
    if (!this.isDiscovering) return;

    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    this.isDiscovering = false;
    this.bluetoothAdvertising = false;
    this.discoveredPeers.clear();

    this.emit('discovery-stopped');
    console.log('Network discovery stopped');
  }

  getDiscoveredPeers(): DiscoveredPeer[] {
    return Array.from(this.discoveredPeers.values()).filter(peer => peer.isReachable);
  }

  getAvailableTransports(): NetworkTransport[] {
    return Array.from(this.availableTransports.values());
  }

  getBestTransportForPeer(peerId: string): NetworkTransport | null {
    const peer = this.discoveredPeers.get(peerId);
    if (!peer) return null;

    const transport = this.availableTransports.get(peer.transport);
    return transport || null;
  }

  async connectToPeer(peerId: string, preferredTransport?: string): Promise<boolean> {
    const peer = this.discoveredPeers.get(peerId);
    if (!peer) return false;

    const transport = preferredTransport 
      ? this.availableTransports.get(preferredTransport)
      : this.getBestTransportForPeer(peerId);

    if (!transport) return false;

    try {
      // Simulate connection establishment
      await new Promise(resolve => setTimeout(resolve, transport.latency));
      
      this.emit('peer-connected', { peerId, transport: transport.type });
      return true;
    } catch (error) {
      console.error(`Failed to connect to peer ${peerId}:`, error);
      return false;
    }
  }
}

export const networkDiscoveryService = new NetworkDiscoveryService();
