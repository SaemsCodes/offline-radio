
export interface PersistedMessage {
  id: string;
  senderId: string;
  recipientId?: string;
  channel: number;
  content: string | ArrayBuffer;
  type: 'text' | 'voice';
  timestamp: number;
  encrypted: boolean;
  delivered: boolean;
  acknowledged: boolean;
  priority: 'low' | 'normal' | 'high' | 'emergency';
  retryCount: number;
  expiresAt?: number;
}

export interface MessageStats {
  totalMessages: number;
  deliveredMessages: number;
  pendingMessages: number;
  failedMessages: number;
  averageDeliveryTime: number;
  storageUsed: number;
}

export class MessagePersistenceService {
  private storageKey = 'mesh-radio-messages';
  private maxMessages = 1000;
  private maxRetries = 3;
  private messages: Map<string, PersistedMessage> = new Map();
  private deliveryQueue: PersistedMessage[] = [];
  private retryInterval: number | null = null;

  constructor() {
    this.loadMessages();
    this.startRetryService();
    this.startCleanupService();
  }

  private loadMessages() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        data.forEach((msg: PersistedMessage) => {
          // Convert ArrayBuffer back from base64 if needed
          if (msg.type === 'voice' && typeof msg.content === 'string' && msg.content.startsWith('data:')) {
            const base64 = msg.content.split(',')[1];
            msg.content = Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
          }
          this.messages.set(msg.id, msg);
          
          if (!msg.delivered) {
            this.deliveryQueue.push(msg);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load persisted messages:', error);
    }
  }

  private saveMessages() {
    try {
      const messages = Array.from(this.messages.values()).map(msg => {
        // Convert ArrayBuffer to base64 for storage
        if (msg.type === 'voice' && msg.content instanceof ArrayBuffer) {
          const uint8Array = new Uint8Array(msg.content);
          const base64 = btoa(String.fromCharCode(...uint8Array));
          return { ...msg, content: `data:audio/wav;base64,${base64}` };
        }
        return msg;
      });
      
      localStorage.setItem(this.storageKey, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to save messages:', error);
      // Cleanup old messages if storage is full
      this.cleanupOldMessages(0.8);
    }
  }

  storeMessage(
    id: string,
    senderId: string,
    channel: number,
    content: string | ArrayBuffer,
    type: 'text' | 'voice',
    encrypted: boolean = false,
    priority: 'low' | 'normal' | 'high' | 'emergency' = 'normal',
    recipientId?: string,
    expiresIn?: number
  ): PersistedMessage {
    const message: PersistedMessage = {
      id,
      senderId,
      recipientId,
      channel,
      content,
      type,
      timestamp: Date.now(),
      encrypted,
      delivered: false,
      acknowledged: false,
      priority,
      retryCount: 0,
      expiresAt: expiresIn ? Date.now() + expiresIn : undefined
    };

    this.messages.set(id, message);
    this.deliveryQueue.push(message);
    
    // Cleanup if we have too many messages
    if (this.messages.size > this.maxMessages) {
      this.cleanupOldMessages(0.9);
    }

    this.saveMessages();
    return message;
  }

  markDelivered(messageId: string, deliveryTime?: number) {
    const message = this.messages.get(messageId);
    if (message) {
      message.delivered = true;
      if (deliveryTime) {
        (message as any).deliveryTime = deliveryTime;
      }
      this.messages.set(messageId, message);
      
      // Remove from delivery queue
      this.deliveryQueue = this.deliveryQueue.filter(m => m.id !== messageId);
      this.saveMessages();
    }
  }

  markAcknowledged(messageId: string) {
    const message = this.messages.get(messageId);
    if (message) {
      message.acknowledged = true;
      this.messages.set(messageId, message);
      this.saveMessages();
    }
  }

  getPendingMessages(priority?: PersistedMessage['priority']): PersistedMessage[] {
    let pending = this.deliveryQueue.filter(m => 
      !m.delivered && 
      m.retryCount < this.maxRetries &&
      (!m.expiresAt || m.expiresAt > Date.now())
    );

    if (priority) {
      pending = pending.filter(m => m.priority === priority);
    }

    // Sort by priority and timestamp
    return pending.sort((a, b) => {
      const priorityOrder = { emergency: 4, high: 3, normal: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return a.timestamp - b.timestamp;
    });
  }

  getMessages(
    channel?: number, 
    type?: 'text' | 'voice',
    limit: number = 50
  ): PersistedMessage[] {
    let messages = Array.from(this.messages.values());
    
    if (channel !== undefined) {
      messages = messages.filter(m => m.channel === channel);
    }
    
    if (type) {
      messages = messages.filter(m => m.type === type);
    }
    
    return messages
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  retryFailedMessage(messageId: string): boolean {
    const message = this.messages.get(messageId);
    if (message && message.retryCount < this.maxRetries) {
      message.retryCount++;
      this.messages.set(messageId, message);
      
      if (!this.deliveryQueue.find(m => m.id === messageId)) {
        this.deliveryQueue.push(message);
      }
      
      this.saveMessages();
      return true;
    }
    return false;
  }

  private startRetryService() {
    this.retryInterval = window.setInterval(() => {
      const failedMessages = this.deliveryQueue.filter(m => 
        !m.delivered && 
        m.retryCount > 0 && 
        m.retryCount < this.maxRetries
      );

      failedMessages.forEach(message => {
        console.log(`Retrying message ${message.id} (attempt ${message.retryCount + 1})`);
        // Trigger retry via event system
        window.dispatchEvent(new CustomEvent('mesh-retry-message', { 
          detail: { messageId: message.id } 
        }));
      });
    }, 30000); // Retry every 30 seconds
  }

  private startCleanupService() {
    // Cleanup expired and old messages every hour
    setInterval(() => {
      this.cleanupExpiredMessages();
      if (this.messages.size > this.maxMessages * 0.8) {
        this.cleanupOldMessages(0.7);
      }
    }, 3600000); // 1 hour
  }

  private cleanupExpiredMessages() {
    const now = Date.now();
    const expired: string[] = [];
    
    this.messages.forEach((message, id) => {
      if (message.expiresAt && message.expiresAt < now) {
        expired.push(id);
      }
    });
    
    expired.forEach(id => this.messages.delete(id));
    this.deliveryQueue = this.deliveryQueue.filter(m => !expired.includes(m.id));
    
    if (expired.length > 0) {
      this.saveMessages();
      console.log(`Cleaned up ${expired.length} expired messages`);
    }
  }

  private cleanupOldMessages(keepRatio: number) {
    const messages = Array.from(this.messages.values())
      .sort((a, b) => b.timestamp - a.timestamp);
    
    const keepCount = Math.floor(messages.length * keepRatio);
    const toRemove = messages.slice(keepCount);
    
    toRemove.forEach(message => {
      this.messages.delete(message.id);
    });
    
    this.deliveryQueue = this.deliveryQueue.filter(m => 
      !toRemove.find(removed => removed.id === m.id)
    );
    
    this.saveMessages();
    console.log(`Cleaned up ${toRemove.length} old messages`);
  }

  getStats(): MessageStats {
    const messages = Array.from(this.messages.values());
    const delivered = messages.filter(m => m.delivered);
    const pending = messages.filter(m => !m.delivered && m.retryCount < this.maxRetries);
    const failed = messages.filter(m => !m.delivered && m.retryCount >= this.maxRetries);
    
    const deliveryTimes = delivered
      .map(m => (m as any).deliveryTime)
      .filter(t => t > 0);
    
    const averageDeliveryTime = deliveryTimes.length > 0 
      ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length 
      : 0;

    // Estimate storage usage
    const storageUsed = new Blob([localStorage.getItem(this.storageKey) || '']).size;

    return {
      totalMessages: messages.length,
      deliveredMessages: delivered.length,
      pendingMessages: pending.length,
      failedMessages: failed.length,
      averageDeliveryTime,
      storageUsed
    };
  }

  exportMessages(channel?: number): string {
    const messages = this.getMessages(channel, undefined, 1000);
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      channel,
      messageCount: messages.length,
      messages: messages.map(m => ({
        ...m,
        content: m.type === 'voice' ? '[Voice Message]' : m.content
      }))
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  clearAllMessages() {
    this.messages.clear();
    this.deliveryQueue = [];
    localStorage.removeItem(this.storageKey);
  }

  shutdown() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
    this.saveMessages();
  }
}

export const messagePersistenceService = new MessagePersistenceService();
