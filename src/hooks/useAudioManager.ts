
import { useState, useEffect, useCallback, useRef } from 'react';
import { audioManager, type AudioMetrics } from '../services/AudioManager';

interface AudioManagerHook {
  isInitialized: boolean;
  isRecording: boolean;
  audioMetrics: AudioMetrics | null;
  error: string | null;
  initialize: () => Promise<void>;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<Blob | null>;
  playAudio: (audioData: ArrayBuffer | Blob) => Promise<void>;
  setVolume: (volume: number) => void;
  setAudioChunkHandler: (handler: (chunk: Blob) => void) => void;
  clearError: () => void;
}

export const useAudioManager = (): AudioManagerHook => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioMetrics, setAudioMetrics] = useState<AudioMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioChunkHandlerRef = useRef<((chunk: Blob) => void) | null>(null);

  useEffect(() => {
    const handleInitialized = () => {
      setIsInitialized(true);
      setError(null);
    };

    const handleError = (err: Error) => {
      setError(err.message);
      setIsInitialized(false);
    };

    const handleRecordingStarted = () => {
      setIsRecording(true);
      setError(null);
    };

    const handleRecordingStopped = () => {
      setIsRecording(false);
    };

    const handleAudioChunk = (chunk: Blob) => {
      if (audioChunkHandlerRef.current) {
        audioChunkHandlerRef.current(chunk);
      }
    };

    const handleMetricsUpdate = (metrics: AudioMetrics) => {
      setAudioMetrics(metrics);
    };

    // Set up event listeners
    audioManager.on('initialized', handleInitialized);
    audioManager.on('error', handleError);
    audioManager.on('recording-started', handleRecordingStarted);
    audioManager.on('recording-stopped', handleRecordingStopped);
    audioManager.on('audio-chunk', handleAudioChunk);
    audioManager.on('metrics-updated', handleMetricsUpdate);

    return () => {
      audioManager.off('initialized', handleInitialized);
      audioManager.off('error', handleError);
      audioManager.off('recording-started', handleRecordingStarted);
      audioManager.off('recording-stopped', handleRecordingStopped);
      audioManager.off('audio-chunk', handleAudioChunk);
      audioManager.off('metrics-updated', handleMetricsUpdate);
    };
  }, []);

  const initialize = useCallback(async () => {
    try {
      await audioManager.initialize();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize audio');
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      return await audioManager.startRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      return false;
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      return await audioManager.stopRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
      return null;
    }
  }, []);

  const playAudio = useCallback(async (audioData: ArrayBuffer | Blob) => {
    try {
      await audioManager.playAudio(audioData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to play audio');
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    audioManager.setVolume(volume / 10); // Convert 0-10 to 0-1
  }, []);

  const setAudioChunkHandler = useCallback((handler: (chunk: Blob) => void) => {
    audioChunkHandlerRef.current = handler;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isInitialized,
    isRecording,
    audioMetrics,
    error,
    initialize,
    startRecording,
    stopRecording,
    playAudio,
    setVolume,
    setAudioChunkHandler,
    clearError
  };
};
