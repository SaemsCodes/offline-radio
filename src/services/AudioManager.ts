
import { EventEmitter } from 'events';

export interface AudioConfig {
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  latency: number;
}

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
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioWorklet: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private isRecording = false;
  private isPlaying = false;
  private audioChunks: Blob[] = [];
  private metrics: AudioMetrics = {
    inputLevel: 0,
    outputLevel: 0,
    noiseLevel: 0,
    signalToNoise: 0,
    quality: 'poor',
    bitrate: 0,
    latency: 0
  };

  private config: AudioConfig = {
    sampleRate: 48000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    latency: 0.02 // 20ms target latency
  };

  constructor(config?: Partial<AudioConfig>) {
    super();
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.initialize();
  }

  private async initialize() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate,
        latencyHint: this.config.latency
      });

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.emit('initialized');
    } catch (error) {
      console.error('Audio initialization failed:', error);
      this.emit('error', error);
    }
  }

  async startRecording(): Promise<boolean> {
    if (!this.audioContext || this.isRecording) return false;

    try {
      // Get user media with optimized constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
          latency: this.config.latency
        }
      });

      // Create audio processing chain
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Add analyser for real-time audio metrics
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      // Add gain control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // Add compressor for dynamic range control
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      // Connect processing chain
      source.connect(this.gainNode);
      this.gainNode.connect(this.compressor);
      this.compressor.connect(this.analyser);

      // Start media recorder with optimized settings
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: this.getSupportedMimeType(),
        audioBitsPerSecond: 64000 // Optimize for voice
      });

      this.setupMediaRecorderEvents();
      this.mediaRecorder.start(100); // Capture every 100ms for real-time transmission

      this.isRecording = true;
      this.startMetricsMonitoring();
      
      this.emit('recording-started');
      return true;

    } catch (error) {
      console.error('Failed to start recording:', error);
      this.emit('error', error);
      return false;
    }
  }

  async stopRecording(): Promise<Blob | null> {
    if (!this.isRecording || !this.mediaRecorder) return null;

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { 
          type: this.getSupportedMimeType() 
        });
        this.audioChunks = [];
        resolve(audioBlob);
      };

      this.mediaRecorder!.stop();
      this.cleanup();
      this.isRecording = false;
      this.emit('recording-stopped');
    });
  }

  async playAudio(audioData: ArrayBuffer | Blob): Promise<void> {
    if (!this.audioContext || this.isPlaying) return;

    try {
      this.isPlaying = true;
      this.emit('playback-started');

      let arrayBuffer: ArrayBuffer;
      if (audioData instanceof Blob) {
        arrayBuffer = await audioData.arrayBuffer();
      } else {
        arrayBuffer = audioData;
      }

      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      const source = this.audioContext.createBufferSource();
      const outputGain = this.audioContext.createGain();

      source.buffer = audioBuffer;
      source.connect(outputGain);
      outputGain.connect(this.audioContext.destination);

      // Set output volume
      outputGain.gain.value = 0.8;

      source.onended = () => {
        this.isPlaying = false;
        this.emit('playback-ended');
      };

      source.start();

    } catch (error) {
      console.error('Audio playback failed:', error);
      this.isPlaying = false;
      this.emit('error', error);
    }
  }

  private setupMediaRecorderEvents() {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
        this.emit('audio-chunk', event.data);
      }
    };

    this.mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error);
      this.emit('error', error);
    };
  }

  private startMetricsMonitoring() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(bufferLength);

    const updateMetrics = () => {
      if (!this.isRecording || !this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);
      this.analyser.getByteTimeDomainData(timeDataArray);

      // Calculate input level (RMS)
      let sum = 0;
      for (let i = 0; i < timeDataArray.length; i++) {
        const normalized = (timeDataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / timeDataArray.length);
      this.metrics.inputLevel = Math.round(rms * 100);

      // Calculate noise level and signal-to-noise ratio
      const noiseFloor = Math.min(...Array.from(dataArray));
      const signalPeak = Math.max(...Array.from(dataArray));
      this.metrics.noiseLevel = noiseFloor;
      this.metrics.signalToNoise = signalPeak - noiseFloor;

      // Determine quality based on metrics
      if (this.metrics.signalToNoise > 40) {
        this.metrics.quality = 'excellent';
      } else if (this.metrics.signalToNoise > 25) {
        this.metrics.quality = 'good';
      } else if (this.metrics.signalToNoise > 15) {
        this.metrics.quality = 'fair';
      } else {
        this.metrics.quality = 'poor';
      }

      this.emit('metrics-updated', this.metrics);
      requestAnimationFrame(updateMetrics);
    };

    updateMetrics();
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm';
  }

  private cleanup() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.compressor) {
      this.compressor.disconnect();
      this.compressor = null;
    }
  }

  setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  getMetrics(): AudioMetrics {
    return { ...this.metrics };
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  async destroy() {
    this.cleanup();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.removeAllListeners();
  }
}

export const audioManager = new AudioManager();
