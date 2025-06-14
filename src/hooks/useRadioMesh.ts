
import { useState, useEffect, useCallback } from 'react';
import { channelMeshService, type DeviceStatus, type ChannelTransmission } from '../services/ChannelMeshService';

interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'voice';
  channel: number;
  signalStrength: number;
}

export const useRadioMesh = (isPoweredOn: boolean, channel: number) => {
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
      channelMeshService.setChannel(channel);
    }
  }, [isPoweredOn, channel]);

  // Subscribe to device status updates
  useEffect(() => {
    const unsubscribe = channelMeshService.onDeviceStatusChange((status) => {
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

    const unsubscribe = channelMeshService.onChannelTransmission(channel, (transmission: ChannelTransmission) => {
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
      }

      // Clear receiving indicator after a delay
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

  const playReceivedVoice = (transmission: ChannelTransmission) => {
    try {
      if (typeof transmission.content === 'string') {
        const parsed = JSON.parse(transmission.content);
        if (parsed.audioData) {
          // Convert base64 back to ArrayBuffer and play
          const audioData = base64ToArrayBuffer(parsed.audioData);
          playAudioData(audioData);
        }
      }
    } catch (error) {
      console.error('Failed to play received voice:', error);
    }
  };

  const playAudioData = async (audioData: ArrayBuffer) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(audioData);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.error('Failed to play audio data:', error);
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
    if (!isPoweredOn || deviceStatus.signalQuality === 'none') {
      console.warn('Cannot send message: radio off or no signal');
      return;
    }

    try {
      const success = await channelMeshService.transmitText(message);
      if (success) {
        console.log('Message sent successfully');
        
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
      } else {
        console.error('Failed to send message');
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
    console.log('Started voice transmission');
  }, [isPoweredOn, deviceStatus.signalQuality]);

  const stopTransmission = useCallback(async () => {
    setIsTransmitting(false);
    console.log('Stopped voice transmission');
    
    // In a real implementation, this would capture and send the recorded audio
    // For now, we'll simulate sending a voice message
    if (isPoweredOn && deviceStatus.signalQuality !== 'none') {
      // Simulate audio data
      const simulatedAudio = new ArrayBuffer(1024);
      await channelMeshService.transmitVoice(simulatedAudio);
    }
  }, [isPoweredOn, deviceStatus.signalQuality]);

  const testRadioSounds = useCallback(() => {
    console.log('Testing radio sounds...');
    // This would trigger various radio sound effects
  }, []);

  return {
    isConnected: deviceStatus.signalQuality !== 'none',
    peerCount: channelMeshService.getPeersOnCurrentChannel(),
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
