
export interface MeshNode {
  id: string;
  name: string;
  location?: { lat: number; lng: number };
  signalStrength: number;
  lastSeen: number;
  capabilities: string[];
  batteryLevel: number;
  isRelay: boolean;
}

export interface MeshPacket {
  id: string;
  source: string;
  destination: string;
  type: 'voice' | 'text' | 'emergency' | 'heartbeat' | 'route-discovery';
  payload: any;
  timestamp: number;
  ttl: number;
  route: string[];
  priority: number;
}

export class MeshNetworkCore {
  private nodeId: string;
  private discoveredNodes: Map<string, MeshNode> = new Map();
  private routingTable: Map<string, string[]> = new Map();
  private messageQueue: MeshPacket[] = [];
  private isActive: boolean = false;
  private heartbeatInterval: number | null = null;
  private discoveryInterval: number | null = null;
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.nodeId = `NODE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.initializeAutonomousOperations();
  }

  private initializeAutonomousOperations() {
    // Start heartbeat every 30 seconds
    this.heartbeatInterval = window.setInterval(() => {
      if (this.isActive) {
        this.sendHeartbeat();
      }
    }, 30000);

    // Start node discovery every 15 seconds
    this.discoveryInterval = window.setInterval(() => {
      if (this.isActive) {
        this.performNodeDiscovery();
      }
    }, 15000);

    // Clean up stale nodes every 60 seconds
    setInterval(() => {
      this.cleanupStaleNodes();
    }, 60000);

    // Process message queue continuously
    this.processMessageQueue();
  }

  public startNetwork(): boolean {
    this.isActive = true;
    this.emit('networkStarted', { nodeId: this.nodeId });
    
    // Immediately discover nodes
    this.performNodeDiscovery();
    
    // Add self to discovered nodes
    this.discoveredNodes.set(this.nodeId, {
      id: this.nodeId,
      name: `Radio-${this.nodeId.slice(-4)}`,
      signalStrength: 100,
      lastSeen: Date.now(),
      capabilities: ['voice', 'text', 'emergency'],
      batteryLevel: 100,
      isRelay: true
    });

    return true;
  }

  public stopNetwork() {
    this.isActive = false;
    this.emit('networkStopped', { nodeId: this.nodeId });
  }

  private sendHeartbeat() {
    const heartbeat: MeshPacket = {
      id: `heartbeat-${Date.now()}`,
      source: this.nodeId,
      destination: 'broadcast',
      type: 'heartbeat',
      payload: {
        batteryLevel: this.getBatteryLevel(),
        capabilities: ['voice', 'text', 'emergency'],
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      ttl: 3,
      route: [this.nodeId],
      priority: 1
    };

    this.queueMessage(heartbeat);
  }

  private performNodeDiscovery() {
    // Simulate discovering nearby nodes
    const mockNodes = [
      { id: 'ALPHA-001', name: 'Alpha Base', signalStrength: Math.random() * 100 },
      { id: 'BETA-002', name: 'Beta Mobile', signalStrength: Math.random() * 100 },
      { id: 'CHARLIE-003', name: 'Charlie Unit', signalStrength: Math.random() * 100 },
    ];

    mockNodes.forEach(mock => {
      if (Math.random() > 0.3) { // 70% chance of discovery
        const node: MeshNode = {
          id: mock.id,
          name: mock.name,
          signalStrength: mock.signalStrength,
          lastSeen: Date.now(),
          capabilities: ['voice', 'text'],
          batteryLevel: Math.floor(Math.random() * 100),
          isRelay: Math.random() > 0.5
        };

        this.discoveredNodes.set(node.id, node);
        this.updateRoutingTable(node.id);
        this.emit('nodeDiscovered', node);
      }
    });
  }

  private updateRoutingTable(nodeId: string) {
    // Simple routing - direct connection for now
    this.routingTable.set(nodeId, [this.nodeId, nodeId]);
  }

  private cleanupStaleNodes() {
    const now = Date.now();
    const staleThreshold = 120000; // 2 minutes

    this.discoveredNodes.forEach((node, nodeId) => {
      if (nodeId !== this.nodeId && now - node.lastSeen > staleThreshold) {
        this.discoveredNodes.delete(nodeId);
        this.routingTable.delete(nodeId);
        this.emit('nodeLost', nodeId);
      }
    });
  }

  private queueMessage(packet: MeshPacket) {
    this.messageQueue.push(packet);
  }

  private async processMessageQueue() {
    while (true) {
      if (this.messageQueue.length > 0 && this.isActive) {
        const packet = this.messageQueue.shift()!;
        await this.processPacket(packet);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async processPacket(packet: MeshPacket) {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 200));

    if (packet.destination === 'broadcast' || packet.destination === this.nodeId) {
      this.emit('messageReceived', packet);
    }

    // Forward packet if TTL allows
    if (packet.ttl > 0 && packet.source !== this.nodeId) {
      packet.ttl--;
      packet.route.push(this.nodeId);
      
      // Simulate forwarding to other nodes
      setTimeout(() => {
        this.emit('messageForwarded', packet);
      }, 100);
    }
  }

  public sendMessage(type: MeshPacket['type'], payload: any, destination: string = 'broadcast'): string {
    const packet: MeshPacket = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source: this.nodeId,
      destination,
      type,
      payload,
      timestamp: Date.now(),
      ttl: 5,
      route: [this.nodeId],
      priority: type === 'emergency' ? 10 : 5
    };

    this.queueMessage(packet);
    return packet.id;
  }

  public getDiscoveredNodes(): MeshNode[] {
    return Array.from(this.discoveredNodes.values());
  }

  public getRoutingTable(): Map<string, string[]> {
    return new Map(this.routingTable);
  }

  private getBatteryLevel(): number {
    // Simulate battery drain
    return Math.max(10, 100 - (Date.now() % 100000) / 1000);
  }

  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }

  public getNetworkStats() {
    return {
      nodeId: this.nodeId,
      discoveredNodes: this.discoveredNodes.size,
      activeRoutes: this.routingTable.size,
      queuedMessages: this.messageQueue.length,
      isActive: this.isActive,
      batteryLevel: this.getBatteryLevel()
    };
  }

  public shutdown() {
    this.isActive = false;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.discoveryInterval) clearInterval(this.discoveryInterval);
    this.listeners.clear();
    this.discoveredNodes.clear();
    this.routingTable.clear();
    this.messageQueue.length = 0;
  }
}

export const meshNetworkCore = new MeshNetworkCore();
