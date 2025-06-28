import { EventEmitter } from 'events';

export interface AudioMetrics {
  inputLevel: number;
  outputLevel: number;
  noiseLevel: number;
  signalToNoise: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  bitrate: number;
  latency: number;
}

export class AudioManager extends EventEmitter {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private gainNode: GainNode | null = null;
  private noiseSuppressionNode: AudioWorkletNode | null = null;
  private isInitialized: boolean = false;
  private isRecording: boolean = false;
  private audioChunks: Blob[] = [];
  private metricsUpdateInterval: number | null = null;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Get user media with high-quality constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      // Set up audio processing
      await this.setupAudioProcessing();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('Audio manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio manager:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async setupAudioProcessing(): Promise<void> {
    if (!this.audioContext || !this.mediaStream) return;

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    // Create analyser for metrics
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    
    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.0;
    
    // Connect audio nodes
    source.connect(this.analyser);
    this.analyser.connect(this.gainNode);
    
    // Start metrics monitoring
    this.startMetricsMonitoring();
  }

  async startRecording(): Promise<boolean> {
    if (!this.isInitialized || !this.mediaStream) {
      throw new Error('Audio manager not initialized');
    }

    try {
      this.audioChunks = [];
      
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.emit('audio-chunk', event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
        this.emit('recording-stopped', audioBlob);
      };

      this.mediaRecorder.start(100); // 100ms chunks for real-time transmission
      this.isRecording = true;
      this.emit('recording-started');
      
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.emit('error', error);
      return false;
    }
  }

  async stopRecording(): Promise<Blob | null> {
    if (!this.mediaRecorder || !this.isRecording) {
      return null;
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
        this.isRecording = false;
        resolve(audioBlob);
      };
      
      this.mediaRecorder!.stop();
    });
  }

  async playAudio(audioData: ArrayBuffer | Blob): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    try {
      let arrayBuffer: ArrayBuffer;
      
      if (audioData instanceof Blob) {
        arrayBuffer = await audioData.arrayBuffer();
      } else {
        arrayBuffer = audioData;
      }

      const decodedAudio = await this.audioContext.decodeAudioData(arrayBuffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = decodedAudio;
      
      if (this.gainNode) {
        source.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
      } else {
        source.connect(this.audioContext.destination);
      }

      this.emit('playback-started');
      
      source.onended = () => {
        this.emit('playback-ended');
      };
      
      source.start();
    } catch (error) {
      console.error('Failed to play audio:', error);
      this.emit('error', error);
      throw error;
    }
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  private startMetricsMonitoring(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }

    this.metricsUpdateInterval = window.setInterval(() => {
      if (this.analyser) {
        const metrics = this.calculateMetrics();
        this.emit('metrics-updated', metrics);
      }
    }, 100);
  }

  private calculateMetrics(): AudioMetrics {
    if (!this.analyser) {
      return {
        inputLevel: 0,
        outputLevel: 0,
        noiseLevel: 0,
        signalToNoise: 0,
        quality: 'poor',
        bitrate: 0,
        latency: 0
      };
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate RMS level
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    const inputLevel = Math.round((rms / 255) * 100);

    // Estimate noise floor (lowest 10% of frequencies)
    const sortedData = Array.from(dataArray).sort((a, b) => a - b);
    const noiseFloor = sortedData.slice(0, Math.floor(bufferLength * 0.1))
      .reduce((sum, val) => sum + val, 0) / (bufferLength * 0.1);
    const noiseLevel = Math.round((noiseFloor / 255) * 100);

    // Calculate signal-to-noise ratio
    const signalToNoise = inputLevel > 0 ? Math.round(20 * Math.log10(inputLevel / Math.max(noiseLevel, 1))) : 0;

    // Determine quality based on S/N ratio and input level
    let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    if (signalToNoise > 40 && inputLevel > 30) quality = 'excellent';
    else if (signalToNoise > 25 && inputLevel > 20) quality = 'good';
    else if (signalToNoise > 15 && inputLevel > 10) quality = 'fair';

    return {
      inputLevel,
      outputLevel: inputLevel, // Simplified - same as input for now
      noiseLevel,
      signalToNoise,
      quality,
      bitrate: 64000, // Opus codec estimate
      latency: this.audioContext ? Math.round(this.audioContext.baseLatency * 1000) : 0
    };
  }

  async destroy(): Promise<void> {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
    }

    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.isInitialized = false;
    this.removeAllListeners();
  }
}

export const audioManager = new AudioManager();
