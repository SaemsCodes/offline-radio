
import { useState, useEffect, useCallback } from 'react';
import { unifiedMeshService, type DeviceStatus, type ChannelTransmission } from '../services/UnifiedMeshService';

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
    signalQuality: 'none'
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isReceiving, setIsReceiving] = useState(false);

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

      setTimeout(() => setIsReceiving(false), 1000);
    });

    return unsubscribe;
  }, [isPoweredOn, channel]);

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

  const startTransmission = useCallback(async () => {
    if (!isPoweredOn || deviceStatus.signalQuality === 'none') {
      console.warn('Cannot start transmission: radio off or no signal');
      return;
    }
    
    setIsTransmitting(true);
  }, [isPoweredOn, deviceStatus.signalQuality]);

  const stopTransmission = useCallback(async () => {
    setIsTransmitting(false);
    
    if (isPoweredOn && deviceStatus.signalQuality !== 'none') {
      const simulatedAudio = new ArrayBuffer(1024);
      await unifiedMeshService.transmitVoice(simulatedAudio);
    }
  }, [isPoweredOn, deviceStatus.signalQuality]);

  const testRadioSounds = useCallback(() => {
    console.log('Testing radio sounds...');
  }, []);

  return {
    isConnected: deviceStatus.signalQuality !== 'none',
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
    sendMessage,
    startTransmission,
    stopTransmission,
    testRadioSounds
  };
};
