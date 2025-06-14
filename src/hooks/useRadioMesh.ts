
import { useState, useEffect, useCallback } from 'react';
import { useMeshNetwork } from './useMeshNetwork';

interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'voice';
}

export const useRadioMesh = (isPoweredOn: boolean, channel: number) => {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const { 
    networkStatus, 
    messages: meshMessages, 
    sendMessage: sendMeshMessage,
    initializeNetwork,
    destroyNetwork 
  } = useMeshNetwork();

  // Convert mesh messages to radio message format
  const messages: Message[] = meshMessages.map(msg => ({
    id: msg.id,
    sender: msg.sender,
    message: msg.content,
    timestamp: new Date(msg.timestamp),
    type: msg.type as 'text' | 'voice'
  }));

  // Initialize/destroy network based on power state
  useEffect(() => {
    if (isPoweredOn) {
      console.log(`Radio powered on - Channel ${channel}`);
      initializeNetwork();
    } else {
      destroyNetwork();
      setIsTransmitting(false);
    }
  }, [isPoweredOn, channel, initializeNetwork, destroyNetwork]);

  const sendMessage = useCallback((message: string) => {
    if (!isPoweredOn || !networkStatus.isConnected) {
      console.warn('Cannot send message: radio off or not connected');
      return;
    }

    sendMeshMessage(message, 'broadcast', 'text');
    console.log('Sending message:', message);
  }, [isPoweredOn, networkStatus.isConnected, sendMeshMessage]);

  const startTransmission = useCallback(() => {
    if (!isPoweredOn || !networkStatus.isConnected) {
      console.warn('Cannot start transmission: radio off or not connected');
      return;
    }
    setIsTransmitting(true);
    console.log('Started transmission');
  }, [isPoweredOn, networkStatus.isConnected]);

  const stopTransmission = useCallback(() => {
    setIsTransmitting(false);
    console.log('Stopped transmission');
  }, []);

  return {
    isConnected: networkStatus.isConnected,
    peerCount: networkStatus.peerCount,
    isTransmitting,
    messages,
    sendMessage,
    startTransmission,
    stopTransmission
  };
};
