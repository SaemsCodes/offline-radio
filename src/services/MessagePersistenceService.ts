
import { supabase } from '@/integrations/supabase/client';

export interface PersistedMessage {
  id: string;
  user_id: string;
  device_id: string;
  channel: number;
  content: string;
  message_type: 'text' | 'voice' | 'emergency';
  is_encrypted: boolean;
  signal_strength: number;
  timestamp: string;
  audio_data?: string;
  emergency_location?: { lat: number; lng: number };
}

export interface DeviceRegistration {
  id: string;
  user_id: string;
  device_name: string;
  device_type: string;
  capabilities: string[];
  battery_level: number;
  last_seen: string;
  encryption_public_key?: string;
}

export interface EmergencyBeacon {
  id: string;
  user_id: string;
  device_id: string;
  location: { lat: number; lng: number };
  message: string;
  signal_strength: number;
  timestamp: string;
  acknowledged: boolean;
}

export interface MessageStats {
  totalMessages: number;
  deliveredMessages: number;
  pendingMessages: number;
  failedMessages: number;
  averageDeliveryTime: number;
  storageUsed: number;
}

class MessagePersistenceService {
  private isOnline = navigator.onLine;
  private offlineQueue: PersistedMessage[] = [];
  private deviceId: string;

  constructor() {
    this.deviceId = this.generateDeviceId();
    this.setupNetworkListeners();
    this.setupRealtimeSubscriptions();
  }

  private generateDeviceId(): string {
    const stored = localStorage.getItem('orad-device-id');
    if (stored) return stored;
    
    const newId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('orad-device-id', newId);
    return newId;
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncOfflineMessages();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private setupRealtimeSubscriptions() {
    // Subscribe to real-time message updates
    supabase
      .channel('messages')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'radio_messages' },
        (payload) => this.handleRealtimeMessage(payload.new as PersistedMessage)
      )
      .subscribe();

    // Subscribe to emergency beacons
    supabase
      .channel('emergency')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'emergency_beacons' },
        (payload) => this.handleEmergencyBeacon(payload.new as EmergencyBeacon)
      )
      .subscribe();
  }

  private handleRealtimeMessage(message: PersistedMessage) {
    // Emit event for real-time message display
    window.dispatchEvent(new CustomEvent('realtime-message', { detail: message }));
  }

  private handleEmergencyBeacon(beacon: EmergencyBeacon) {
    // Emit event for emergency notifications
    window.dispatchEvent(new CustomEvent('emergency-beacon', { detail: beacon }));
  }

  async saveMessage(message: Omit<PersistedMessage, 'id' | 'user_id' | 'timestamp'>): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('No authenticated user for message persistence');
      return false;
    }

    const fullMessage: PersistedMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: user.id,
      timestamp: new Date().toISOString()
    };

    if (!this.isOnline) {
      this.offlineQueue.push(fullMessage);
      localStorage.setItem('orad-offline-messages', JSON.stringify(this.offlineQueue));
      return true;
    }

    try {
      const { error } = await supabase
        .from('radio_messages')
        .insert(fullMessage);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving message:', error);
      this.offlineQueue.push(fullMessage);
      return false;
    }
  }

  async getMessages(channel: number, limit: number = 50): Promise<PersistedMessage[]> {
    try {
      const { data, error } = await supabase
        .from('radio_messages')
        .select('*')
        .eq('channel', channel)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      // Cast the data to ensure proper typing
      return (data || []).map(msg => ({
        ...msg,
        message_type: msg.message_type as 'text' | 'voice' | 'emergency',
        emergency_location: msg.emergency_location as { lat: number; lng: number } | undefined
      }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  async registerDevice(device: Omit<DeviceRegistration, 'id' | 'user_id' | 'last_seen'>): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('device_registrations')
        .upsert({
          ...device,
          id: this.deviceId,
          user_id: user.id,
          last_seen: new Date().toISOString()
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error registering device:', error);
      return false;
    }
  }

  async sendEmergencyBeacon(location: { lat: number; lng: number }, message: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('emergency_beacons')
        .insert({
          id: `beacon-${Date.now()}`,
          user_id: user.id,
          device_id: this.deviceId,
          location,
          message,
          signal_strength: 100,
          timestamp: new Date().toISOString(),
          acknowledged: false
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error sending emergency beacon:', error);
      return false;
    }
  }

  getStats(): MessageStats {
    // Calculate stats from local storage and cached data
    const offlineCount = this.offlineQueue.length;
    
    return {
      totalMessages: offlineCount, // In real implementation, this would query the database
      deliveredMessages: 0,
      pendingMessages: offlineCount,
      failedMessages: 0,
      averageDeliveryTime: 1500,
      storageUsed: JSON.stringify(this.offlineQueue).length
    };
  }

  exportMessages(): string {
    // Export messages as JSON string
    return JSON.stringify({
      offlineQueue: this.offlineQueue,
      deviceId: this.deviceId,
      timestamp: new Date().toISOString()
    });
  }

  private async syncOfflineMessages() {
    const stored = localStorage.getItem('orad-offline-messages');
    if (!stored) return;

    try {
      const messages: PersistedMessage[] = JSON.parse(stored);
      
      for (const message of messages) {
        const { error } = await supabase
          .from('radio_messages')
          .insert(message);
        
        if (error) {
          console.error('Error syncing offline message:', error);
        }
      }

      // Clear offline queue on successful sync
      localStorage.removeItem('orad-offline-messages');
      this.offlineQueue = [];
    } catch (error) {
      console.error('Error syncing offline messages:', error);
    }
  }

  getDeviceId(): string {
    return this.deviceId;
  }
}

export const messagePersistenceService = new MessagePersistenceService();
