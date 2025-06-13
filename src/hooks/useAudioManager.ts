
import { useState, useRef, useCallback, useEffect } from 'react';

export interface AudioSettings {
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  voiceActivityDetection: boolean;
}

export interface AudioManager {
  isRecording: boolean;
  isPlaying: boolean;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  playAudio: (audioData: Blob) => Promise<void>;
  stopPlayback: () => void;
  setSettings: (settings: Partial<AudioSettings>) => void;
  getSettings: () => AudioSettings;
  getDevices: () => Promise<MediaDeviceInfo[]>;
  setInputDevice: (deviceId: string) => Promise<void>;
  setOutputDevice: (deviceId: string) => Promise<void>;
}

const DEFAULT_SETTINGS: AudioSettings = {
  sampleRate: 16000, // Optimized for voice
  channelCount: 1,   // Mono for mesh radio
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  voiceActivityDetection: true
};

export const useAudioManager = (): AudioManager => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [settings, setSettingsState] = useState<AudioSettings>(DEFAULT_SETTINGS);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Audio level monitoring
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    
    const average = sum / bufferLength;
    setAudioLevel(average / 255); // Normalize to 0-1

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording]);

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      if (isRecording) return;

      const constraints: MediaStreamConstraints = {
        audio: {
          sampleRate: { ideal: settings.sampleRate },
          channelCount: { ideal: settings.channelCount },
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      audioStreamRef.current = stream;

      // Set up audio analysis
      if (audioContextRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
      }

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // 100ms chunks for real-time processing
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Start audio level monitoring
      updateAudioLevel();

    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Microphone access denied or not available');
    }
  }, [isRecording, settings, updateAudioLevel]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!isRecording || !mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
      
      // Cleanup
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      setIsRecording(false);
      setAudioLevel(0);
      mediaRecorderRef.current = null;
    });
  }, [isRecording]);

  const playAudio = useCallback(async (audioData: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const audioUrl = URL.createObjectURL(audioData);
        const audio = new Audio(audioUrl);
        
        currentAudioRef.current = audio;
        
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          resolve();
        };

        audio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          reject(new Error('Audio playback failed'));
        };

        setIsPlaying(true);
        audio.play();
        
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  const stopPlayback = useCallback((): void => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const setSettings = useCallback((newSettings: Partial<AudioSettings>): void => {
    setSettingsState(prev => ({ ...prev, ...newSettings }));
  }, []);

  const getSettings = useCallback((): AudioSettings => {
    return { ...settings };
  }, [settings]);

  const getDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput');
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      return [];
    }
  }, []);

  const setInputDevice = useCallback(async (deviceId: string): Promise<void> => {
    // This would require restarting the recording with the new device
    // For now, just update the constraint for next recording session
    if (isRecording) {
      await stopRecording();
    }
    // Device selection would be handled in startRecording with deviceId constraint
  }, [isRecording, stopRecording]);

  const setOutputDevice = useCallback(async (deviceId: string): Promise<void> => {
    // Set output device for playback
    if (currentAudioRef.current && 'setSinkId' in currentAudioRef.current) {
      try {
        await (currentAudioRef.current as any).setSinkId(deviceId);
      } catch (error) {
        console.error('Failed to set output device:', error);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
      if (isPlaying) {
        stopPlayback();
      }
    };
  }, [isRecording, isPlaying, stopRecording, stopPlayback]);

  return {
    isRecording,
    isPlaying,
    audioLevel,
    startRecording,
    stopRecording,
    playAudio,
    stopPlayback,
    setSettings,
    getSettings,
    getDevices,
    setInputDevice,
    setOutputDevice
  };
};
