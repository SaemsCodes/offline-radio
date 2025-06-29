
import { useState, useEffect, useCallback, useRef } from 'react';

export interface AudioMetrics {
  inputLevel: number;
  outputLevel: number;
  noiseLevel: number;
  signalToNoise: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  bitrate: number;
  latency: number;
}

export const useAudioManager = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AudioMetrics>({
    inputLevel: 0,
    outputLevel: 0,
    noiseLevel: 0,
    signalToNoise: 0,
    quality: 'poor',
    bitrate: 0,
    latency: 0
  });

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chunkHandlerRef = useRef<((chunk: Blob) => void) | null>(null);
  const metricsIntervalRef = useRef<number | null>(null);

  const initialize = useCallback(async () => {
    if (isInitialized) return true;

    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      mediaStreamRef.current = stream;

      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Set up analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Start metrics monitoring
      metricsIntervalRef.current = window.setInterval(() => {
        updateMetrics();
      }, 100);

      setIsInitialized(true);
      setError(null);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize audio';
      setError(errorMessage);
      return false;
    }
  }, [isInitialized]);

  const updateMetrics = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate RMS level
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    const inputLevel = Math.round((rms / 255) * 100);

    // Estimate noise floor
    const sortedData = Array.from(dataArray).sort((a, b) => a - b);
    const noiseFloor = sortedData.slice(0, Math.floor(bufferLength * 0.1))
      .reduce((sum, val) => sum + val, 0) / (bufferLength * 0.1);
    const noiseLevel = Math.round((noiseFloor / 255) * 100);

    // Calculate signal-to-noise ratio
    const signalToNoise = inputLevel > 0 ? Math.round(20 * Math.log10(inputLevel / Math.max(noiseLevel, 1))) : 0;

    // Determine quality
    let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    if (signalToNoise > 40 && inputLevel > 30) quality = 'excellent';
    else if (signalToNoise > 25 && inputLevel > 20) quality = 'good';
    else if (signalToNoise > 15 && inputLevel > 10) quality = 'fair';

    setMetrics({
      inputLevel,
      outputLevel: inputLevel,
      noiseLevel,
      signalToNoise,
      quality,
      bitrate: 64000,
      latency: audioContextRef.current ? Math.round(audioContextRef.current.baseLatency * 1000) : 0
    });
  }, []);

  const startRecording = useCallback(async () => {
    if (!mediaStreamRef.current || !isInitialized) {
      return false;
    }

    try {
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(mediaStreamRef.current, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          if (chunkHandlerRef.current) {
            chunkHandlerRef.current(event.data);
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // 100ms chunks for real-time
      setIsRecording(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      return false;
    }
  }, [isInitialized]);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !isRecording) {
      return null;
    }

    return new Promise<Blob | null>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        setIsRecording(false);
        resolve(audioBlob);
      };
      
      recorder.stop();
    });
  }, [isRecording]);

  const playAudio = useCallback(async (audioData: ArrayBuffer | Blob) => {
    if (!audioContextRef.current) return;

    try {
      let arrayBuffer: ArrayBuffer;
      
      if (audioData instanceof Blob) {
        arrayBuffer = await audioData.arrayBuffer();
      } else {
        arrayBuffer = audioData;
      }

      const decodedAudio = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(audioContextRef.current.destination);
      source.start();
    } catch (err) {
      console.error('Failed to play audio:', err);
    }
  }, []);

  const setAudioChunkHandler = useCallback((handler: (chunk: Blob) => void) => {
    chunkHandlerRef.current = handler;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isInitialized,
    isRecording,
    error,
    metrics,
    initialize,
    startRecording,
    stopRecording,
    playAudio,
    setAudioChunkHandler,
    clearError
  };
};
