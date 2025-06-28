
import { EventEmitter } from 'events';

export interface PooledConnection {
  id: string;
  peerId: string;
  transport: 'webrtc' | 'websocket' | 'bluetooth';
  connection: any; // RTCPeerConnection, WebSocket, or Bluetooth connection
  isActive: boolean;
  isIdle: boolean;
  lastUsed: number;
  createdAt: number;
  latency: number;
  bandwidth: number;
  reliability: number;
  messagesSent: number;
  messagesReceived: number;
}

export interface ConnectionPoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  averageLatency: number;
  totalBandwidth: number;
  connectionUtilization: number;
  batteryImpact: number;
}

export class ConnectionPoolService extends EventEmitter {
  private connections: Map<string, PooledConnection> = new Map();
  private maxConnections: number = 20;
  private maxIdleTime: number = 300000; // 5 minutes
  private cleanupInterval: number | null = null;
  private healthCheckInterval: number | null = null;

  constructor() {
    super();
    this.startMaintenanceTasks();
  }

  private startMaintenanceTasks() {
    // Clean up idle connections every 30 seconds
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupIdleConnections();
    }, 30000);

    // Health check every 60 seconds
    this.healthCheckInterval = window.setInterval(() => {
      this.performHealthChecks();
    }, 60000);
  }

  async acquireConnection(peerId: string, transport: 'webrtc' | 'websocket' | 'bluetooth'): Promise<PooledConnection | null> {
    // Try to find existing connection to the peer
    const existingConnection = this.findConnection(peerId, transport);
    if (existingConnection && existingConnection.isActive) {
      existingConnection.lastUsed = Date.now();
      existingConnection.isIdle = false;
      this.emit('connection-reused', existingConnection);
      return existingConnection;
    }

    // Check if we need to make room for new connection
    if (this.connections.size >= this.maxConnections) {
      await this.evictLeastRecentlyUsed();
    }

    // Create new connection
    try {
      const connection = await this.createConnection(peerId, transport);
      this.connections.set(connection.id, connection);
      this.emit('connection-created', connection);
      return connection;
    } catch (error) {
      console.error(`Failed to create connection to ${peerId}:`, error);
      this.emit('connection-failed', { peerId, transport, error });
      return null;
    }
  }

  private findConnection(peerId: string, transport: string): PooledConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.peerId === peerId && connection.transport === transport) {
        return connection;
      }
    }
    return null;
  }

  private async createConnection(peerId: string, transport: 'webrtc' | 'websocket' | 'bluetooth'): Promise<PooledConnection> {
    const connectionId = `${transport}-${peerId}-${Date.now()}`;
    
    let connection: any;
    let latency = 100;
    let bandwidth = 1000000;

    switch (transport) {
      case 'webrtc':
        connection = await this.createWebRTCConnection(peerId);
        latency = 50;
        bandwidth = 2000000; // 2Mbps
        break;
      
      case 'websocket':
        connection = await this.createWebSocketConnection(peerId);
        latency = 100;
        bandwidth = 1000000; // 1Mbps
        break;
      
      case 'bluetooth':
        connection = await this.createBluetoothConnection(peerId);
        latency = 200;
        bandwidth = 100000; // 100Kbps
        break;
    }

    const pooledConnection: PooledConnection = {
      id: connectionId,
      peerId,
      transport,
      connection,
      isActive: true,
      isIdle: false,
      lastUsed: Date.now(),
      createdAt: Date.now(),
      latency,
      bandwidth,
      reliability: 95,
      messagesSent: 0,
      messagesReceived: 0
    };

    return pooledConnection;
  }

  private async createWebRTCConnection(peerId: string): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    // Set up data channel for mesh communication
    const dataChannel = pc.createDataChannel('mesh-data', {
      ordered: true,
      maxRetransmits: 3
    });

    dataChannel.onopen = () => {
      console.log(`WebRTC data channel open to ${peerId}`);
    };

    dataChannel.onmessage = (event) => {
      this.handleIncomingMessage(peerId, event.data);
    };

    // Simulate connection establishment
    await new Promise(resolve => setTimeout(resolve, 100));

    return pc;
  }

  private async createWebSocketConnection(peerId: string): Promise<WebSocket> {
    // In a real implementation, this would connect to a signaling server
    // For now, we simulate with a mock WebSocket
    const mockWs = {
      readyState: WebSocket.OPEN,
      send: (data: string) => {
        console.log(`WebSocket send to ${peerId}:`, data);
      },
      close: () => {
        console.log(`WebSocket closed to ${peerId}`);
      },
      onmessage: null as any,
      onclose: null as any,
      onerror: null as any
    } as WebSocket;

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 150));

    return mockWs;
  }

  private async createBluetoothConnection(peerId: string): Promise<any> {
    // Simulate Bluetooth connection
    const mockBluetooth = {
      connected: true,
      send: (data: ArrayBuffer) => {
        console.log(`Bluetooth send to ${peerId}:`, data);
      },
      disconnect: () => {
        console.log(`Bluetooth disconnected from ${peerId}`);
      }
    };

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 300));

    return mockBluetooth;
  }

  private handleIncomingMessage(peerId: string, data: any) {
    const connection = this.findConnection(peerId, 'webrtc');
    if (connection) {
      connection.messagesReceived++;
      connection.lastUsed = Date.now();
      this.emit('message-received', { peerId, data });
    }
  }

  async sendMessage(peerId: string, data: any, transport?: string): Promise<boolean> {
    const connection = transport 
      ? this.findConnection(peerId, transport as any)
      : this.findBestConnection(peerId);

    if (!connection || !connection.isActive) {
      // Try to acquire a new connection
      const newConnection = await this.acquireConnection(
        peerId, 
        transport as any || 'webrtc'
      );
      
      if (!newConnection) return false;
      return this.sendThroughConnection(newConnection, data);
    }

    return this.sendThroughConnection(connection, data);
  }

  private findBestConnection(peerId: string): PooledConnection | null {
    const peerConnections = Array.from(this.connections.values())
      .filter(conn => conn.peerId === peerId && conn.isActive);

    if (peerConnections.length === 0) return null;

    // Choose connection with best latency and reliability
    return peerConnections.sort((a, b) => {
      const scoreA = (100 - a.latency) * (a.reliability / 100);
      const scoreB = (100 - b.latency) * (b.reliability / 100);
      return scoreB - scoreA;
    })[0];
  }

  private sendThroughConnection(connection: PooledConnection, data: any): boolean {
    try {
      switch (connection.transport) {
        case 'webrtc':
          const dataChannel = connection.connection.createDataChannel?.('mesh-data');
          if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify(data));
          }
          break;
        
        case 'websocket':
          if (connection.connection.readyState === WebSocket.OPEN) {
            connection.connection.send(JSON.stringify(data));
          }
          break;
        
        case 'bluetooth':
          if (connection.connection.connected) {
            const encoder = new TextEncoder();
            connection.connection.send(encoder.encode(JSON.stringify(data)));
          }
          break;
      }

      connection.messagesSent++;
      connection.lastUsed = Date.now();
      connection.isIdle = false;

      return true;
    } catch (error) {
      console.error(`Failed to send through connection ${connection.id}:`, error);
      connection.reliability = Math.max(0, connection.reliability - 5);
      return false;
    }
  }

  releaseConnection(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isIdle = true;
      connection.lastUsed = Date.now();
      this.emit('connection-released', connection);
    }
  }

  private async evictLeastRecentlyUsed() {
    const sortedConnections = Array.from(this.connections.values())
      .sort((a, b) => a.lastUsed - b.lastUsed);

    const connectionToEvict = sortedConnections[0];
    if (connectionToEvict) {
      await this.closeConnection(connectionToEvict);
    }
  }

  private cleanupIdleConnections() {
    const now = Date.now();
    const connectionsToClose: PooledConnection[] = [];

    this.connections.forEach(connection => {
      if (connection.isIdle && (now - connection.lastUsed) > this.maxIdleTime) {
        connectionsToClose.push(connection);
      }
    });

    connectionsToClose.forEach(connection => {
      this.closeConnection(connection);
    });
  }

  private async closeConnection(connection: PooledConnection) {
    try {
      switch (connection.transport) {
        case 'webrtc':
          connection.connection.close();
          break;
        case 'websocket':
          connection.connection.close();
          break;
        case 'bluetooth':
          connection.connection.disconnect();
          break;
      }

      this.connections.delete(connection.id);
      this.emit('connection-closed', connection);
    } catch (error) {
      console.error(`Error closing connection ${connection.id}:`, error);
    }
  }

  private async performHealthChecks() {
    const healthCheckPromises = Array.from(this.connections.values())
      .map(connection => this.checkConnectionHealth(connection));

    await Promise.allSettled(healthCheckPromises);
  }

  private async checkConnectionHealth(connection: PooledConnection): Promise<void> {
    try {
      const startTime = performance.now();
      
      // Send ping message
      const pingSuccess = await this.sendThroughConnection(connection, { type: 'ping' });
      
      if (pingSuccess) {
        connection.latency = performance.now() - startTime;
        connection.reliability = Math.min(100, connection.reliability + 1);
      } else {
        connection.reliability = Math.max(0, connection.reliability - 10);
        
        if (connection.reliability < 50) {
          await this.closeConnection(connection);
        }
      }
    } catch (error) {
      connection.reliability = Math.max(0, connection.reliability - 15);
      if (connection.reliability < 30) {
        await this.closeConnection(connection);
      }
    }
  }

  getMetrics(): ConnectionPoolMetrics {
    const connections = Array.from(this.connections.values());
    const activeConnections = connections.filter(c => c.isActive);
    const idleConnections = connections.filter(c => c.isIdle);

    const totalLatency = connections.reduce((sum, c) => sum + c.latency, 0);
    const totalBandwidth = connections.reduce((sum, c) => sum + c.bandwidth, 0);
    const totalMessages = connections.reduce((sum, c) => sum + c.messagesSent + c.messagesReceived, 0);

    return {
      totalConnections: connections.length,
      activeConnections: activeConnections.length,
      idleConnections: idleConnections.length,
      averageLatency: connections.length ? totalLatency / connections.length : 0,
      totalBandwidth,
      connectionUtilization: totalMessages / Math.max(1, connections.length),
      batteryImpact: connections.filter(c => c.transport === 'bluetooth').length * 0.3 +
                     connections.filter(c => c.transport === 'webrtc').length * 0.2 +
                     connections.filter(c => c.transport === 'websocket').length * 0.1
    };
  }

  getConnections(): PooledConnection[] {
    return Array.from(this.connections.values());
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Close all connections
    const closePromises = Array.from(this.connections.values())
      .map(connection => this.closeConnection(connection));

    Promise.allSettled(closePromises).then(() => {
      this.connections.clear();
      this.removeAllListeners();
    });
  }
}

export const connectionPoolService = new ConnectionPoolService();
