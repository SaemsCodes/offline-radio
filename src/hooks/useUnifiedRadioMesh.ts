
import { useState, useEffect, useCallback } from 'react';
import { unifiedMeshService, type DeviceStatus, type ChannelTransmission } from '../services/UnifiedMeshService';
import { useAudioManager } from './useAudioManager';

interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'voice';
  channel: number;
  signalStrength: number;
}

export const useUnifiedRadioMesh = (isPoweredOn: boolean, channel: number) => {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    batteryLevel: 100,
    isOnline: false,
    isWifiConnected: false,
    isBluetoothEnabled: false,
    volume: 7,
    signalQuality: 'none',
    networkMetrics: {
      totalPeers: 0,
      activePeers: 0,
      averageLatency: 0,
      networkReliability: 0,
      availableTransports: []
    }
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isReceiving, setIsReceiving] = useState(false);

  const { 
    playAudio, 
    metrics: audioMetrics, 
    isInitialized: audioInitialized 
  } = useAudioManager();

  // Update channel when it changes
  useEffect(() => {
    if (isPoweredOn) {
      unifiedMeshService.setChannel(channel);
    }
  }, [isPoweredOn, channel]);

  // Subscribe to device status updates
  useEffect(() => {
    const unsubscribe = unifiedMeshService.onDeviceStatusChange((status) => {
      setDeviceStatus(status);
    });

    return unsubscribe;
  }, []);

  // Subscribe to transmissions on current channel
  useEffect(() => {
    if (!isPoweredOn) {
      setMessages([]);
      return;
    }

    const unsubscribe = unifiedMeshService.onChannelTransmission(channel, (transmission: ChannelTransmission) => {
      setIsReceiving(true);
      
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
        if (prev.some(msg => msg.id === message.id)) {
          return prev;
        }
        return [...prev, message].slice(-50);
      });

      // Play received voice messages
      if (transmission.type === 'voice' && transmission.content instanceof ArrayBuffer) {
        playAudio(transmission.content);
      }

      setTimeout(() => setIsReceiving(false), 1000);
    });

    return unsubscribe;
  }, [isPoweredOn, channel, playAudio]);

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

  const sendMessage = useCallback(async (message: string) => {
    if (!isPoweredOn || deviceStatus.signalQuality === 'none') {
      console.warn('Cannot send message: radio off or no signal');
      return;
    }

    try {
      const success = await unifiedMeshService.transmitText(message);
      if (success) {
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
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [isPoweredOn, deviceStatus.signalQuality, channel]);

  const handleAudioData = useCallback(async (audioData: Blob) => {
    if (!isPoweredOn || deviceStatus.signalQuality === 'none') {
      console.warn('Cannot transmit audio: radio off or no signal');
      return;
    }

    try {
      const arrayBuffer = await audioData.arrayBuffer();
      const success = await unifiedMeshService.transmitVoice(arrayBuffer);
      
      if (success) {
        const voiceMessage: Message = {
          id: `voice-${Date.now()}`,
          sender: 'You',
          message: '[Voice Message]',
          timestamp: new Date(),
          type: 'voice',
          channel,
          signalStrength: 100
        };
        
        setMessages(prev => [...prev, voiceMessage].slice(-50));
      }
    } catch (error) {
      console.error('Error transmitting audio:', error);
    }
  }, [isPoweredOn, deviceStatus.signalQuality, channel]);

  return {
    isConnected: deviceStatus.signalQuality !== 'none' && audioInitialized,
    peerCount: unifiedMeshService.getPeersOnCurrentChannel(),
    isTransmitting,
    isReceiving,
    connectionQuality: deviceStatus.signalQuality,
    batteryLevel: deviceStatus.batteryLevel,
    volume: deviceStatus.volume,
    isOnline: deviceStatus.isOnline,
    isWifiConnected: deviceStatus.isWifiConnected,
    isBluetoothEnabled: deviceStatus.isBluetoothEnabled,
    messages,
    audioMetrics,
    sendMessage,
    handleAudioData
  };
};
