
import { useState, useEffect, useCallback, useRef } from 'react';
import { WebRTCManager, MeshMessage } from '../services/WebRTCManager';
import { MeshRoutingManager } from '../services/MeshRoutingManager';

export interface NetworkStatus {
  isConnected: boolean;
  peerCount: number;
  localId: string;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  lastActivity: Date | null;
}

export interface MeshNetworkHook {
  networkStatus: NetworkStatus;
  messages: MeshMessage[];
  sendMessage: (content: string, destination?: string, type?: 'text' | 'voice') => void;
  sendBroadcast: (content: string, type?: 'text' | 'voice') => void;
  sendAudioMessage: (audioData: ArrayBuffer, destination?: string) => void;
  initializeNetwork: () => Promise<void>;
  destroyNetwork: () => void;
  getConnectedPeers: () => string[];
  isTransmitting: boolean;
  setIsTransmitting: (transmitting: boolean) => void;
  onAudioReceived: (callback: (audioData: ArrayBuffer, fromPeer: string) => void) => void;
}

export const useMeshNetwork = (): MeshNetworkHook => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: false,
    peerCount: 0,
    localId: '',
    connectionQuality: 'disconnected',
    lastActivity: null
  });
  
  const [messages, setMessages] = useState<MeshMessage[]>([]);
  const [isTransmitting, setIsTransmitting] = useState(false);
  
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const routingManagerRef = useRef<MeshRoutingManager | null>(null);
  const qualityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingMessagesRef = useRef<MeshMessage[]>([]);
  const audioCallbackRef = useRef<((audioData: ArrayBuffer, fromPeer: string) => void) | null>(null);

  // Initialize network components
  const initializeNetwork = useCallback(async (): Promise<void> => {
    if (webrtcManagerRef.current) {
      return; // Already initialized
    }

    try {
      const webrtcManager = new WebRTCManager();
      const routingManager = new MeshRoutingManager(webrtcManager.getLocalId());

      webrtcManagerRef.current = webrtcManager;
      routingManagerRef.current = routingManager;

      // Set up WebRTC event handlers
      webrtcManager.on('initialized', () => {
        setNetworkStatus(prev => ({
          ...prev,
          localId: webrtcManager.getLocalId(),
          isConnected: true,
          lastActivity: new Date()
        }));
      });

      webrtcManager.on('peer-connected', (peerId: string) => {
        setNetworkStatus(prev => ({
          ...prev,
          peerCount: webrtcManager.getPeerCount(),
          lastActivity: new Date()
        }));
        
        // Send any pending messages
        const pending = pendingMessagesRef.current.splice(0);
        pending.forEach(message => {
          webrtcManager.sendMessage(message);
        });
      });

      webrtcManager.on('peer-disconnected', (peerId: string) => {
        setNetworkStatus(prev => ({
          ...prev,
          peerCount: webrtcManager.getPeerCount(),
          lastActivity: new Date()
        }));
        
        // Update routing table
        routingManager.updatePeerConnectivity(peerId, false);
      });

      webrtcManager.on('message-received', (message: MeshMessage, fromPeer: string) => {
        // Handle audio messages specifically
        if (message.type === 'voice' && audioCallbackRef.current) {
          try {
            // Decode base64 audio data
            const audioData = base64ToArrayBuffer(message.content);
            audioCallbackRef.current(audioData, fromPeer);
          } catch (error) {
            console.error('Failed to decode audio message:', error);
          }
        }
        
        // Handle routing
        const nextHop = routingManager.routeMessage(message);
        
        setNetworkStatus(prev => ({
          ...prev,
          lastActivity: new Date()
        }));
      });

      // Set up routing event handlers
      routingManager.on('message-for-local-node', (message: MeshMessage) => {
        setMessages(prev => [...prev, message]);
      });

      routingManager.on('broadcast-route-request', (routeRequest: any) => {
        const requestMessage: MeshMessage = {
          id: routeRequest.id,
          sender: routeRequest.source,
          destination: 'broadcast',
          content: JSON.stringify(routeRequest),
          type: 'route_request',
          timestamp: routeRequest.timestamp,
          hopCount: routeRequest.hopCount,
          sequenceNumber: routeRequest.sequenceNumber
        };
        webrtcManager.sendMessage(requestMessage);
      });

      routingManager.on('send-route-reply', (routeReply: any, targetPeer: string) => {
        const replyMessage: MeshMessage = {
          id: routeReply.id,
          sender: webrtcManager.getLocalId(),
          destination: targetPeer,
          content: JSON.stringify(routeReply),
          type: 'route_reply',
          timestamp: Date.now(),
          hopCount: routeReply.hopCount,
          sequenceNumber: routeReply.sequenceNumber
        };
        webrtcManager.sendMessage(replyMessage);
      });

      routingManager.on('forward-message', (message: MeshMessage, nextHop: string) => {
        webrtcManager.sendMessage(message);
      });

      routingManager.on('forward-broadcast', (message: MeshMessage) => {
        webrtcManager.sendMessage(message);
      });

      // Start connection quality monitoring
      qualityCheckIntervalRef.current = setInterval(() => {
        updateConnectionQuality();
      }, 5000);

      // Initialize WebRTC
      await webrtcManager.initialize();
      
    } catch (error) {
      console.error('Failed to initialize mesh network:', error);
      setNetworkStatus(prev => ({
        ...prev,
        isConnected: false,
        connectionQuality: 'disconnected'
      }));
      throw error;
    }
  }, []);

  // Update connection quality based on various metrics
  const updateConnectionQuality = useCallback(() => {
    if (!webrtcManagerRef.current) return;

    const peerCount = webrtcManagerRef.current.getPeerCount();
    const lastActivity = networkStatus.lastActivity;
    const timeSinceActivity = lastActivity ? Date.now() - lastActivity.getTime() : Infinity;

    let quality: NetworkStatus['connectionQuality'] = 'disconnected';

    if (peerCount === 0) {
      quality = 'disconnected';
    } else if (timeSinceActivity > 30000) { // 30 seconds
      quality = 'poor';
    } else if (peerCount >= 3) {
      quality = 'excellent';
    } else if (peerCount >= 1) {
      quality = 'good';
    }

    setNetworkStatus(prev => ({
      ...prev,
      connectionQuality: quality
    }));
  }, [networkStatus.lastActivity]);

  // Send text message
  const sendMessage = useCallback((content: string, destination: string = 'broadcast', type: 'text' | 'voice' = 'text'): void => {
    if (!webrtcManagerRef.current || !routingManagerRef.current) {
      console.warn('Network not initialized');
      return;
    }

    const message = routingManagerRef.current.createMessage(content, destination, type);
    
    if (webrtcManagerRef.current.getPeerCount() > 0) {
      webrtcManagerRef.current.sendMessage(message);
      
      // Add to local messages if it's for us or broadcast
      if (destination === 'broadcast' || destination === webrtcManagerRef.current.getLocalId()) {
        setMessages(prev => [...prev, message]);
      }
    } else {
      // Queue message for later if no peers connected
      pendingMessagesRef.current.push(message);
    }

    setNetworkStatus(prev => ({
      ...prev,
      lastActivity: new Date()
    }));
  }, []);

  // Send audio message
  const sendAudioMessage = useCallback((audioData: ArrayBuffer, destination: string = 'broadcast'): void => {
    if (!webrtcManagerRef.current || !routingManagerRef.current) {
      console.warn('Network not initialized');
      return;
    }

    // Convert audio data to base64 for transmission
    const base64Audio = arrayBufferToBase64(audioData);
    const message = routingManagerRef.current.createMessage(base64Audio, destination, 'voice');
    
    if (webrtcManagerRef.current.getPeerCount() > 0) {
      webrtcManagerRef.current.sendMessage(message);
      console.log(`Sent audio message to ${destination}, size: ${audioData.byteLength} bytes`);
    } else {
      console.warn('No peers connected to send audio message');
    }

    setNetworkStatus(prev => ({
      ...prev,
      lastActivity: new Date()
    }));
  }, []);

  // Convenience method for broadcasting
  const sendBroadcast = useCallback((content: string, type: 'text' | 'voice' = 'text'): void => {
    sendMessage(content, 'broadcast', type);
  }, [sendMessage]);

  // Get list of connected peers
  const getConnectedPeers = useCallback((): string[] => {
    return webrtcManagerRef.current?.getConnectedPeers() || [];
  }, []);

  // Set callback for received audio
  const onAudioReceived = useCallback((callback: (audioData: ArrayBuffer, fromPeer: string) => void): void => {
    audioCallbackRef.current = callback;
  }, []);

  // Cleanup network on unmount
  const destroyNetwork = useCallback((): void => {
    if (qualityCheckIntervalRef.current) {
      clearInterval(qualityCheckIntervalRef.current);
      qualityCheckIntervalRef.current = null;
    }

    if (routingManagerRef.current) {
      routingManagerRef.current.destroy();
      routingManagerRef.current = null;
    }

    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.destroy();
      webrtcManagerRef.current = null;
    }

    setNetworkStatus({
      isConnected: false,
      peerCount: 0,
      localId: '',
      connectionQuality: 'disconnected',
      lastActivity: null
    });

    setMessages([]);
    pendingMessagesRef.current = [];
    audioCallbackRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyNetwork();
    };
  }, [destroyNetwork]);

  return {
    networkStatus,
    messages,
    sendMessage,
    sendBroadcast,
    sendAudioMessage,
    initializeNetwork,
    destroyNetwork,
    getConnectedPeers,
    isTransmitting,
    setIsTransmitting,
    onAudioReceived
  };
};

// Utility functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
