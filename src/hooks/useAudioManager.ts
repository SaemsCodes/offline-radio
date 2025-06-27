
import { useState, useEffect, useCallback, useRef } from 'react';
import { audioManager, type AudioMetrics } from '../services/AudioManager';

export const useAudioManager = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [metrics, setMetrics] = useState<AudioMetrics>({
    inputLevel: 0,
    outputLevel: 0,
    noiseLevel: 0,
    signalToNoise: 0,
    quality: 'poor',
    bitrate: 0,
    latency: 0
  });
  const [error, setError] = useState<string | null>(null);
  
  const audioChunkHandlerRef = useRef<((chunk: Blob) => void) | null>(null);

  useEffect(() => {
    const handleInitialized = () => {
      setIsInitialized(true);
      setError(null);
    };

    const handleRecordingStarted = () => {
      setIsRecording(true);
      setError(null);
    };

    const handleRecordingStopped = () => {
      setIsRecording(false);
    };

    const handlePlaybackStarted = () => {
      setIsPlaying(true);
    };

    const handlePlaybackEnded = () => {
      setIsPlaying(false);
    };

    const handleMetricsUpdated = (newMetrics: AudioMetrics) => {
      setMetrics(newMetrics);
    };

    const handleError = (error: any) => {
      setError(error.message || 'Audio error occurred');
      setIsRecording(false);
      setIsPlaying(false);
    };

    const handleAudioChunk = (chunk: Blob) => {
      if (audioChunkHandlerRef.current) {
        audioChunkHandlerRef.current(chunk);
      }
    };

    // Add event listeners
    audioManager.on('initialized', handleInitialized);
    audioManager.on('recording-started', handleRecordingStarted);
    audioManager.on('recording-stopped', handleRecordingStopped);
    audioManager.on('playback-started', handlePlaybackStarted);
    audioManager.on('playback-ended', handlePlaybackEnded);
    audioManager.on('metrics-updated', handleMetricsUpdated);
    audioManager.on('error', handleError);
    audioManager.on('audio-chunk', handleAudioChunk);

    // Cleanup
    return () => {
      audioManager.off('initialized', handleInitialized);
      audioManager.off('recording-started', handleRecordingStarted);
      audioManager.off('recording-stopped', handleRecordingStopped);
      audioManager.off('playback-started', handlePlaybackStarted);
      audioManager.off('playback-ended', handlePlaybackEnded);
      audioManager.off('metrics-updated', handleMetricsUpdated);
      audioManager.off('error', handleError);
      audioManager.off('audio-chunk', handleAudioChunk);
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!isInitialized) {
      setError('Audio manager not initialized');
      return false;
    }

    try {
      const success = await audioManager.startRecording();
      if (!success) {
        setError('Failed to start recording');
      }
      return success;
    } catch (error) {
      setError('Failed to start recording');
      return false;
    }
  }, [isInitialized]);

  const stopRecording = useCallback(async () => {
    try {
      const audioBlob = await audioManager.stopRecording();
      return audioBlob;
    } catch (error) {
      setError('Failed to stop recording');
      return null;
    }
  }, []);

  const playAudio = useCallback(async (audioData: ArrayBuffer | Blob) => {
    if (!isInitialized) {
      setError('Audio manager not initialized');
      return false;
    }

    try {
      await audioManager.playAudio(audioData);
      return true;
    } catch (error) {
      setError('Failed to play audio');
      return false;
    }
  }, [isInitialized]);

  const setVolume = useCallback((volume: number) => {
    audioManager.setVolume(volume / 10); // Convert from 0-10 scale to 0-1
  }, []);

  const setAudioChunkHandler = useCallback((handler: (chunk: Blob) => void) => {
    audioChunkHandlerRef.current = handler;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isRecording,
    isPlaying,
    isInitialized,
    metrics,
    error,
    startRecording,
    stopRecording,
    playAudio,
    setVolume,
    setAudioChunkHandler,
    clearError
  };
};
