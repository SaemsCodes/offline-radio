
import { EventEmitter } from 'events';
import { MeshMessage } from './WebRTCManager';

interface RouteEntry {
  destination: string;
  nextHop: string;
  hopCount: number;
  sequenceNumber: number;
  timestamp: number;
}

interface RouteRequest {
  id: string;
  source: string;
  destination: string;
  hopCount: number;
  sequenceNumber: number;
  timestamp: number;
}

interface RouteReply {
  id: string;
  source: string;
  destination: string;
  hopCount: number;
  sequenceNumber: number;
}

export class MeshRoutingManager extends EventEmitter {
  private nodeId: string;
  private routingTable: Map<string, RouteEntry> = new Map();
  private messageHistory: Set<string> = new Set();
  private sequenceNumber: number = 0;
  private routeRequestCache: Map<string, RouteRequest> = new Map();
  private readonly ROUTE_TIMEOUT = 300000; // 5 minutes
  private readonly MESSAGE_HISTORY_SIZE = 1000;

  constructor(nodeId: string) {
    super();
    this.nodeId = nodeId;
    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredRoutes();
      this.cleanupMessageHistory();
    }, 60000); // Cleanup every minute
  }

  private cleanupExpiredRoutes(): void {
    const now = Date.now();
    for (const [destination, route] of this.routingTable) {
      if (now - route.timestamp > this.ROUTE_TIMEOUT) {
        this.routingTable.delete(destination);
      }
    }
  }

  private cleanupMessageHistory(): void {
    if (this.messageHistory.size > this.MESSAGE_HISTORY_SIZE) {
      const entries = Array.from(this.messageHistory);
      const toRemove = entries.slice(0, entries.length - this.MESSAGE_HISTORY_SIZE);
      toRemove.forEach(entry => this.messageHistory.delete(entry));
    }
  }

  updateRoutingTable(destination: string, nextHop: string, hopCount: number, sequenceNumber: number): void {
    const existing = this.routingTable.get(destination);
    
    if (!existing || 
        sequenceNumber > existing.sequenceNumber || 
        (sequenceNumber === existing.sequenceNumber && hopCount < existing.hopCount)) {
      
      this.routingTable.set(destination, {
        destination,
        nextHop,
        hopCount,
        sequenceNumber,
        timestamp: Date.now()
      });
      
      this.emit('route-updated', destination, nextHop, hopCount);
    }
  }

  initiateRouteDiscovery(destination: string): string {
    if (destination === this.nodeId) {
      throw new Error('Cannot discover route to self');
    }

    const requestId = `${this.nodeId}-${++this.sequenceNumber}-${Date.now()}`;
    
    const routeRequest: RouteRequest = {
      id: requestId,
      source: this.nodeId,
      destination,
      hopCount: 0,
      sequenceNumber: this.sequenceNumber,
      timestamp: Date.now()
    };

    this.routeRequestCache.set(requestId, routeRequest);
    this.emit('broadcast-route-request', routeRequest);
    
    // Cleanup route request after timeout
    setTimeout(() => {
      this.routeRequestCache.delete(requestId);
    }, 30000);

    return requestId;
  }

  handleRouteRequest(rreq: RouteRequest, fromPeer: string): void {
    // Check for duplicate requests
    if (this.messageHistory.has(rreq.id)) {
      return;
    }

    this.messageHistory.add(rreq.id);
    
    // Update reverse route to source
    this.updateRoutingTable(rreq.source, fromPeer, rreq.hopCount + 1, rreq.sequenceNumber);

    if (rreq.destination === this.nodeId) {
      // We are the destination, send route reply
      const routeReply: RouteReply = {
        id: `${this.nodeId}-${++this.sequenceNumber}`,
        source: rreq.source,
        destination: this.nodeId,
        hopCount: 0,
        sequenceNumber: this.sequenceNumber
      };

      this.emit('send-route-reply', routeReply, fromPeer);
    } else {
      // Forward the request if we haven't seen it and it's not too old
      const age = Date.now() - rreq.timestamp;
      if (age < 30000 && rreq.hopCount < 10) { // Max 10 hops, 30 second timeout
        const forwardedRequest: RouteRequest = {
          ...rreq,
          hopCount: rreq.hopCount + 1
        };
        
        this.emit('forward-route-request', forwardedRequest, fromPeer);
      }
    }
  }

  handleRouteReply(rrep: RouteReply, fromPeer: string): void {
    // Update route to destination
    this.updateRoutingTable(rrep.destination, fromPeer, rrep.hopCount + 1, rrep.sequenceNumber);

    if (rrep.source !== this.nodeId) {
      // Forward the reply toward the source
      const route = this.routingTable.get(rrep.source);
      if (route) {
        const forwardedReply: RouteReply = {
          ...rrep,
          hopCount: rrep.hopCount + 1
        };
        
        this.emit('forward-route-reply', forwardedReply, route.nextHop);
      }
    } else {
      // Route reply reached the original requester
      this.emit('route-established', rrep.destination);
    }
  }

  routeMessage(message: MeshMessage): string | null {
    const messageId = `${message.sender}-${message.timestamp}`;
    
    // Check for duplicate messages
    if (this.messageHistory.has(messageId)) {
      return null;
    }

    this.messageHistory.add(messageId);

    if (message.destination === this.nodeId || message.destination === 'broadcast') {
      // Message is for us
      this.emit('message-for-local-node', message);
    }

    if (message.destination === 'broadcast') {
      // Broadcast to all peers except sender
      this.emit('forward-broadcast', message);
      return 'broadcast';
    } else if (message.destination !== this.nodeId) {
      // Route to specific destination
      const route = this.routingTable.get(message.destination);
      
      if (route) {
        // Forward via known route
        const forwardedMessage: MeshMessage = {
          ...message,
          hopCount: message.hopCount + 1
        };
        
        this.emit('forward-message', forwardedMessage, route.nextHop);
        return route.nextHop;
      } else {
        // No route known, initiate route discovery
        this.initiateRouteDiscovery(message.destination);
        this.emit('route-discovery-needed', message);
        return null;
      }
    }

    return null;
  }

  createMessage(content: string, destination: string, type: 'text' | 'voice' = 'text'): MeshMessage {
    return {
      id: `${this.nodeId}-${Date.now()}-${Math.random()}`,
      sender: this.nodeId,
      destination,
      content,
      type,
      timestamp: Date.now(),
      hopCount: 0,
      sequenceNumber: ++this.sequenceNumber
    };
  }

  getRoutingTable(): Map<string, RouteEntry> {
    return new Map(this.routingTable);
  }

  getKnownPeers(): string[] {
    return Array.from(this.routingTable.keys());
  }

  removeRoute(destination: string): void {
    this.routingTable.delete(destination);
    this.emit('route-removed', destination);
  }

  updatePeerConnectivity(peerId: string, isConnected: boolean): void {
    if (!isConnected) {
      // Remove routes through disconnected peer
      const routesToRemove: string[] = [];
      
      for (const [destination, route] of this.routingTable) {
        if (route.nextHop === peerId) {
          routesToRemove.push(destination);
        }
      }
      
      routesToRemove.forEach(dest => {
        this.routingTable.delete(dest);
        this.emit('route-removed', dest);
      });
    }
  }

  getRouteMetrics(): any {
    return {
      totalRoutes: this.routingTable.size,
      messageHistorySize: this.messageHistory.size,
      sequenceNumber: this.sequenceNumber,
      activeRouteRequests: this.routeRequestCache.size
    };
  }

  destroy(): void {
    this.routingTable.clear();
    this.messageHistory.clear();
    this.routeRequestCache.clear();
    this.removeAllListeners();
  }
}
