
import { useState, useEffect, useCallback, useRef } from 'react';
import { channelMeshService, type ChannelTransmission, type DeviceStatus } from '../services/ChannelMeshService';
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

  // Initialize permissions and system when powered on
  useEffect(() => {
    const initializeSystem = async () => {
      if (isPoweredOn) {
        console.log('Initializing radio system...');
        
        // Request audio permissions
        const audioPermission = await realAudioManager.requestPermissions();
        setHasPermissions(audioPermission);

        if (!audioPermission) {
          console.warn('Audio permissions not granted');
          realAudioManager.playRadioSound('static');
        } else {
          console.log('Audio permissions granted, radio ready');
          realAudioManager.playRadioSound('ptt_on');
        }
      } else {
        console.log('Radio powered off');
        setHasPermissions(false);
        setIsConnected(false);
        setPeerCount(0);
        setMessages([]);
      }
    };

    initializeSystem();
  }, [isPoweredOn]);

  // Subscribe to device status updates
  useEffect(() => {
    const unsubscribe = deviceStatusManager.onStatusChange((status) => {
      setDeviceStatus(status);
      console.log('Device status updated:', {
        battery: status.batteryLevel,
        signal: status.signalQuality,
        online: status.isOnline,
        wifi: status.isWifiConnected,
        bluetooth: status.isBluetoothEnabled
      });
    });

    return unsubscribe;
  }, []);

  // Subscribe to mesh service updates
  useEffect(() => {
    if (!isPoweredOn) {
      setIsConnected(false);
      setPeerCount(0);
      return;
    }

    const unsubscribeStatus = channelMeshService.onDeviceStatusChange((meshStatus: DeviceStatus) => {
      setIsConnected(channelMeshService.isConnected());
      setPeerCount(channelMeshService.getPeersOnCurrentChannel());
      
      console.log('Mesh status updated:', {
        connected: channelMeshService.isConnected(),
        peers: channelMeshService.getPeersOnCurrentChannel(),
        signalQuality: meshStatus.signalQuality
      });
    });

    return unsubscribeStatus;
  }, [isPoweredOn]);

  // Handle channel changes
  useEffect(() => {
    if (isPoweredOn) {
      console.log(`Switching to channel ${channel}`);
      channelMeshService.setChannel(channel);
      setPeerCount(channelMeshService.getPeersOnCurrentChannel());
      
      // Play channel change sound
      realAudioManager.playRadioSound('beep');
    }
  }, [isPoweredOn, channel]);

  // Subscribe to transmissions on current channel
  useEffect(() => {
    if (!isPoweredOn) {
      setMessages([]);
      return;
    }

    const unsubscribe = channelMeshService.onChannelTransmission(channel, (transmission: ChannelTransmission) => {
      console.log('Received transmission:', transmission);
      
      setIsReceiving(true);
      
      // Convert transmission to message format
      const message: Message = {
        id: transmission.id,
        sender: transmission.senderId,
        message: transmission.type === 'voice' ? '[Voice Message]' : getTextFromTransmission(transmission),
        timestamp: new Date(transmission.timestamp),
        type: transmission.type,
        channel: transmission.channel,
        signalStrength: transmission.signalStrength
      };

      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(msg => msg.id === message.id)) {
          return prev;
        }
        return [...prev, message].slice(-50); // Keep last 50 messages
      });

      // Handle voice playback
      if (transmission.type === 'voice') {
        playReceivedVoice(transmission);
      } else {
        realAudioManager.playRadioSound('beep');
      }

      // Clear receiving indicator after a delay
      if (receivingTimeoutRef.current) {
        clearTimeout(receivingTimeoutRef.current);
      }
      receivingTimeoutRef.current = setTimeout(() => {
        setIsReceiving(false);
      }, transmission.type === 'voice' ? 2000 : 1000);
    });

    return unsubscribe;
  }, [isPoweredOn, channel]);

  // Update volume
  useEffect(() => {
    if (isPoweredOn) {
      realAudioManager.setVolume(deviceStatus.volume);
      deviceStatusManager.setVolume(deviceStatus.volume);
    }
  }, [deviceStatus.volume, isPoweredOn]);

  const getTextFromTransmission = (transmission: ChannelTransmission): string => {
    try {
      if (typeof transmission.content === 'string') {
        const parsed = JSON.parse(transmission.content);
        return parsed.text || transmission.content;
      }
      return '[Binary Data]';
    } catch {
      return typeof transmission.content === 'string' ? transmission.content : '[Binary Data]';
    }
  };

  const playReceivedVoice = async (transmission: ChannelTransmission) => {
    try {
      if (typeof transmission.content === 'string') {
        const parsed = JSON.parse(transmission.content);
        if (parsed.audioData) {
          // Convert base64 back to ArrayBuffer and play
          const audioData = base64ToArrayBuffer(parsed.audioData);
          await realAudioManager.playReceivedAudio(audioData);
          console.log('Playing received voice message');
        }
      }
    } catch (error) {
      console.error('Failed to play received voice:', error);
      realAudioManager.playRadioSound('static');
    }
  };

  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const sendMessage = useCallback(async (message: string) => {
    if (!isPoweredOn || !isConnected || !hasPermissions) {
      console.warn('Cannot send message: radio off, not connected, or no permissions');
      realAudioManager.playRadioSound('static');
      return;
    }

    try {
      console.log(`Sending text message: "${message}"`);
      const success = await channelMeshService.transmitText(message);
      
      if (success) {
        console.log('Text message sent successfully');
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
        console.error('Failed to send text message - transmission failed');
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
      console.log('Starting voice transmission...');
      const success = await realAudioManager.startRecording();
      if (success) {
        setIsTransmitting(true);
        transmissionStartTimeRef.current = Date.now();
        realAudioManager.playRadioSound('ptt_on');
        console.log('Voice transmission started successfully');
      } else {
        console.error('Failed to start voice recording');
        realAudioManager.playRadioSound('static');
      }
    } catch (error) {
      console.error('Failed to start transmission:', error);
      realAudioManager.playRadioSound('static');
    }
  }, [isPoweredOn, isConnected, hasPermissions]);

  const stopTransmission = useCallback(async () => {
    if (!isTransmitting) {
      console.warn('Cannot stop transmission: not currently transmitting');
      return;
    }
    
    try {
      console.log('Stopping voice transmission...');
      const audioData = await realAudioManager.stopRecording();
      setIsTransmitting(false);
      realAudioManager.playRadioSound('ptt_off');
      
      if (audioData && audioData.byteLength > 0) {
        console.log(`Sending voice data: ${audioData.byteLength} bytes`);
        
        // Send audio data through mesh network
        const success = await channelMeshService.transmitVoice(audioData);
        
        if (success) {
          console.log('Voice transmission sent successfully');
          
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
          console.warn('Failed to send voice transmission');
          realAudioManager.playRadioSound('static');
        }
      } else {
        console.warn('No audio data recorded');
        realAudioManager.playRadioSound('static');
      }
      
      transmissionStartTimeRef.current = null;
    } catch (error) {
      console.error('Error stopping transmission:', error);
      setIsTransmitting(false);
      realAudioManager.playRadioSound('static');
    }
  }, [isTransmitting, channel]);

  const testRadioSounds = useCallback(() => {
    if (!isPoweredOn) return;
    
    console.log('Testing radio sounds...');
    realAudioManager.playRadioSound('ptt_on');
    setTimeout(() => realAudioManager.playRadioSound('ptt_off'), 200);
    setTimeout(() => realAudioManager.playRadioSound('beep'), 400);
    setTimeout(() => realAudioManager.playRadioSound('squelch'), 600);
    setTimeout(() => realAudioManager.playRadioSound('static'), 800);
  }, [isPoweredOn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (receivingTimeoutRef.current) {
        clearTimeout(receivingTimeoutRef.current);
      }
    };
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
