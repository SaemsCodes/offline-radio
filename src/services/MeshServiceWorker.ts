
import { MeshMessage } from './WebRTCManager';

export class MeshServiceWorker {
  private static instance: MeshServiceWorker | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private messageQueue: MeshMessage[] = [];

  static getInstance(): MeshServiceWorker {
    if (!MeshServiceWorker.instance) {
      MeshServiceWorker.instance = new MeshServiceWorker();
    }
    return MeshServiceWorker.instance;
  }

  async register(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Mesh service worker registered successfully');
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
        
        // Send queued messages when service worker is ready
        if (this.messageQueue.length > 0) {
          this.sendQueuedMessages();
        }
      } catch (error) {
        console.error('Failed to register mesh service worker:', error);
      }
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, payload } = event.data;
    
    switch (type) {
      case 'MESH_MESSAGE_RECEIVED':
        this.dispatchMeshMessage(payload);
        break;
      case 'PEER_DISCOVERED':
        this.dispatchPeerEvent('discovered', payload);
        break;
      case 'PEER_LOST':
        this.dispatchPeerEvent('lost', payload);
        break;
    }
  }

  private dispatchMeshMessage(message: MeshMessage): void {
    window.dispatchEvent(new CustomEvent('meshMessageReceived', { detail: message }));
  }

  private dispatchPeerEvent(type: 'discovered' | 'lost', peerId: string): void {
    window.dispatchEvent(new CustomEvent(`meshPeer${type === 'discovered' ? 'Discovered' : 'Lost'}`, { 
      detail: { peerId } 
    }));
  }

  async queueMessage(message: MeshMessage): Promise<void> {
    if (this.registration && this.registration.active) {
      this.registration.active.postMessage({
        type: 'QUEUE_MESH_MESSAGE',
        payload: message
      });
    } else {
      this.messageQueue.push(message);
    }
  }

  private sendQueuedMessages(): void {
    if (this.registration && this.registration.active && this.messageQueue.length > 0) {
      this.messageQueue.forEach(message => {
        this.registration!.active!.postMessage({
          type: 'QUEUE_MESH_MESSAGE',
          payload: message
        });
      });
      this.messageQueue = [];
    }
  }

  async enableBackgroundSync(): Promise<void> {
    if (this.registration && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        await this.registration.sync.register('mesh-message-sync');
        console.log('Background sync registered for mesh messages');
      } catch (error) {
        console.error('Failed to register background sync:', error);
      }
    }
  }

  async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const isPersistent = await navigator.storage.persist();
        console.log(`Persistent storage ${isPersistent ? 'granted' : 'denied'}`);
        return isPersistent;
      } catch (error) {
        console.error('Failed to request persistent storage:', error);
        return false;
      }
    }
    return false;
  }
}
