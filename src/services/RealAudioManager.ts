
import { Microphone } from '@capacitor/microphone';
import { MediaRecorder as CapacitorMediaRecorder } from '@capacitor-community/media';

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitRate: number;
  format: 'webm' | 'mp4' | 'wav';
}

class RealAudioManager {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isRecording: boolean = false;
  private isPlaying: boolean = false;
  private audioChunks: Blob[] = [];
  private gainNode: GainNode | null = null;
  private compressionNode: DynamicsCompressorNode | null = null;
  private volume: number = 0.8;
  
  private readonly audioConfig: AudioConfig = {
    sampleRate: 48000,
    channels: 1,
    bitRate: 128000,
    format: 'webm'
  };

  constructor() {
    this.initializeAudioContext();
  }

  private async initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.audioConfig.sampleRate
      });
      
      // Create audio processing nodes
      this.gainNode = this.audioContext.createGain();
      this.compressionNode = this.audioContext.createDynamicsCompressor();
      
      // Configure compressor for radio-like sound
      this.compressionNode.threshold.setValueAtTime(-24, this.audioContext.currentTime);
      this.compressionNode.knee.setValueAtTime(30, this.audioContext.currentTime);
      this.compressionNode.ratio.setValueAtTime(12, this.audioContext.currentTime);
      this.compressionNode.attack.setValueAtTime(0.003, this.audioContext.currentTime);
      this.compressionNode.release.setValueAtTime(0.25, this.audioContext.currentTime);
      
      // Connect nodes
      this.gainNode.connect(this.compressionNode);
      this.compressionNode.connect(this.audioContext.destination);
      
      this.setVolume(this.volume);
      
      console.log('Audio context initialized');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  public async requestPermissions(): Promise<boolean> {
    try {
      // Request microphone permissions using Capacitor
      const permission = await Microphone.requestPermissions();
      
      if (permission.microphone === 'granted') {
        console.log('Microphone permission granted');
        return true;
      } else {
        console.warn('Microphone permission denied');
        return false;
      }
    } catch (error) {
      console.error('Failed to request microphone permissions:', error);
      return false;
    }
  }

  public async startRecording(): Promise<boolean> {
    if (this.isRecording) return true;

    try {
      // Ensure permissions are granted
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }

      // Resume audio context if suspended
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Get user media with optimal settings for radio communication
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // Keep natural radio feel
          noiseSuppression: false, // We want to hear background
          autoGainControl: false,  // Manual gain control
          sampleRate: this.audioConfig.sampleRate,
          channelCount: this.audioConfig.channels
        }
      });

      // Create media recorder
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType,
        audioBitsPerSecond: this.audioConfig.bitRate
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        await this.processRecordedAudio();
      };

      // Start recording with 100ms chunks for real-time streaming
      this.mediaRecorder.start(100);
      this.isRecording = true;

      console.log('Recording started');
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.isRecording = false;
      return false;
    }
  }

  public async stopRecording(): Promise<ArrayBuffer | null> {
    if (!this.isRecording || !this.mediaRecorder) return null;

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const audioBuffer = await this.processRecordedAudio();
        resolve(audioBuffer);
      };

      this.mediaRecorder.stop();
      this.isRecording = false;

      // Stop media stream
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      console.log('Recording stopped');
    });
  }

  private async processRecordedAudio(): Promise<ArrayBuffer | null> {
    if (this.audioChunks.length === 0) return null;

    try {
      const audioBlob = new Blob(this.audioChunks, { 
        type: this.getSupportedMimeType() 
      });
      
      // Convert to ArrayBuffer for transmission
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Apply radio processing
      const processedBuffer = await this.applyRadioProcessing(arrayBuffer);
      
      this.audioChunks = [];
      return processedBuffer;
    } catch (error) {
      console.error('Failed to process recorded audio:', error);
      return null;
    }
  }

  private async applyRadioProcessing(audioBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.audioContext) return audioBuffer;

    try {
      // Decode audio data
      const decodedBuffer = await this.audioContext.decodeAudioData(audioBuffer.slice(0));
      
      // Apply radio-like filtering (bandpass filter)
      const filteredBuffer = this.applyBandpassFilter(decodedBuffer);
      
      // Convert back to encoded format
      return this.encodeAudioBuffer(filteredBuffer);
    } catch (error) {
      console.error('Failed to apply radio processing:', error);
      return audioBuffer;
    }
  }

  private applyBandpassFilter(audioBuffer: AudioBuffer): AudioBuffer {
    if (!this.audioContext) return audioBuffer;

    // Create a new buffer for processed audio
    const processedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    // Apply simple bandpass filter (300Hz - 3000Hz for radio sound)
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = processedBuffer.getChannelData(channel);
      
      // Simple high-pass and low-pass combination
      this.applySimpleBandpass(inputData, outputData, audioBuffer.sampleRate);
    }

    return processedBuffer;
  }

  private applySimpleBandpass(input: Float32Array, output: Float32Array, sampleRate: number) {
    // Simple bandpass filter implementation
    const lowCutoff = 300 / (sampleRate / 2);
    const highCutoff = 3000 / (sampleRate / 2);
    
    let prevInput = 0;
    let prevOutput = 0;
    
    for (let i = 0; i < input.length; i++) {
      // Simple first-order filters
      const highPassed = input[i] - prevInput;
      const bandPassed = highPassed * 0.7 + prevOutput * 0.3;
      
      output[i] = bandPassed;
      prevInput = input[i];
      prevOutput = output[i];
    }
  }

  private async encodeAudioBuffer(audioBuffer: AudioBuffer): Promise<ArrayBuffer> {
    // For now, return raw PCM data
    // In production, you might want to use opus or other compression
    const channelData = audioBuffer.getChannelData(0);
    const arrayBuffer = new ArrayBuffer(channelData.length * 4);
    const view = new Float32Array(arrayBuffer);
    view.set(channelData);
    return arrayBuffer;
  }

  public async playReceivedAudio(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext || this.isPlaying) return;

    try {
      this.isPlaying = true;
      
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Decode and play audio
      const audioBuffer = await this.decodeReceivedAudio(audioData);
      const source = this.audioContext.createBufferSource();
      
      source.buffer = audioBuffer;
      source.connect(this.gainNode!);
      
      source.onended = () => {
        this.isPlaying = false;
      };
      
      source.start();
      
      console.log('Playing received audio');
    } catch (error) {
      console.error('Failed to play received audio:', error);
      this.isPlaying = false;
    }
  }

  private async decodeReceivedAudio(audioData: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('No audio context');

    try {
      // Try to decode as encoded audio first
      return await this.audioContext.decodeAudioData(audioData.slice(0));
    } catch {
      // Fallback: treat as raw PCM data
      const float32Data = new Float32Array(audioData);
      const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, this.audioConfig.sampleRate);
      audioBuffer.getChannelData(0).set(float32Data);
      return audioBuffer;
    }
  }

  public playRadioSound(type: 'ptt_on' | 'ptt_off' | 'static' | 'beep' | 'squelch'): void {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    switch (type) {
      case 'ptt_on':
        // Quick ascending beep
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.1);
        break;
        
      case 'ptt_off':
        // Quick descending beep
        oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.1);
        break;
        
      case 'squelch':
        // Short static burst
        this.generateStaticNoise(0.2, 0.1);
        break;
        
      case 'static':
        // Longer static
        this.generateStaticNoise(1.0, 0.05);
        break;
        
      case 'beep':
        // Single tone beep
        oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.3);
        break;
    }
  }

  private generateStaticNoise(duration: number, volume: number): void {
    if (!this.audioContext) return;

    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start();
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume / 10));
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioContext?.currentTime || 0);
    }
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return 'audio/webm';
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public destroy(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    
    if (this.audioContext?.state !== 'closed') {
      this.audioContext?.close();
    }
  }
}

export const realAudioManager = new RealAudioManager();
