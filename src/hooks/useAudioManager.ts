
import { useState, useCallback, useRef, useEffect } from 'react';
import { audioBridge } from '../utils/nativeBridge';

export const useAudioManager = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize audio context
  useEffect(() => {
    const initAudio = async () => {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
      }
    };

    initAudio();

    return () => {
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, []);

  // Play radio sounds
  const playRadioSound = useCallback(async (type: 'ptt_on' | 'ptt_off' | 'static' | 'beep') => {
    if (!audioContextRef.current) return;

    const audioContext = audioContextRef.current;
    
    try {
      // Generate radio-like sounds
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      switch (type) {
        case 'ptt_on':
          // Quick ascending beep
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
          break;
          
        case 'ptt_off':
          // Quick descending beep
          oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
          break;
          
        case 'static':
          // White noise for static
          const bufferSize = audioContext.sampleRate * 0.5; // 0.5 seconds
          const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
          const data = buffer.getChannelData(0);
          
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.05; // Low volume static
          }
          
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(gainNode);
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          source.start(audioContext.currentTime);
          break;
          
        case 'beep':
          // Single tone beep
          oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.2);
          break;
      }
    } catch (error) {
      console.error('Failed to play radio sound:', error);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Play PTT activation sound
      await playRadioSound('ptt_on');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Start native recording if available
      await audioBridge.startRecording(true);
      
      // Start web recording as fallback/backup
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          
          // Transmit audio through native bridge
          await audioBridge.transmitAudio(arrayBuffer);
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms for real-time transmission
      setIsRecording(true);
      
      console.log('Audio recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      // Play error beep
      await playRadioSound('static');
    }
  }, [playRadioSound]);

  const stopRecording = useCallback(async () => {
    try {
      // Play PTT deactivation sound
      await playRadioSound('ptt_off');
      
      // Stop native recording
      await audioBridge.stopRecording();
      
      // Stop web recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      // Stop media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      
      setIsRecording(false);
      console.log('Audio recording stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }, [playRadioSound]);

  // Play received audio
  const playReceivedAudio = useCallback(async (audioData: ArrayBuffer | Blob) => {
    if (!audioContextRef.current) return;

    try {
      setIsPlaying(true);
      
      // Play incoming transmission sound
      await playRadioSound('beep');
      
      let arrayBuffer: ArrayBuffer;
      
      if (audioData instanceof ArrayBuffer) {
        arrayBuffer = audioData;
      } else {
        arrayBuffer = await audioData.arrayBuffer();
      }
      
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      const gainNode = audioContextRef.current.createGain();
      
      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      // Set volume
      gainNode.gain.setValueAtTime(0.8, audioContextRef.current.currentTime);
      
      source.onended = () => {
        setIsPlaying(false);
        // Play end transmission sound
        playRadioSound('static');
      };
      
      source.start();
      
    } catch (error) {
      console.error('Failed to play received audio:', error);
      setIsPlaying(false);
      await playRadioSound('static');
    }
  }, [playRadioSound]);

  // Test radio sounds
  const testRadioSounds = useCallback(async () => {
    await playRadioSound('ptt_on');
    setTimeout(() => playRadioSound('ptt_off'), 200);
    setTimeout(() => playRadioSound('beep'), 400);
    setTimeout(() => playRadioSound('static'), 600);
  }, [playRadioSound]);

  return {
    isRecording,
    isPlaying,
    startRecording,
    stopRecording,
    playReceivedAudio,
    playRadioSound,
    testRadioSounds
  };
};
