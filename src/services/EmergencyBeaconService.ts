interface EmergencyBeacon {
  id: string;
  senderId: string;
  location?: GeolocationCoordinates;
  message: string;
  timestamp: number;
  priority: 'critical' | 'high' | 'medium';
  acknowledgedBy: string[];
  retransmissionCount: number;
}

interface EmergencyAlert {
  beaconId?: string; // Make optional since it gets generated
  type: 'medical' | 'fire' | 'security' | 'natural-disaster' | 'other';
  severity: 1 | 2 | 3 | 4 | 5; // 5 being most severe
  location?: GeolocationCoordinates;
  message: string;
  contactInfo?: string;
}

class EmergencyBeaconService {
  private activeBeacons: Map<string, EmergencyBeacon> = new Map();
  private emergencyContacts: string[] = [];
  private isEmergencyMode: boolean = false;
  private locationWatchId: number | null = null;
  private currentLocation: GeolocationCoordinates | null = null;

  constructor() {
    this.setupLocationTracking();
  }

  private setupLocationTracking(): void {
    if ('geolocation' in navigator) {
      this.locationWatchId = navigator.geolocation.watchPosition(
        (position) => {
          this.currentLocation = position.coords;
        },
        (error) => {
          console.warn('Location tracking failed:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    }
  }

  async activateEmergencyMode(): Promise<void> {
    this.isEmergencyMode = true;
    
    // Dispatch emergency mode activation event
    const event = new CustomEvent('emergency-mode-activated', {
      detail: { timestamp: Date.now() }
    });
    document.dispatchEvent(event);
  }

  async deactivateEmergencyMode(): Promise<void> {
    this.isEmergencyMode = false;
    this.activeBeacons.clear();
    
    const event = new CustomEvent('emergency-mode-deactivated', {
      detail: { timestamp: Date.now() }
    });
    document.dispatchEvent(event);
  }

  async sendEmergencyBeacon(alert: EmergencyAlert): Promise<string> {
    const beaconId = `emergency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const beacon: EmergencyBeacon = {
      id: beaconId,
      senderId: 'local-device',
      location: alert.location || this.currentLocation || undefined,
      message: alert.message,
      timestamp: Date.now(),
      priority: this.mapSeverityToPriority(alert.severity),
      acknowledgedBy: [],
      retransmissionCount: 0
    };

    this.activeBeacons.set(beaconId, beacon);

    // Start retransmission cycle for critical beacons
    if (beacon.priority === 'critical') {
      this.startRetransmissionCycle(beaconId);
    }

    // Dispatch beacon sent event
    const event = new CustomEvent('emergency-beacon-sent', {
      detail: { beacon, alert }
    });
    document.dispatchEvent(event);

    return beaconId;
  }

  private mapSeverityToPriority(severity: number): 'critical' | 'high' | 'medium' {
    if (severity >= 4) return 'critical';
    if (severity >= 3) return 'high';
    return 'medium';
  }

  private startRetransmissionCycle(beaconId: string): void {
    const retransmit = () => {
      const beacon = this.activeBeacons.get(beaconId);
      if (!beacon || beacon.retransmissionCount >= 10) {
        return;
      }

      beacon.retransmissionCount++;
      
      // Dispatch retransmission event
      const event = new CustomEvent('emergency-beacon-retransmit', {
        detail: { beacon }
      });
      document.dispatchEvent(event);

      // Schedule next retransmission
      setTimeout(retransmit, 30000); // Every 30 seconds for critical beacons
    };

    // Initial delay
    setTimeout(retransmit, 5000);
  }

  acknowledgeBeacon(beaconId: string, acknowledgerId: string): void {
    const beacon = this.activeBeacons.get(beaconId);
    if (beacon && !beacon.acknowledgedBy.includes(acknowledgerId)) {
      beacon.acknowledgedBy.push(acknowledgerId);
      
      const event = new CustomEvent('emergency-beacon-acknowledged', {
        detail: { beacon, acknowledgerId }
      });
      document.dispatchEvent(event);
    }
  }

  getActiveBeacons(): EmergencyBeacon[] {
    return Array.from(this.activeBeacons.values());
  }

  isInEmergencyMode(): boolean {
    return this.isEmergencyMode;
  }

  getCurrentLocation(): GeolocationCoordinates | null {
    return this.currentLocation;
  }

  addEmergencyContact(contactId: string): void {
    if (!this.emergencyContacts.includes(contactId)) {
      this.emergencyContacts.push(contactId);
    }
  }

  removeEmergencyContact(contactId: string): void {
    this.emergencyContacts = this.emergencyContacts.filter(id => id !== contactId);
  }

  getEmergencyContacts(): string[] {
    return [...this.emergencyContacts];
  }

  shutdown(): void {
    if (this.locationWatchId !== null) {
      navigator.geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
    this.activeBeacons.clear();
    this.isEmergencyMode = false;
  }
}

export const emergencyBeaconService = new EmergencyBeaconService();
export type { EmergencyBeacon, EmergencyAlert };
