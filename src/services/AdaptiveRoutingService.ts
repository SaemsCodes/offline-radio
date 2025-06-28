import { EventEmitter } from 'events';

export interface RouteEntry {
  destination: string;
  nextHop: string;
  hopCount: number;
  latency: number;
  reliability: number; // 0-100
  lastUpdated: number;
  transport: string;
  bandwidth: number;
}

export interface RouteMetrics {
  totalRoutes: number;
  activeRoutes: number;
  averageLatency: number;
  networkReliability: number;
  congestionLevel: 'low' | 'medium' | 'high';
}

export interface QualityOfService {
  priority: 'low' | 'normal' | 'high' | 'emergency';
  maxLatency: number;
  minBandwidth: number;
  requiresEncryption: boolean;
  allowRetransmission: boolean;
}

export class AdaptiveRoutingService extends EventEmitter {
  private routingTable: Map<string, RouteEntry[]> = new Map();
  private routeMetrics: Map<string, number[]> = new Map(); // Store latency history
  private congestionMap: Map<string, number> = new Map();
  private routingUpdateInterval: number | null = null;
  private localNodeId: string;

  constructor(nodeId: string) {
    super();
    this.localNodeId = nodeId;
    this.initializeRouting();
  }

  private initializeRouting() {
    // Start periodic routing table updates
    this.routingUpdateInterval = window.setInterval(() => {
      this.updateRoutingTable();
      this.optimizeRoutes();
      this.detectCongestion();
    }, 10000); // Every 10 seconds
  }

  addRoute(destination: string, nextHop: string, metrics: Partial<RouteEntry> = {}) {
    if (!this.routingTable.has(destination)) {
      this.routingTable.set(destination, []);
    }

    const routes = this.routingTable.get(destination)!;
    
    const newRoute: RouteEntry = {
      destination,
      nextHop,
      hopCount: metrics.hopCount || 1,
      latency: metrics.latency || 100,
      reliability: metrics.reliability || 95,
      lastUpdated: Date.now(),
      transport: metrics.transport || 'webrtc',
      bandwidth: metrics.bandwidth || 1000000
    };

    // Remove existing route to same next hop
    const filteredRoutes = routes.filter(r => r.nextHop !== nextHop);
    filteredRoutes.push(newRoute);

    // Keep only best routes (max 3 per destination)
    const sortedRoutes = filteredRoutes
      .sort((a, b) => this.calculateRouteScore(b) - this.calculateRouteScore(a))
      .slice(0, 3);

    this.routingTable.set(destination, sortedRoutes);
    this.emit('route-added', newRoute);
  }

  private calculateRouteScore(route: RouteEntry): number {
    const latencyScore = Math.max(0, 100 - route.latency / 10);
    const reliabilityScore = route.reliability;
    const hopScore = Math.max(0, 100 - route.hopCount * 20);
    const freshnessScore = Math.max(0, 100 - (Date.now() - route.lastUpdated) / 60000);

    return (latencyScore * 0.3 + reliabilityScore * 0.4 + hopScore * 0.2 + freshnessScore * 0.1);
  }

  getBestRoute(destination: string, qos?: QualityOfService): RouteEntry | null {
    const routes = this.routingTable.get(destination);
    if (!routes || routes.length === 0) return null;

    // Filter routes based on QoS requirements
    let candidateRoutes = routes;

    if (qos) {
      candidateRoutes = routes.filter(route => {
        return route.latency <= qos.maxLatency &&
               route.bandwidth >= qos.minBandwidth &&
               (qos.priority === 'emergency' ? route.reliability >= 90 : true);
      });

      if (candidateRoutes.length === 0) {
        // Fallback to any available route for emergency
        candidateRoutes = qos.priority === 'emergency' ? routes : [];
      }
    }

    if (candidateRoutes.length === 0) return null;

    // Apply load balancing for non-emergency traffic
    if (!qos || qos.priority !== 'emergency') {
      const congestionWeightedRoutes = candidateRoutes.map(route => ({
        route,
        weight: this.calculateRouteScore(route) / (1 + (this.congestionMap.get(route.nextHop) || 0))
      }));

      return congestionWeightedRoutes
        .sort((a, b) => b.weight - a.weight)[0].route;
    }

    // For emergency traffic, use the most reliable route
    return candidateRoutes
      .sort((a, b) => b.reliability - a.reliability)[0];
  }

  async measureRouteLatency(destination: string, route: RouteEntry): Promise<number> {
    const startTime = performance.now();
    
    try {
      // Simulate ping measurement
      await new Promise(resolve => 
        setTimeout(resolve, route.latency + Math.random() * 50)
      );
      
      const measuredLatency = performance.now() - startTime;
      
      // Update route metrics
      if (!this.routeMetrics.has(destination)) {
        this.routeMetrics.set(destination, []);
      }
      
      const metrics = this.routeMetrics.get(destination)!;
      metrics.push(measuredLatency);
      
      // Keep only last 10 measurements
      if (metrics.length > 10) {
        metrics.shift();
      }
      
      // Update route latency with moving average
      route.latency = metrics.reduce((sum, val) => sum + val, 0) / metrics.length;
      route.lastUpdated = Date.now();
      
      return measuredLatency;
    } catch (error) {
      // Route is unreachable
      route.reliability = Math.max(0, route.reliability - 10);
      return Infinity;
    }
  }

  private updateRoutingTable() {
    const now = Date.now();
    const staleThreshold = 300000; // 5 minutes

    // Remove stale routes
    this.routingTable.forEach((routes, destination) => {
      const freshRoutes = routes.filter(route => {
        const isStale = now - route.lastUpdated > staleThreshold;
        if (isStale) {
          this.emit('route-expired', route);
        }
        return !isStale;
      });

      if (freshRoutes.length === 0) {
        this.routingTable.delete(destination);
      } else {
        this.routingTable.set(destination, freshRoutes);
      }
    });
  }

  private optimizeRoutes() {
    // Proactively measure latency for active routes
    this.routingTable.forEach(async (routes, destination) => {
      for (const route of routes) {
        if (Date.now() - route.lastUpdated > 60000) { // 1 minute
          await this.measureRouteLatency(destination, route);
        }
      }
    });
  }

  private detectCongestion() {
    // Simple congestion detection based on latency increases
    this.routeMetrics.forEach((latencies, destination) => {
      if (latencies.length < 5) return;

      const recentLatency = latencies.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
      const historicalLatency = latencies.slice(0, -3).reduce((sum, val) => sum + val, 0) / (latencies.length - 3);

      const congestionLevel = Math.max(0, (recentLatency - historicalLatency) / historicalLatency);
      
      if (congestionLevel > 0.5) {
        const routes = this.routingTable.get(destination);
        if (routes) {
          routes.forEach(route => {
            this.congestionMap.set(route.nextHop, congestionLevel);
          });
        }
      }
    });

    // Decay congestion values over time
    this.congestionMap.forEach((level, nextHop) => {
      this.congestionMap.set(nextHop, Math.max(0, level * 0.9));
    });
  }

  getRouteMetrics(): RouteMetrics {
    const allRoutes = Array.from(this.routingTable.values()).flat();
    const activeRoutes = allRoutes.filter(route => 
      Date.now() - route.lastUpdated < 60000
    );

    const totalLatency = activeRoutes.reduce((sum, route) => sum + route.latency, 0);
    const totalReliability = activeRoutes.reduce((sum, route) => sum + route.reliability, 0);

    const avgCongestion = Array.from(this.congestionMap.values())
      .reduce((sum, val) => sum + val, 0) / Math.max(1, this.congestionMap.size);

    return {
      totalRoutes: allRoutes.length,
      activeRoutes: activeRoutes.length,
      averageLatency: activeRoutes.length ? totalLatency / activeRoutes.length : 0,
      networkReliability: activeRoutes.length ? totalReliability / activeRoutes.length : 0,
      congestionLevel: avgCongestion > 0.7 ? 'high' : avgCongestion > 0.3 ? 'medium' : 'low'
    };
  }

  getAllRoutes(): Map<string, RouteEntry[]> {
    return new Map(this.routingTable);
  }

  removeRoute(destination: string, nextHop: string) {
    const routes = this.routingTable.get(destination);
    if (!routes) return;

    const filteredRoutes = routes.filter(route => route.nextHop !== nextHop);
    
    if (filteredRoutes.length === 0) {
      this.routingTable.delete(destination);
    } else {
      this.routingTable.set(destination, filteredRoutes);
    }

    this.emit('route-removed', { destination, nextHop });
  }

  shutdown() {
    if (this.routingUpdateInterval) {
      clearInterval(this.routingUpdateInterval);
      this.routingUpdateInterval = null;
    }
    
    this.routingTable.clear();
    this.routeMetrics.clear();
    this.congestionMap.clear();
    this.removeAllListeners();
  }
}

export const createAdaptiveRoutingService = (nodeId: string) => 
  new AdaptiveRoutingService(nodeId);
