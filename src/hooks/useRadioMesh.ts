
import { useState, useEffect, useCallback } from 'react';
import { useMeshNetwork } from './useMeshNetwork';
import { useAudioManager } from './useAudioManager';

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
    sendAudioMessage,
    initializeNetwork,
    destroyNetwork,
    onAudioReceived 
  } = useMeshNetwork();
  
  const {
    isRecording,
    isPlaying,
    startRecording,
    stopRecording,
    playReceivedAudio,
    playRadioSound,
    testRadioSounds
  } = useAudioManager();

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
      // Play power-on sound
      playRadioSound('beep');
    } else {
      destroyNetwork();
      setIsTransmitting(false);
    }
  }, [isPoweredOn, channel, initializeNetwork, destroyNetwork, playRadioSound]);

  // Set up audio reception handler
  useEffect(() => {
    if (isPoweredOn) {
      onAudioReceived(async (audioData: ArrayBuffer, fromPeer: string) => {
        console.log(`Received audio from ${fromPeer}, size: ${audioData.byteLength} bytes`);
        await playReceivedAudio(audioData);
        
        // Add voice message to chat
        const voiceMessage: Message = {
          id: `voice-${Date.now()}-${Math.random()}`,
          sender: fromPeer,
          message: '[Voice Message]',
          timestamp: new Date(),
          type: 'voice'
        };
        // Note: This would need to be handled by the mesh network hook
      });
    }
  }, [isPoweredOn, onAudioReceived, playReceivedAudio]);

  const sendMessage = useCallback((message: string) => {
    if (!isPoweredOn || !networkStatus.isConnected) {
      console.warn('Cannot send message: radio off or not connected');
      playRadioSound('static');
      return;
    }

    sendMeshMessage(message, 'broadcast', 'text');
    console.log('Sending message:', message);
  }, [isPoweredOn, networkStatus.isConnected, sendMeshMessage, playRadioSound]);

  const startTransmission = useCallback(async () => {
    if (!isPoweredOn || !networkStatus.isConnected) {
      console.warn('Cannot start transmission: radio off or not connected');
      await playRadioSound('static');
      return;
    }
    
    setIsTransmitting(true);
    await startRecording();
    console.log('Started transmission');
  }, [isPoweredOn, networkStatus.isConnected, startRecording, playRadioSound]);

  const stopTransmission = useCallback(async () => {
    setIsTransmitting(false);
    await stopRecording();
    console.log('Stopped transmission');
  }, [stopRecording]);

  return {
    isConnected: networkStatus.isConnected,
    peerCount: networkStatus.peerCount,
    isTransmitting: isTransmitting || isRecording,
    isReceiving: isPlaying,
    connectionQuality: networkStatus.connectionQuality,
    messages,
    sendMessage,
    startTransmission,
    stopTransmission,
    testRadioSounds
  };
};
