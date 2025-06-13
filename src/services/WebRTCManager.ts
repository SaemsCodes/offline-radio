
import { EventEmitter } from 'events';

export interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  audioTrack: MediaStreamTrack | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'failed';
}

export interface MeshMessage {
  id: string;
  sender: string;
  destination: string;
  content: string;
  type: 'text' | 'voice' | 'route_request' | 'route_reply';
  timestamp: number;
  hopCount: number;
  sequenceNumber: number;
}

export class WebRTCManager extends EventEmitter {
  private localId: string;
  private peers: Map<string, PeerConnection> = new Map();
  private signalingSocket: WebSocket | null = null;
  private isInitialized: boolean = false;
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  constructor() {
    super();
    this.localId = this.generatePeerId();
  }

  private generatePeerId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.connectToSignalingServer();
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      console.error('WebRTC initialization failed:', error);
      this.emit('error', error);
    }
  }

  private async connectToSignalingServer(): Promise<void> {
    const signalingUrls = [
      'wss://your-signaling-server.com/ws',
      'ws://localhost:8080'
    ];

    for (const url of signalingUrls) {
      try {
        await this.attemptConnection(url);
        return;
      } catch (error) {
        console.log(`Failed to connect to ${url}, trying next...`);
      }
    }

    // Fallback to local discovery
    this.initializeLocalDiscovery();
  }

  private async attemptConnection(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.signalingSocket = new WebSocket(url);
      
      this.signalingSocket.onopen = () => {
        this.signalingSocket!.send(JSON.stringify({
          type: 'join',
          id: this.localId
        }));
        resolve();
      };

      this.signalingSocket.onmessage = (event) => {
        this.handleSignalingMessage(JSON.parse(event.data));
      };

      this.signalingSocket.onerror = () => reject(new Error('Connection failed'));
      
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  private initializeLocalDiscovery(): void {
    // Implement local peer discovery using BroadcastChannel
    const channel = new BroadcastChannel('mesh-radio-discovery');
    
    channel.postMessage({
      type: 'peer-announcement',
      peerId: this.localId,
      timestamp: Date.now()
    });

    channel.onmessage = (event) => {
      if (event.data.type === 'peer-announcement' && event.data.peerId !== this.localId) {
        this.emit('peer-discovered', event.data.peerId);
      }
    };
  }

  async createPeerConnection(peerId: string, isInitiator: boolean = false): Promise<PeerConnection> {
    const connection = new RTCPeerConnection({ iceServers: this.iceServers });
    
    const peerConnection: PeerConnection = {
      id: peerId,
      connection,
      dataChannel: null,
      audioTrack: null,
      status: 'connecting'
    };

    // Create data channel for messages
    if (isInitiator) {
      peerConnection.dataChannel = connection.createDataChannel('mesh-messages', {
        ordered: false,
        maxRetransmits: 3
      });
      this.setupDataChannel(peerConnection.dataChannel, peerId);
    }

    connection.ondatachannel = (event) => {
      peerConnection.dataChannel = event.channel;
      this.setupDataChannel(event.channel, peerId);
    };

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
      peerConnection.status = connection.connectionState as any;
      this.emit('peer-status-changed', peerId, connection.connectionState);
      
      if (connection.connectionState === 'connected') {
        this.emit('peer-connected', peerId);
      } else if (connection.connectionState === 'disconnected' || 
                 connection.connectionState === 'failed') {
        this.handlePeerDisconnection(peerId);
      }
    };

    this.peers.set(peerId, peerConnection);

    if (isInitiator) {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      
      if (this.signalingSocket?.readyState === WebSocket.OPEN) {
        this.signalingSocket.send(JSON.stringify({
          type: 'offer',
          offer,
          target: peerId,
          from: this.localId
        }));
      }
    }

    return peerConnection;
  }

  private setupDataChannel(channel: RTCDataChannel, peerId: string): void {
    channel.onopen = () => {
      console.log(`Data channel to ${peerId} opened`);
      this.emit('data-channel-opened', peerId);
    };

    channel.onmessage = (event) => {
      try {
        const message: MeshMessage = JSON.parse(event.data);
        this.emit('message-received', message, peerId);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    channel.onclose = () => {
      console.log(`Data channel to ${peerId} closed`);
      this.emit('data-channel-closed', peerId);
    };
  }

  private async handleSignalingMessage(data: any): Promise<void> {
    switch (data.type) {
      case 'offer':
        await this.handleOffer(data);
        break;
      case 'answer':
        await this.handleAnswer(data);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(data);
        break;
      case 'peer-list':
        for (const peerId of data.peers) {
          if (peerId !== this.localId && !this.peers.has(peerId)) {
            await this.createPeerConnection(peerId, true);
          }
        }
        break;
    }
  }

  private async handleOffer(data: any): Promise<void> {
    const peerConnection = await this.createPeerConnection(data.from, false);
    await peerConnection.connection.setRemoteDescription(data.offer);
    
    const answer = await peerConnection.connection.createAnswer();
    await peerConnection.connection.setLocalDescription(answer);
    
    if (this.signalingSocket?.readyState === WebSocket.OPEN) {
      this.signalingSocket.send(JSON.stringify({
        type: 'answer',
        answer,
        target: data.from,
        from: this.localId
      }));
    }
  }

  private async handleAnswer(data: any): Promise<void> {
    const peer = this.peers.get(data.from);
    if (peer) {
      await peer.connection.setRemoteDescription(data.answer);
    }
  }

  private async handleIceCandidate(data: any): Promise<void> {
    const peer = this.peers.get(data.from);
    if (peer && data.candidate) {
      await peer.connection.addIceCandidate(data.candidate);
    }
  }

  private handlePeerDisconnection(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(peerId);
      this.emit('peer-disconnected', peerId);
    }
  }

  sendMessage(message: MeshMessage): void {
    const messageStr = JSON.stringify(message);
    
    if (message.destination === 'broadcast') {
      // Broadcast to all connected peers
      for (const [peerId, peer] of this.peers) {
        if (peer.dataChannel?.readyState === 'open') {
          peer.dataChannel.send(messageStr);
        }
      }
    } else {
      // Send to specific peer
      const peer = this.peers.get(message.destination);
      if (peer?.dataChannel?.readyState === 'open') {
        peer.dataChannel.send(messageStr);
      }
    }
    
    this.emit('message-sent', message);
  }

  getPeerCount(): number {
    return Array.from(this.peers.values())
      .filter(peer => peer.status === 'connected').length;
  }

  getConnectedPeers(): string[] {
    return Array.from(this.peers.entries())
      .filter(([_, peer]) => peer.status === 'connected')
      .map(([peerId, _]) => peerId);
  }

  getLocalId(): string {
    return this.localId;
  }

  async addAudioTrack(stream: MediaStream): Promise<void> {
    const audioTrack = stream.getAudioTracks()[0];
    
    for (const [peerId, peer] of this.peers) {
      if (peer.status === 'connected') {
        peer.connection.addTrack(audioTrack, stream);
        peer.audioTrack = audioTrack;
      }
    }
  }

  async removeAudioTrack(): Promise<void> {
    for (const [peerId, peer] of this.peers) {
      if (peer.audioTrack) {
        const sender = peer.connection.getSenders()
          .find(s => s.track === peer.audioTrack);
        if (sender) {
          peer.connection.removeTrack(sender);
        }
        peer.audioTrack = null;
      }
    }
  }

  destroy(): void {
    for (const [peerId, peer] of this.peers) {
      peer.connection.close();
    }
    this.peers.clear();
    
    if (this.signalingSocket) {
      this.signalingSocket.close();
      this.signalingSocket = null;
    }
    
    this.removeAllListeners();
    this.isInitialized = false;
  }
}
