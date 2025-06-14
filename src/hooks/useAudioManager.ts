
import { useState, useCallback } from 'react';
import { audioBridge } from '../utils/nativeBridge';

export const useAudioManager = () => {
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = useCallback(async () => {
    try {
      await audioBridge.startRecording(true);
      setIsRecording(true);
      console.log('Audio recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      await audioBridge.stopRecording();
      setIsRecording(false);
      console.log('Audio recording stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording
  };
};
