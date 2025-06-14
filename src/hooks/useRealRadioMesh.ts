
import { useState, useEffect, useCallback, useRef } from 'react';
import { webrtcCommunication } from '../services/WebRTCCommunication';
import { realAudioManager } from '../services/RealAudioManager';
import { deviceStatusManager, type RealDeviceStatus } from '../services/DeviceStatusManager';

interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'voice';
  channel: number;
  signalStrength: number;
}

export const useRealRadioMesh = (isPoweredOn: boolean, channel: number) => {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<RealDeviceStatus>({
    batteryLevel: 100,
    isCharging: false,
    isOnline: false,
    isWifiConnected: false,
    isBluetoothEnabled: false,
    networkType: 'unknown',
    signalStrength: 0,
    deviceModel: 'Unknown',
    osVersion: 'Unknown',
    isLowPowerMode: false,
    volume: 7,
    signalQuality: 'none'
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [hasPermissions, setHasPermissions] = useState(false);

  const receivingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transmissionStartTimeRef = useRef<number | null>(null);

  // Initialize permissions and device status
  useEffect(() => {
    const initializeSystem = async () => {
      if (isPoweredOn) {
        // Request audio permissions
        const audioPermission = await realAudioManager.requestPermissions();
        setHasPermissions(audioPermission);

        if (!audioPermission) {
          console.warn('Audio permissions not granted');
          realAudioManager.playRadioSound('static');
        } else {
          realAudioManager.playRadioSound('ptt_on');
        }
      }
    };

    initializeSystem();
  }, [isPoweredOn]);

  // Subscribe to device status updates
  useEffect(() => {
    const unsubscribe = deviceStatusManager.onStatusChange((status) => {
      setDeviceStatus(status);
    });

    return unsubscribe;
  }, []);

  // Handle WebRTC communication setup
  useEffect(() => {
    if (!isPoweredOn) {
      setMessages([]);
      setIsConnected(false);
      setPeerCount(0);
      return;
    }

    // Set up WebRTC event listeners
    webrtcCommunication.on('connected', (connected: boolean) => {
      setIsConnected(connected);
      if (connected) {
        realAudioManager.playRadioSound('beep');
      } else {
        realAudioManager.playRadioSound('static');
      }
    });

    webrtcCommunication.on('peer-connected', (peerId: string) => {
      setPeerCount(webrtcCommunication.getPeerCount());
      realAudioManager.playRadioSound('squelch');
      console.log(`Peer connected: ${peerId}`);
    });

    webrtcCommunication.on('peer-disconnected', (peerId: string) => {
      setPeerCount(webrtcCommunication.getPeerCount());
      console.log(`Peer disconnected: ${peerId}`);
    });

    webrtcCommunication.on('message-received', (transmission: any) => {
      setIsReceiving(true);
      
      const message: Message = {
        id: transmission.id,
        sender: transmission.senderId,
        message: transmission.content,
        timestamp: new Date(transmission.timestamp),
        type: 'text',
        channel: transmission.channel,
        signalStrength: 85 + Math.random() * 15
      };

      setMessages(prev => {
        if (prev.some(msg => msg.id === message.id)) {
          return prev;
        }
        return [...prev, message].slice(-50);
      });

      realAudioManager.playRadioSound('beep');

      // Clear receiving indicator
      if (receivingTimeoutRef.current) {
        clearTimeout(receivingTimeoutRef.current);
      }
      receivingTimeoutRef.current = setTimeout(() => {
        setIsReceiving(false);
      }, 1000);
    });

    webrtcCommunication.on('audio-received', async (audioData: any) => {
      setIsReceiving(true);
      
      // Play received audio
      await realAudioManager.playReceivedAudio(audioData.audioData);
      
      // Add voice message to chat
      const voiceMessage: Message = {
        id: `voice-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        sender: audioData.senderId,
        message: '[Voice Message]',
        timestamp: new Date(audioData.timestamp),
        type: 'voice',
        channel: audioData.channel,
        signalStrength: 80 + Math.random() * 20
      };

      setMessages(prev => [...prev, voiceMessage].slice(-50));

      // Clear receiving indicator
      if (receivingTimeoutRef.current) {
        clearTimeout(receivingTimeoutRef.current);
      }
      receivingTimeoutRef.current = setTimeout(() => {
        setIsReceiving(false);
      }, 2000);
    });

    return () => {
      if (receivingTimeoutRef.current) {
        clearTimeout(receivingTimeoutRef.current);
      }
    };
  }, [isPoweredOn]);

  // Update channel when it changes
  useEffect(() => {
    if (isPoweredOn) {
      webrtcCommunication.setChannel(channel);
      setPeerCount(webrtcCommunication.getPeerCount());
    }
  }, [isPoweredOn, channel]);

  // Update volume
  useEffect(() => {
    if (isPoweredOn) {
      realAudioManager.setVolume(deviceStatus.volume);
      deviceStatusManager.setVolume(deviceStatus.volume);
    }
  }, [deviceStatus.volume, isPoweredOn]);

  const sendMessage = useCallback(async (message: string) => {
    if (!isPoweredOn || !isConnected || !hasPermissions) {
      console.warn('Cannot send message: radio off, not connected, or no permissions');
      realAudioManager.playRadioSound('static');
      return;
    }

    try {
      const success = webrtcCommunication.sendTextMessage(message);
      
      if (success) {
        console.log('Message sent successfully');
        realAudioManager.playRadioSound('beep');
        
        // Add sent message to local display
        const sentMessage: Message = {
          id: `sent-${Date.now()}`,
          sender: 'You',
          message,
          timestamp: new Date(),
          type: 'text',
          channel,
          signalStrength: 100
        };
        
        setMessages(prev => [...prev, sentMessage].slice(-50));
        deviceStatusManager.simulateTransmission();
      } else {
        console.error('Failed to send message - no peers connected');
        realAudioManager.playRadioSound('static');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      realAudioManager.playRadioSound('static');
    }
  }, [isPoweredOn, isConnected, hasPermissions, channel]);

  const startTransmission = useCallback(async () => {
    if (!isPoweredOn || !isConnected || !hasPermissions) {
      console.warn('Cannot start transmission: radio off, not connected, or no permissions');
      realAudioManager.playRadioSound('static');
      return;
    }
    
    try {
      const success = await realAudioManager.startRecording();
      if (success) {
        setIsTransmitting(true);
        transmissionStartTimeRef.current = Date.now();
        console.log('Started voice transmission');
      } else {
        realAudioManager.playRadioSound('static');
      }
    } catch (error) {
      console.error('Failed to start transmission:', error);
      realAudioManager.playRadioSound('static');
    }
  }, [isPoweredOn, isConnected, hasPermissions]);

  const stopTransmission = useCallback(async () => {
    if (!isTransmitting) return;
    
    try {
      const audioData = await realAudioManager.stopRecording();
      setIsTransmitting(false);
      
      if (audioData && audioData.byteLength > 0) {
        // Send audio data to peers
        const success = webrtcCommunication.sendAudioData(audioData);
        
        if (success) {
          console.log(`Voice transmission sent: ${audioData.byteLength} bytes`);
          
          // Add voice message to local display
          const voiceMessage: Message = {
            id: `voice-sent-${Date.now()}`,
            sender: 'You',
            message: '[Voice Message]',
            timestamp: new Date(),
            type: 'voice',
            channel,
            signalStrength: 100
          };
          
          setMessages(prev => [...prev, voiceMessage].slice(-50));
          deviceStatusManager.simulateTransmission();
        } else {
          console.warn('No peers to send voice message to');
          realAudioManager.playRadioSound('static');
        }
      }
      
      transmissionStartTimeRef.current = null;
    } catch (error) {
      console.error('Error stopping transmission:', error);
      setIsTransmitting(false);
      realAudioManager.playRadioSound('static');
    }
  }, [isTransmitting, channel]);

  const testRadioSounds = useCallback(() => {
    console.log('Testing radio sounds...');
    realAudioManager.playRadioSound('ptt_on');
    setTimeout(() => realAudioManager.playRadioSound('ptt_off'), 200);
    setTimeout(() => realAudioManager.playRadioSound('beep'), 400);
    setTimeout(() => realAudioManager.playRadioSound('squelch'), 600);
    setTimeout(() => realAudioManager.playRadioSound('static'), 800);
  }, []);

  return {
    isConnected: isConnected && hasPermissions,
    peerCount,
    isTransmitting,
    isReceiving,
    connectionQuality: deviceStatus.signalQuality,
    batteryLevel: deviceStatus.batteryLevel,
    isCharging: deviceStatus.isCharging,
    volume: deviceStatus.volume,
    isOnline: deviceStatus.isOnline,
    isWifiConnected: deviceStatus.isWifiConnected,
    isBluetoothEnabled: deviceStatus.isBluetoothEnabled,
    networkType: deviceStatus.networkType,
    signalStrength: deviceStatus.signalStrength,
    deviceModel: deviceStatus.deviceModel,
    hasPermissions,
    messages,
    sendMessage,
    startTransmission,
    stopTransmission,
    testRadioSounds
  };
};
