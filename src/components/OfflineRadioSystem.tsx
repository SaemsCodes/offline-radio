
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Radio, Send, X, Mic, MicOff, Volume2, Users, Wifi, WifiOff, Signal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OfflineRadioSystemProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'voice';
  peerId?: string;
}

// Mesh Network Protocol Implementation
class MeshNode {
  public nodeId: string;
  public peers: Map<string, any>;
  public routingTable: Map<string, { nextHop: string; hopCount: number }>;
  public messageHistory: Set<string>;
  public onMessage: (message: any) => void;
  public onPeerUpdate: (peers: string[]) => void;
  public sequenceNumber: number;

  constructor(nodeId: string, onMessage: (message: any) => void, onPeerUpdate: (peers: string[]) => void) {
    this.nodeId = nodeId;
    this.peers = new Map(); // peerId -> DataChannel
    this.routingTable = new Map(); // destination -> next hop
    this.messageHistory = new Set(); // for duplicate detection
    this.onMessage = onMessage;
    this.onPeerUpdate = onPeerUpdate;
    this.sequenceNumber = 0;
  }

  // AODV-inspired routing protocol
  updateRoutingTable(destination: string, nextHop: string, hopCount: number) {
    const existing = this.routingTable.get(destination);
    if (!existing || existing.hopCount > hopCount) {
      this.routingTable.set(destination, { nextHop, hopCount });
    }
  }

  broadcastRouteDiscovery(destination: string) {
    const rreq = {
      type: 'RREQ',
      id: `${this.nodeId}-${++this.sequenceNumber}`,
      source: this.nodeId,
      destination,
      hopCount: 0,
      timestamp: Date.now()
    };
    
    this.broadcast(rreq);
  }

  handleRouteRequest(rreq: any, fromPeer: string) {
    const messageId = rreq.id;
    if (this.messageHistory.has(messageId)) return;
    
    this.messageHistory.add(messageId);
    this.updateRoutingTable(rreq.source, fromPeer, rreq.hopCount + 1);

    if (rreq.destination === this.nodeId) {
      // Send route reply
      const rrep = {
        type: 'RREP',
        id: `${this.nodeId}-${++this.sequenceNumber}`,
        source: rreq.source,
        destination: this.nodeId,
        hopCount: 0
      };
      this.sendToPeer(fromPeer, rrep);
    } else {
      // Forward RREQ
      rreq.hopCount++;
      this.broadcast(rreq, fromPeer);
    }
  }

  handleRouteReply(rrep: any, fromPeer: string) {
    this.updateRoutingTable(rrep.destination, fromPeer, rrep.hopCount + 1);
    
    if (rrep.source !== this.nodeId) {
      const route = this.routingTable.get(rrep.source);
      if (route) {
        rrep.hopCount++;
        this.sendToPeer(route.nextHop, rrep);
      }
    }
  }

  routeMessage(message: any) {
    const messageId = `${message.sender}-${message.timestamp}`;
    if (this.messageHistory.has(messageId)) return;
    
    this.messageHistory.add(messageId);

    if (message.destination === this.nodeId || message.destination === 'broadcast') {
      this.onMessage(message);
    }

    if (message.destination === 'broadcast') {
      this.broadcast(message);
    } else {
      const route = this.routingTable.get(message.destination);
      if (route) {
        this.sendToPeer(route.nextHop, message);
      } else {
        this.broadcastRouteDiscovery(message.destination);
        // Queue message for later
        setTimeout(() => this.routeMessage(message), 1000);
      }
    }
  }

  broadcast(message: any, excludePeer: string | null = null) {
    for (const [peerId, channel] of this.peers) {
      if (peerId !== excludePeer && channel.readyState === 'open') {
        this.sendToPeer(peerId, message);
      }
    }
  }

  sendToPeer(peerId: string, message: any) {
    const channel = this.peers.get(peerId);
    if (channel && channel.readyState === 'open') {
      try {
        channel.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message to peer:', error);
      }
    }
  }

  addPeer(peerId: string, channel: any) {
    this.peers.set(peerId, channel);
    this.updateRoutingTable(peerId, peerId, 1);
    this.onPeerUpdate(Array.from(this.peers.keys()));
  }

  removePeer(peerId: string) {
    this.peers.delete(peerId);
    this.routingTable.delete(peerId);
    this.onPeerUpdate(Array.from(this.peers.keys()));
  }
}

// WebRTC Connection Manager
class WebRTCManager {
  public localId: string;
  public meshNode: MeshNode;
  public signalingSocket: WebSocket | null;
  public isConnected: boolean;
  public onConnectionStatusChange: (connected: boolean) => void;
  public connections: Map<string, RTCPeerConnection>;
  public reconnectAttempts: number;
  public maxReconnectAttempts: number;

  constructor(onMessage: (message: any) => void, onPeerUpdate: (peers: string[]) => void, onConnectionStatusChange: (connected: boolean) => void) {
    this.localId = Math.random().toString(36).substring(2, 15);
    this.meshNode = new MeshNode(this.localId, onMessage, onPeerUpdate);
    this.signalingSocket = null;
    this.isConnected = false;
    this.onConnectionStatusChange = onConnectionStatusChange;
    this.connections = new Map(); // peerId -> RTCPeerConnection
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async initialize() {
    // Register service worker for background message handling
    this.registerServiceWorker();
    
    // Try multiple signaling server URLs (fallback support)
    const signalingUrls = [
      'ws://localhost:8080/signaling',
      'wss://your-production-server.com/signaling',
      // Add more fallback URLs as needed
    ];

    for (const url of signalingUrls) {
      try {
        await this.connectToSignalingServer(url);
        if (this.isConnected) break;
      } catch (error) {
        console.log(`Failed to connect to ${url}, trying next...`);
      }
    }

    // If all signaling servers fail, use local discovery
    if (!this.isConnected) {
      console.log('All signaling servers failed, using local discovery');
      this.initializeLocalDiscovery();
    }
  }

  async connectToSignalingServer(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.signalingSocket = new WebSocket(url);
        
        this.signalingSocket.onopen = () => {
          console.log(`Connected to signaling server: ${url}`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.onConnectionStatusChange(true);
          
          this.signalingSocket!.send(JSON.stringify({
            type: 'join',
            id: this.localId,
            room: 'mesh-radio'
          }));
          
          resolve();
        };

        this.signalingSocket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          this.handleSignalingMessage(data);
        };

        this.signalingSocket.onclose = () => {
          this.isConnected = false;
          this.onConnectionStatusChange(false);
          console.log('Signaling server disconnected');
          
          // Attempt reconnection
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.initialize(), 5000 * this.reconnectAttempts);
          }
        };

        this.signalingSocket.onerror = (error) => {
          console.error('Signaling server error:', error);
          reject(error);
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.isConnected) {
            this.signalingSocket?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      const swCode = `
        const CACHE_NAME = 'mesh-radio-v1';
        const MESSAGE_QUEUE = 'mesh-radio-messages';

        self.addEventListener('install', (event) => {
          console.log('Service Worker installing...');
          self.skipWaiting();
        });

        self.addEventListener('activate', (event) => {
          console.log('Service Worker activated');
          event.waitUntil(clients.claim());
        });

        self.addEventListener('message', (event) => {
          if (event.data.type === 'QUEUE_MESSAGE') {
            // Store message for later delivery
            queueMessage(event.data.payload);
          } else if (event.data.type === 'GET_QUEUED_MESSAGES') {
            // Return queued messages
            getQueuedMessages().then(messages => {
              event.ports[0].postMessage(messages);
            });
          }
        });

        self.addEventListener('sync', (event) => {
          if (event.tag === 'background-sync') {
            event.waitUntil(handleBackgroundSync());
          }
        });

        async function queueMessage(message) {
          try {
            const db = await openDB();
            const tx = db.transaction(['messages'], 'readwrite');
            await tx.objectStore('messages').add({
              ...message,
              queued: Date.now()
            });
          } catch (error) {
            console.error('Failed to queue message:', error);
          }
        }

        async function getQueuedMessages() {
          try {
            const db = await openDB();
            const tx = db.transaction(['messages'], 'readonly');
            return await tx.objectStore('messages').getAll();
          } catch (error) {
            console.error('Failed to get queued messages:', error);
            return [];
          }
        }

        async function openDB() {
          return new Promise((resolve, reject) => {
            const request = indexedDB.open('MeshRadioDB', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
              const db = event.target.result;
              if (!db.objectStoreNames.contains('messages')) {
                db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
              }
            };
          });
        }

        async function handleBackgroundSync() {
          console.log('Background sync triggered');
          // Handle offline message queue when connection is restored
        }
      `;

      const blob = new Blob([swCode], { type: 'application/javascript' });
      const swUrl = URL.createObjectURL(blob);
      
      navigator.serviceWorker.register(swUrl)
        .then(registration => {
          console.log('Service Worker registered:', registration);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }

  initializeLocalDiscovery() {
    // Use localStorage and BroadcastChannel for local peer discovery
    const channel = new BroadcastChannel('mesh-radio-discovery');
    
    // Announce presence
    const announcement = {
      type: 'peer-announcement',
      peerId: this.localId,
      timestamp: Date.now()
    };
    
    channel.postMessage(announcement);
    
    // Listen for other peers
    channel.onmessage = (event) => {
      const { data } = event;
      if (data.type === 'peer-announcement' && data.peerId !== this.localId) {
        console.log('Discovered local peer:', data.peerId);
        // In a real implementation, you'd establish direct connections here
        // For now, we'll simulate peer connections
        this.simulateLocalPeerConnection(data.peerId);
      }
    };

    // Store peer info in localStorage
    const peers = JSON.parse(localStorage.getItem('mesh-radio-peers') || '[]');
    const myInfo = { id: this.localId, timestamp: Date.now() };
    
    // Remove old entries and add current peer
    const filteredPeers = peers.filter((p: any) => Date.now() - p.timestamp < 300000 && p.id !== this.localId);
    filteredPeers.push(myInfo);
    
    localStorage.setItem('mesh-radio-peers', JSON.stringify(filteredPeers));
  }

  simulateLocalPeerConnection(peerId: string) {
    // Simulate a peer connection for demo purposes
    const mockChannel = {
      readyState: 'open',
      send: (data: string) => {
        console.log(`Mock send to ${peerId}:`, data);
        // In a real implementation, this would send via WebRTC
      }
    };
    
    this.meshNode.addPeer(peerId, mockChannel);
  }

  async handleSignalingMessage(data: any) {
    switch (data.type) {
      case 'peer-list':
        // Connect to existing peers
        for (const peerId of data.peers) {
          if (peerId !== this.localId) {
            await this.createPeerConnection(peerId, true);
          }
        }
        break;
        
      case 'peer-joined':
        if (data.id !== this.localId) {
          await this.createPeerConnection(data.id, true);
        }
        break;
        
      case 'offer':
        await this.handleOffer(data);
        break;
        
      case 'answer':
        await this.handleAnswer(data);
        break;
        
      case 'ice-candidate':
        await this.handleIceCandidate(data);
        break;
        
      case 'peer-left':
        this.handlePeerLeft(data.id);
        break;
    }
  }

  async createPeerConnection(peerId: string, isInitiator = false) {
    if (this.connections.has(peerId)) {
      return this.connections.get(peerId);
    }

    const connection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    this.connections.set(peerId, connection);

    const dataChannel = isInitiator ? 
      connection.createDataChannel('mesh', { ordered: false }) : null;

    connection.ondatachannel = (event) => {
      const channel = event.channel;
      this.setupDataChannel(channel, peerId);
    };

    if (dataChannel) {
      this.setupDataChannel(dataChannel, peerId);
    }

    connection.onicecandidate = (event) => {
      if (event.candidate && this.signalingSocket?.readyState === WebSocket.OPEN) {
        this.signalingSocket.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          target: peerId,
          from: this.localId
        }));
      }
    };

    connection.onconnectionstatechange = () => {
      console.log(`Connection to ${peerId}: ${connection.connectionState}`);
      if (connection.connectionState === 'disconnected' || connection.connectionState === 'failed') {
        this.handlePeerLeft(peerId);
      }
    };

    if (isInitiator) {
      try {
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        
        if (this.signalingSocket?.readyState === WebSocket.OPEN) {
          this.signalingSocket.send(JSON.stringify({
            type: 'offer',
            offer: offer,
            target: peerId,
            from: this.localId
          }));
        }
      } catch (error) {
        console.error('Failed to create offer:', error);
      }
    }

    return connection;
  }

  setupDataChannel(channel: RTCDataChannel, peerId: string) {
    channel.onopen = () => {
      console.log(`Data channel to ${peerId} opened`);
      this.meshNode.addPeer(peerId, channel);
    };

    channel.onclose = () => {
      console.log(`Data channel to ${peerId} closed`);
      this.meshNode.removePeer(peerId);
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'RREQ') {
          this.meshNode.handleRouteRequest(data, peerId);
        } else if (data.type === 'RREP') {
          this.meshNode.handleRouteReply(data, peerId);
        } else {
          this.meshNode.routeMessage(data);
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };
  }

  async handleOffer(data: any) {
    try {
      const connection = await this.createPeerConnection(data.from, false);
      await connection!.setRemoteDescription(data.offer);
      
      const answer = await connection!.createAnswer();
      await connection!.setLocalDescription(answer);
      
      if (this.signalingSocket?.readyState === WebSocket.OPEN) {
        this.signalingSocket.send(JSON.stringify({
          type: 'answer',
          answer: answer,
          target: data.from,
          from: this.localId
        }));
      }
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }

  async handleAnswer(data: any) {
    try {
      const connection = this.connections.get(data.from);
      if (connection) {
        await connection.setRemoteDescription(data.answer);
      }
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }

  async handleIceCandidate(data: any) {
    try {
      const connection = this.connections.get(data.from);
      if (connection && data.candidate) {
        await connection.addIceCandidate(data.candidate);
      }
    } catch (error) {
      console.error('Failed to handle ICE candidate:', error);
    }
  }

  handlePeerLeft(peerId: string) {
    this.meshNode.removePeer(peerId);
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(peerId);
    }
  }

  sendMessage(message: any) {
    const meshMessage = {
      ...message,
      sender: this.localId,
      destination: 'broadcast',
      timestamp: Date.now()
    };
    
    this.meshNode.routeMessage(meshMessage);
  }

  getPeerCount() {
    return this.meshNode.peers.size;
  }

  getConnectionStatus() {
    return this.isConnected || this.meshNode.peers.size > 0;
  }
}

export const OfflineRadioSystem: React.FC<OfflineRadioSystemProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const modalRef = useRef<HTMLDivElement>(null);
  const webrtcManager = useRef<WebRTCManager | null>(null);

  const handleMessage = useCallback((message: any) => {
    console.log('Received message:', message);
    setMessages(prev => [...prev, {
      id: `${message.sender}-${message.timestamp}`,
      sender: message.sender === webrtcManager.current?.localId ? 'You' : `Peer-${message.sender.slice(-4)}`,
      message: message.message,
      timestamp: new Date(message.timestamp),
      type: message.type || 'text',
      peerId: message.sender
    }]);
  }, []);

  const handlePeerUpdate = useCallback((peers: string[]) => {
    console.log('Peer update:', peers);
    setPeerCount(peers.length);
    setIsConnected(peers.length > 0);
  }, []);

  const handleConnectionStatusChange = useCallback((connected: boolean) => {
    setConnectionStatus(connected ? 'connected' : 'disconnected');
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && !webrtcManager.current) {
      console.log('Initializing WebRTC Manager...');
      setConnectionStatus('connecting');
      
      webrtcManager.current = new WebRTCManager(
        handleMessage, 
        handlePeerUpdate, 
        handleConnectionStatusChange
      );
      
      webrtcManager.current.initialize();
    }

    return () => {
      if (webrtcManager.current) {
        // Cleanup connections
        webrtcManager.current.connections.forEach(connection => {
          if (connection.connectionState !== 'closed') {
            connection.close();
          }
        });
        
        if (webrtcManager.current.signalingSocket) {
          webrtcManager.current.signalingSocket.close();
        }
      }
    };
  }, [isOpen, handleMessage, handlePeerUpdate, handleConnectionStatusChange]);

  const handleSendMessage = () => {
    if (currentMessage.trim() && webrtcManager.current) {
      console.log('Sending message:', currentMessage);
      webrtcManager.current.sendMessage({
        message: currentMessage,
        type: 'text'
      });
      
      // Add to local messages
      const newMessage: ChatMessage = {
        id: `local-${Date.now()}`,
        sender: 'You',
        message: currentMessage,
        timestamp: new Date(),
        type: 'text'
      };
      setMessages(prev => [...prev, newMessage]);
      setCurrentMessage('');
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setIsTransmitting(true);
      // Simulate voice message
      setTimeout(() => {
        if (webrtcManager.current) {
          webrtcManager.current.sendMessage({
            message: '[Voice Message]',
            type: 'voice'
          });
          
          // Add to local messages
          const voiceMessage: ChatMessage = {
            id: `voice-${Date.now()}`,
            sender: 'You',
            message: '[Voice Message]',
            timestamp: new Date(),
            type: 'voice'
          };
          setMessages(prev => [...prev, voiceMessage]);
        }
        setIsTransmitting(false);
        setIsRecording(false);
      }, 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-50"
            onClick={onClose}
          />

          <motion.div
            ref={modalRef}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 h-full w-80 bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col rounded-r-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-red-50 dark:from-green-900/20 dark:to-red-900/20">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-black rounded-lg flex items-center justify-center">
                  <Radio className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Mesh Radio</h2>
                  <div className="flex items-center space-x-2 text-xs">
                    {connectionStatus === 'connected' ? (
                      <Wifi className="w-3 h-3 text-green-600" />
                    ) : connectionStatus === 'connecting' ? (
                      <Signal className="w-3 h-3 text-yellow-600 animate-pulse" />
                    ) : (
                      <WifiOff className="w-3 h-3 text-red-600" />
                    )}
                    <span className="text-gray-600 dark:text-gray-400">
                      {peerCount} peers • {connectionStatus}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* PTT Button */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col items-center space-y-4">
                <motion.button
                  onClick={toggleRecording}
                  className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isRecording 
                      ? 'bg-gradient-to-r from-red-600 to-green-600 shadow-lg shadow-red-500/50' 
                      : 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-gray-600 dark:border-gray-300 rounded-full flex items-center justify-center">
                      <div className="grid grid-cols-6 gap-1">
                        {Array.from({ length: 36 }).map((_, i) => (
                          <motion.div
                            key={i}
                            className={`w-1 h-1 rounded-full ${
                              isRecording ? 'bg-white' : 'bg-gray-600 dark:bg-gray-300'
                            }`}
                            animate={isRecording ? {
                              scale: [1, 1.2, 1],
                              opacity: [0.5, 1, 0.5]
                            } : {}}
                            transition={{
                              duration: 0.8,
                              repeat: Infinity,
                              delay: i * 0.02
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <div className="absolute inset-0 flex items-center justify-center">
                      {isRecording ? (
                        <Mic className="w-8 h-8 text-white" />
                      ) : (
                        <MicOff className="w-8 h-8 text-gray-600 dark:text-gray-300" />
                      )}
                    </div>
                  </div>
                </motion.button>

                <div className="text-center">
                  <div className={`text-sm font-medium ${
                    isRecording ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {isRecording ? 'Broadcasting...' : 'Press to Talk'}
                  </div>
                  {isTransmitting && (
                    <motion.div 
                      className="flex items-center justify-center space-x-1 mt-1"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <Volume2 className="w-4 h-4 text-green-600" />
                      <span className="text-xs text-green-600">Transmitting</span>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">
                  WebRTC Mesh Network • End-to-End Encrypted
                </div>
                
                <AnimatePresence>
                  {messages.map((msg) => (
                    <motion.div 
                      key={msg.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      className="flex flex-col space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-1">
                          <Users className="w-3 h-3" />
                          <span>{msg.sender}</span>
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className={`rounded-lg p-2 ${
                        msg.sender === 'You' 
                          ? 'bg-green-100 dark:bg-green-900/30 ml-6' 
                          : 'bg-gray-100 dark:bg-gray-800 mr-6'
                      }`}>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {msg.type === 'voice' ? (
                            <span className="flex items-center space-x-2">
                              <Volume2 className="w-4 h-4" />
                              <span>{msg.message}</span>
                            </span>
                          ) : (
                            msg.message
                          )}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!currentMessage.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-green-600 to-black hover:from-green-700 hover:to-gray-900 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                  {connectionStatus === 'connected' 
                    ? `Messages routed via ${peerCount > 0 ? 'mesh network' : 'signaling server'}`
                    : 'Attempting to connect to mesh network...'
                  }
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
