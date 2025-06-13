
import { useState, useEffect, useCallback, useRef } from 'react';

interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'voice';
}

export const useRadioMesh = (isPoweredOn: boolean, channel: number) => {
  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const webrtcManager = useRef<any>(null);

  // Initialize mesh network when powered on
  useEffect(() => {
    if (isPoweredOn && !webrtcManager.current) {
      // Initialize WebRTC mesh network
      console.log(`Radio powered on - Channel ${channel}`);
      
      // Simulate connection after a delay
      const connectTimer = setTimeout(() => {
        setIsConnected(true);
        setPeerCount(Math.floor(Math.random() * 5) + 1);
      }, 2000);

      return () => clearTimeout(connectTimer);
    } else if (!isPoweredOn) {
      setIsConnected(false);
      setPeerCount(0);
      setIsTransmitting(false);
      webrtcManager.current = null;
    }
  }, [isPoweredOn, channel]);

  const sendMessage = useCallback((message: string) => {
    if (!isPoweredOn || !isConnected) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'You',
      message,
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, newMessage]);
    console.log('Sending message:', message);
  }, [isPoweredOn, isConnected]);

  const startTransmission = useCallback(() => {
    if (!isPoweredOn || !isConnected) return;
    setIsTransmitting(true);
    console.log('Started transmission');
  }, [isPoweredOn, isConnected]);

  const stopTransmission = useCallback(() => {
    setIsTransmitting(false);
    console.log('Stopped transmission');
  }, []);

  return {
    isConnected,
    peerCount,
    isTransmitting,
    messages,
    sendMessage,
    startTransmission,
    stopTransmission
  };
};
