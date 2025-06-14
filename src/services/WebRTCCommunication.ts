
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';

export interface WebRTCPeer {
  id: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  lastSeen: number;
  channel: number;
}

export interface AudioPacket {
  id: string;
  senderId: string;
  channel: number;
  audioData: ArrayBuffer;
  timestamp: number;
  sequenceNumber: number;
}

class WebRTCCommunication {
  private localId: string = '';
  private peers: Map<string, WebRTCPeer> = new Map();
  private signalingSocket: WebSocket | null = null;
  private currentChannel: number = 1;
  private isConnected: boolean = false;
  private audioSequence: number = 0;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor() {
    this.initializeLocalId();
    this.setupSignaling();
  }

  private async initializeLocalId() {
    try {
      const deviceInfo = await Device.getId();
      this.localId = `RADIO-${deviceInfo.uuid}`;
    } catch {
      this.localId = `RADIO-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  private setupSignaling() {
    // Use a WebSocket signaling server for peer discovery
    // In production, this could be a local mesh discovery service
    const signalingUrl = 'wss://mesh-radio-signaling.herokuapp.com';
    
    try {
      this.signalingSocket = new WebSocket(signalingUrl);
      
      this.signalingSocket.onopen = () => {
        console.log('Signaling connected');
        this.signalingSocket?.send(JSON.stringify({
          type: 'register',
          id: this.localId,
          channel: this.currentChannel
        }));
        this.isConnected = true;
        this.emit('connected', true);
      };

      this.signalingSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleSignalingMessage(data);
      };

      this.signalingSocket.onclose = () => {
        this.isConnected = false;
        this.emit('connected', false);
        // Attempt reconnection
        setTimeout(() => this.setupSignaling(), 5000);
      };
    } catch (error) {
      console.error('Signaling setup failed:', error);
      // Fallback to local peer discovery
      this.setupLocalDiscovery();
    }
  }

  private setupLocalDiscovery() {
    // Implement local network discovery using broadcast
    console.log('Using local discovery mode');
    this.isConnected = true;
    this.emit('connected', true);
  }

  private async handleSignalingMessage(data: any) {
    switch (data.type) {
      case 'peer-discovered':
        if (data.id !== this.localId) {
          await this.connectToPeer(data.id);
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
    }
  }

  private async connectToPeer(peerId: string): Promise<void> {
    if (this.peers.has(peerId)) return;

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    const dataChannel = peerConnection.createDataChannel('radio', {
      ordered: false,
      maxRetransmits: 0
    });

    this.setupDataChannel(dataChannel, peerId);
    this.setupPeerConnection(peerConnection, peerId);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    this.signalingSocket?.send(JSON.stringify({
      type: 'offer',
      target: peerId,
      from: this.localId,
      offer: offer
    }));

    this.peers.set(peerId, {
      id: peerId,
      connection: peerConnection,
      dataChannel,
      lastSeen: Date.now(),
      channel: this.currentChannel
    });
  }

  private setupDataChannel(dataChannel: RTCDataChannel, peerId: string) {
    dataChannel.onopen = () => {
      console.log(`Data channel open with ${peerId}`);
      this.emit('peer-connected', peerId);
    };

    dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handlePeerMessage(data, peerId);
      } catch {
        // Handle binary audio data
        this.handleAudioData(event.data, peerId);
      }
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed with ${peerId}`);
      this.peers.delete(peerId);
      this.emit('peer-disconnected', peerId);
    };
  }

  private setupPeerConnection(peerConnection: RTCPeerConnection, peerId: string) {
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingSocket?.send(JSON.stringify({
          type: 'ice-candidate',
          target: peerId,
          from: this.localId,
          candidate: event.candidate
        }));
      }
    };
  }

  private handlePeerMessage(data: any, fromPeer: string) {
    switch (data.type) {
      case 'text-message':
        if (data.channel === this.currentChannel) {
          this.emit('message-received', {
            id: data.id,
            senderId: fromPeer,
            content: data.content,
            channel: data.channel,
            timestamp: data.timestamp,
            type: 'text'
          });
        }
        break;
      case 'channel-change':
        const peer = this.peers.get(fromPeer);
        if (peer) {
          peer.channel = data.channel;
        }
        break;
    }
  }

  private handleAudioData(audioData: ArrayBuffer, fromPeer: string) {
    const peer = this.peers.get(fromPeer);
    if (peer && peer.channel === this.currentChannel) {
      this.emit('audio-received', {
        senderId: fromPeer,
        audioData,
        channel: peer.channel,
        timestamp: Date.now()
      });
    }
  }

  public setChannel(channel: number) {
    this.currentChannel = channel;
    
    // Notify all peers of channel change
    const message = {
      type: 'channel-change',
      channel: channel,
      timestamp: Date.now()
    };

    this.peers.forEach((peer) => {
      if (peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify(message));
      }
    });

    // Update signaling server
    this.signalingSocket?.send(JSON.stringify({
      type: 'channel-change',
      id: this.localId,
      channel: channel
    }));
  }

  public sendTextMessage(content: string): boolean {
    const message = {
      type: 'text-message',
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      channel: this.currentChannel,
      timestamp: Date.now()
    };

    let sent = false;
    this.peers.forEach((peer) => {
      if (peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify(message));
        sent = true;
      }
    });

    return sent;
  }

  public sendAudioData(audioData: ArrayBuffer): boolean {
    let sent = false;
    this.peers.forEach((peer) => {
      if (peer.dataChannel.readyState === 'open' && peer.channel === this.currentChannel) {
        peer.dataChannel.send(audioData);
        sent = true;
      }
    });

    return sent;
  }

  public getPeerCount(): number {
    return Array.from(this.peers.values()).filter(
      peer => peer.channel === this.currentChannel && 
      peer.dataChannel.readyState === 'open'
    ).length;
  }

  public isNetworkConnected(): boolean {
    return this.isConnected;
  }

  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }

  private async handleOffer(data: any) {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    this.setupPeerConnection(peerConnection, data.from);

    peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, data.from);
      this.peers.set(data.from, {
        id: data.from,
        connection: peerConnection,
        dataChannel: event.channel,
        lastSeen: Date.now(),
        channel: this.currentChannel
      });
    };

    await peerConnection.setRemoteDescription(data.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    this.signalingSocket?.send(JSON.stringify({
      type: 'answer',
      target: data.from,
      from: this.localId,
      answer: answer
    }));
  }

  private async handleAnswer(data: any) {
    const peer = this.peers.get(data.from);
    if (peer) {
      await peer.connection.setRemoteDescription(data.answer);
    }
  }

  private async handleIceCandidate(data: any) {
    const peer = this.peers.get(data.from);
    if (peer) {
      await peer.connection.addIceCandidate(data.candidate);
    }
  }

  public destroy() {
    this.peers.forEach(peer => {
      peer.connection.close();
    });
    this.peers.clear();
    this.signalingSocket?.close();
    this.listeners.clear();
  }
}

export const webrtcCommunication = new WebRTCCommunication();
