
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
