export interface NetworkEvent {
  id: string;
  timestamp: number;
  type: 'connection' | 'disconnection' | 'message' | 'error' | 'discovery';
  peerId?: string;
  transport?: string;
  latency?: number;
  bandwidth?: number;
  signalStrength?: number;
  success: boolean;
  metadata: Record<string, any>;
}

export interface NetworkAnalytics {
  totalEvents: number;
  successRate: number;
  averageLatency: number;
  peakBandwidth: number;
  activeConnections: number;
  transportDistribution: Record<string, number>;
  errorRate: number;
  networkHealth: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface PeerAnalytics {
  peerId: string;
  firstSeen: number;
  lastSeen: number;
  totalConnections: number;
  successfulTransmissions: number;
  failedTransmissions: number;
  averageLatency: number;
  averageSignalStrength: number;
  preferredTransport: string;
  reliability: number;
}

export class NetworkAnalyticsService {
  private events: NetworkEvent[] = [];
  private peerStats: Map<string, PeerAnalytics> = new Map();
  private maxEvents = 10000;
  private analyticsInterval: number | null = null;
  private realTimeListeners: Set<(analytics: NetworkAnalytics) => void> = new Set();
  private cachedNetworkHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
  private lastHealthCalculation = 0;
  private healthCalculationCooldown = 5000; // 5 seconds

  constructor() {
    this.startAnalyticsCollection();
  }

  recordEvent(
    type: NetworkEvent['type'],
    success: boolean,
    metadata: Record<string, any> = {},
    peerId?: string,
    transport?: string,
    latency?: number,
    bandwidth?: number,
    signalStrength?: number
  ) {
    const event: NetworkEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      peerId,
      transport,
      latency,
      bandwidth,
      signalStrength,
      success,
      metadata
    };

    this.events.push(event);
    
    // Maintain event history limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents * 0.8);
    }

    // Update peer statistics
    if (peerId) {
      this.updatePeerStats(peerId, event);
    }

    // Schedule health recalculation with cooldown
    this.scheduleHealthCalculation();

    // Trigger real-time updates
    this.notifyRealTimeListeners();
  }

  private scheduleHealthCalculation() {
    const now = Date.now();
    if (now - this.lastHealthCalculation > this.healthCalculationCooldown) {
      this.lastHealthCalculation = now;
      setTimeout(() => {
        this.cachedNetworkHealth = this.calculateNetworkHealthDirect();
      }, 100);
    }
  }

  private calculateNetworkHealthDirect(): 'excellent' | 'good' | 'fair' | 'poor' {
    const totalEvents = this.events.length;
    if (totalEvents === 0) return 'poor';

    const successfulEvents = this.events.filter(e => e.success).length;
    const successRate = (successfulEvents / totalEvents) * 100;

    const latencies = this.events.filter(e => e.latency !== undefined).map(e => e.latency!);
    const averageLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    const errorEvents = this.events.filter(e => !e.success).length;
    const errorRate = (errorEvents / totalEvents) * 100;
    
    if (successRate >= 95 && averageLatency < 100 && errorRate < 2) {
      return 'excellent';
    } else if (successRate >= 85 && averageLatency < 200 && errorRate < 5) {
      return 'good';
    } else if (successRate >= 70 && averageLatency < 500 && errorRate < 10) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  private updatePeerStats(peerId: string, event: NetworkEvent) {
    let stats = this.peerStats.get(peerId);
    
    if (!stats) {
      stats = {
        peerId,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        totalConnections: 0,
        successfulTransmissions: 0,
        failedTransmissions: 0,
        averageLatency: 0,
        averageSignalStrength: 0,
        preferredTransport: event.transport || 'unknown',
        reliability: 100
      };
    }

    stats.lastSeen = event.timestamp;

    if (event.type === 'connection') {
      stats.totalConnections++;
    }

    if (event.type === 'message') {
      if (event.success) {
        stats.successfulTransmissions++;
      } else {
        stats.failedTransmissions++;
      }
    }

    // Update averages
    if (event.latency !== undefined) {
      const totalTransmissions = stats.successfulTransmissions + stats.failedTransmissions;
      if (totalTransmissions > 0) {
        stats.averageLatency = (stats.averageLatency * (totalTransmissions - 1) + event.latency) / totalTransmissions;
      }
    }

    if (event.signalStrength !== undefined) {
      const totalMeasurements = stats.successfulTransmissions + stats.failedTransmissions + 1;
      stats.averageSignalStrength = (stats.averageSignalStrength * (totalMeasurements - 1) + event.signalStrength) / totalMeasurements;
    }

    // Calculate reliability
    const totalAttempts = stats.successfulTransmissions + stats.failedTransmissions;
    if (totalAttempts > 0) {
      stats.reliability = (stats.successfulTransmissions / totalAttempts) * 100;
    }

    this.peerStats.set(peerId, stats);
  }

  private startAnalyticsCollection() {
    this.analyticsInterval = window.setInterval(() => {
      this.scheduleHealthCalculation();
      this.notifyRealTimeListeners();
    }, 10000);
  }

  getAnalytics(timeRange?: { start: number; end: number }): NetworkAnalytics {
    let events = this.events;
    
    if (timeRange) {
      events = events.filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end);
    }

    const totalEvents = events.length;
    const successfulEvents = events.filter(e => e.success).length;
    const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;

    const latencies = events.filter(e => e.latency !== undefined).map(e => e.latency!);
    const averageLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    const bandwidths = events.filter(e => e.bandwidth !== undefined).map(e => e.bandwidth!);
    const peakBandwidth = bandwidths.length > 0 ? Math.max(...bandwidths) : 0;

    const connectionEvents = events.filter(e => e.type === 'connection' && e.success);
    const disconnectionEvents = events.filter(e => e.type === 'disconnection');
    const activeConnections = Math.max(0, connectionEvents.length - disconnectionEvents.length);

    const transportDistribution: Record<string, number> = {};
    events.forEach(e => {
      if (e.transport) {
        transportDistribution[e.transport] = (transportDistribution[e.transport] || 0) + 1;
      }
    });

    const errorEvents = events.filter(e => !e.success).length;
    const errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;

    return {
      totalEvents,
      successRate,
      averageLatency,
      peakBandwidth,
      activeConnections,
      transportDistribution,
      errorRate,
      networkHealth: this.cachedNetworkHealth
    };
  }

  getPeerAnalytics(peerId?: string): PeerAnalytics[] {
    const peers = Array.from(this.peerStats.values());
    
    if (peerId) {
      const peer = this.peerStats.get(peerId);
      return peer ? [peer] : [];
    }
    
    return peers.sort((a, b) => b.reliability - a.reliability);
  }

  getTopPerformingPeers(limit: number = 10): PeerAnalytics[] {
    return this.getPeerAnalytics()
      .sort((a, b) => {
        const aScore = a.reliability * 0.5 + (100 - a.averageLatency / 10) * 0.3 + a.averageSignalStrength * 0.2;
        const bScore = b.reliability * 0.5 + (100 - b.averageLatency / 10) * 0.3 + b.averageSignalStrength * 0.2;
        return bScore - aScore;
      })
      .slice(0, limit);
  }

  getNetworkTrends(hours: number = 24): { timestamp: number; analytics: NetworkAnalytics }[] {
    const now = Date.now();
    const startTime = now - (hours * 60 * 60 * 1000);
    const intervalMs = (hours * 60 * 60 * 1000) / 24; // 24 data points
    
    const trends: { timestamp: number; analytics: NetworkAnalytics }[] = [];
    
    for (let i = 0; i < 24; i++) {
      const intervalStart = startTime + (i * intervalMs);
      const intervalEnd = intervalStart + intervalMs;
      
      const analytics = this.getAnalytics({ start: intervalStart, end: intervalEnd });
      trends.push({ timestamp: intervalStart, analytics });
    }
    
    return trends;
  }

  subscribeToRealTimeAnalytics(callback: (analytics: NetworkAnalytics) => void): () => void {
    this.realTimeListeners.add(callback);
    
    // Send initial data
    callback(this.getAnalytics());
    
    return () => {
      this.realTimeListeners.delete(callback);
    };
  }

  private notifyRealTimeListeners() {
    const analytics = this.getAnalytics();
    this.realTimeListeners.forEach(listener => {
      try {
        listener(analytics);
      } catch (error) {
        console.error('Error in analytics listener:', error);
      }
    });
  }

  exportAnalytics(timeRange?: { start: number; end: number }): string {
    const analytics = this.getAnalytics(timeRange);
    const peerAnalytics = this.getPeerAnalytics();
    const trends = this.getNetworkTrends();
    
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      timeRange,
      summary: analytics,
      peerAnalytics,
      trends,
      events: timeRange 
        ? this.events.filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end)
        : this.events.slice(-1000) // Last 1000 events
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  clearAnalytics(olderThanHours?: number) {
    if (olderThanHours) {
      const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
      this.events = this.events.filter(e => e.timestamp >= cutoffTime);
      
      // Clean up peer stats for peers not seen recently
      this.peerStats.forEach((stats, peerId) => {
        if (stats.lastSeen < cutoffTime) {
          this.peerStats.delete(peerId);
        }
      });
    } else {
      this.events = [];
      this.peerStats.clear();
    }
  }

  shutdown() {
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
      this.analyticsInterval = null;
    }
    this.realTimeListeners.clear();
  }
}

export const networkAnalyticsService = new NetworkAnalyticsService();
