
export class ServiceWorkerManager {
  private static instance: ServiceWorkerManager;
  private registration: ServiceWorkerRegistration | null = null;
  private messageQueue: any[] = [];

  private constructor() {}

  static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager();
    }
    return ServiceWorkerManager.instance;
  }

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js');
      
      console.log('Service Worker registered:', this.registration);

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));

      // Handle service worker updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is available
              console.log('New service worker available');
            }
          });
        }
      });

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, payload } = event.data;
    
    switch (type) {
      case 'BACKGROUND_SYNC_COMPLETE':
        console.log('Background sync completed');
        break;
      case 'CACHE_UPDATED':
        console.log('Cache updated');
        break;
      case 'OFFLINE_MESSAGE_QUEUED':
        console.log('Message queued for offline delivery');
        break;
    }
  }

  async queueMessage(message: any): Promise<void> {
    if (this.registration && this.registration.active) {
      this.registration.active.postMessage({
        type: 'QUEUE_MESSAGE',
        payload: message
      });
    } else {
      // Fallback to local storage
      this.messageQueue.push(message);
      localStorage.setItem('mesh-radio-message-queue', JSON.stringify(this.messageQueue));
    }
  }

  async getQueuedMessages(): Promise<any[]> {
    if (this.registration && this.registration.active) {
      return new Promise((resolve) => {
        const channel = new MessageChannel();
        
        channel.port1.onmessage = (event) => {
          resolve(event.data || []);
        };

        this.registration!.active!.postMessage(
          { type: 'GET_QUEUED_MESSAGES' },
          [channel.port2]
        );
      });
    } else {
      // Fallback to local storage
      const stored = localStorage.getItem('mesh-radio-message-queue');
      return stored ? JSON.parse(stored) : [];
    }
  }

  async clearMessageQueue(): Promise<void> {
    if (this.registration && this.registration.active) {
      this.registration.active.postMessage({
        type: 'CLEAR_MESSAGE_QUEUE'
      });
    }
    
    this.messageQueue = [];
    localStorage.removeItem('mesh-radio-message-queue');
  }

  async requestBackgroundSync(tag: string): Promise<void> {
    if (this.registration && 'sync' in this.registration) {
      try {
        await (this.registration as any).sync.register(tag);
        console.log('Background sync registered:', tag);
      } catch (error) {
        console.error('Background sync registration failed:', error);
      }
    }
  }

  isSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  isOnline(): boolean {
    return navigator.onLine;
  }
}

// Service Worker code to be placed in public/sw.js
export const serviceWorkerCode = `
const CACHE_NAME = 'mesh-radio-v1';
const MESSAGE_STORE = 'mesh-radio-messages';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/static/js/bundle.js',
        '/static/css/main.css'
      ]);
    })
  );
  
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Message event
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'QUEUE_MESSAGE':
      queueMessage(payload);
      break;
    case 'GET_QUEUED_MESSAGES':
      getQueuedMessages().then((messages) => {
        event.ports[0].postMessage(messages);
      });
      break;
    case 'CLEAR_MESSAGE_QUEUE':
      clearMessageQueue();
      break;
  }
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-message-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

// IndexedDB operations
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MeshRadioDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        messageStore.createIndex('timestamp', 'timestamp', { unique: false });
        messageStore.createIndex('type', 'type', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('peers')) {
        const peerStore = db.createObjectStore('peers', { keyPath: 'id' });
        peerStore.createIndex('lastSeen', 'lastSeen', { unique: false });
      }
    };
  });
}

async function queueMessage(message) {
  try {
    const db = await openDB();
    const tx = db.transaction(['messages'], 'readwrite');
    const store = tx.objectStore('messages');
    
    await store.add({
      ...message,
      queued: Date.now(),
      status: 'pending'
    });
    
    // Notify main thread
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'OFFLINE_MESSAGE_QUEUED',
          payload: message
        });
      });
    });
    
  } catch (error) {
    console.error('Failed to queue message:', error);
  }
}

async function getQueuedMessages() {
  try {
    const db = await openDB();
    const tx = db.transaction(['messages'], 'readonly');
    const store = tx.objectStore('messages');
    
    return await store.getAll();
  } catch (error) {
    console.error('Failed to get queued messages:', error);
    return [];
  }
}

async function clearMessageQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction(['messages'], 'readwrite');
    const store = tx.objectStore('messages');
    
    await store.clear();
  } catch (error) {
    console.error('Failed to clear message queue:', error);
  }
}

async function handleBackgroundSync() {
  console.log('Background sync triggered');
  
  try {
    const messages = await getQueuedMessages();
    const pendingMessages = messages.filter(msg => msg.status === 'pending');
    
    // Try to send pending messages
    for (const message of pendingMessages) {
      // In a real implementation, this would attempt to send via available connections
      console.log('Attempting to send queued message:', message);
    }
    
    // Notify main thread
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'BACKGROUND_SYNC_COMPLETE',
          payload: { processedCount: pendingMessages.length }
        });
      });
    });
    
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}
`;
