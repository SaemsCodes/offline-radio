
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { useAudioManager } from '../../hooks/useAudioManager';

interface EnhancedPTTButtonProps {
  onAudioData: (audioData: Blob, isEmergency?: boolean) => void;
  isEnabled: boolean;
  isTransmitting: boolean;
  volume: number;
  encryptionEnabled: boolean;
}

export const EnhancedPTTButton: React.FC<EnhancedPTTButtonProps> = ({
  onAudioData,
  isEnabled,
  isTransmitting,
  volume,
  encryptionEnabled
}) => {
  const [isPressed, setIsPressed] = useState(false);
  
  const {
    isRecording,
    isInitialized,
    error,
    startRecording,
    stopRecording,
    setAudioChunkHandler,
    clearError
  } = useAudioManager();

  // Set up real-time audio chunk handler
  useEffect(() => {
    setAudioChunkHandler((chunk: Blob) => {
      if (isPressed && isEnabled) {
        onAudioData(chunk);
      }
    });
  }, [isPressed, isEnabled, onAudioData, setAudioChunkHandler]);

  const handleMouseDown = async () => {
    if (!isEnabled || !isInitialized) return;
    
    setIsPressed(true);
    
    const success = await startRecording();
    if (!success) {
      setIsPressed(false);
    }
  };

  const handleMouseUp = async () => {
    if (!isPressed) return;
    
    setIsPressed(false);
    
    const audioBlob = await stopRecording();
    if (audioBlob && isEnabled) {
      onAudioData(audioBlob);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseDown();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseUp();
  };

  // Handle mouse leave to prevent stuck recording
  const handleMouseLeave = () => {
    if (isPressed) {
      handleMouseUp();
    }
  };

  const getButtonState = () => {
    if (!isEnabled) return 'disabled';
    if (!isInitialized) return 'loading';
    if (error) return 'error';
    if (isTransmitting || isPressed) return 'transmitting';
    return 'ready';
  };

  const getButtonStyles = () => {
    const state = getButtonState();
    
    switch (state) {
      case 'transmitting':
        return 'bg-gradient-to-b from-red-500 to-red-700 border-red-400 shadow-lg shadow-red-500/50';
      case 'ready':
        return 'bg-gradient-to-b from-orange-500 to-orange-700 border-orange-400 hover:from-orange-400 hover:to-orange-600 shadow-lg';
      case 'error':
        return 'bg-gradient-to-b from-red-600 to-red-800 border-red-500';
      case 'loading':
        return 'bg-gradient-to-b from-blue-500 to-blue-700 border-blue-400';
      default:
        return 'bg-gray-800 border-gray-600 cursor-not-allowed';
    }
  };

  const getButtonText = () => {
    const state = getButtonState();
    
    switch (state) {
      case 'transmitting':
        return 'TRANSMITTING';
      case 'ready':
        return 'PUSH TO TALK';
      case 'error':
        return 'AUDIO ERROR';
      case 'loading':
        return 'INITIALIZING';
      default:
        return 'DISABLED';
    }
  };

  const getIcon = () => {
    const state = getButtonState();
    
    if (state === 'error') {
      return <AlertCircle className="w-8 h-8 text-white" />;
    }
    
    if (state === 'transmitting') {
      return <Mic className="w-8 h-8 text-white" />;
    }
    
    if (state === 'ready') {
      return <MicOff className="w-8 h-8 text-white" />;
    }
    
    return <MicOff className="w-8 h-8 text-gray-500" />;
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-2">
          <div className="flex items-center justify-between">
            <span className="text-red-400 text-xs font-mono">{error}</span>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-300 text-xs"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      <motion.button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        disabled={!isEnabled}
        className={`w-full h-20 rounded-2xl border-4 flex items-center justify-center transition-all duration-200 select-none ${getButtonStyles()}`}
        whileTap={{ scale: 0.95 }}
        animate={
          isTransmitting || isPressed ? { 
            boxShadow: [
              '0 0 20px rgba(239, 68, 68, 0.5)', 
              '0 0 40px rgba(239, 68, 68, 0.8)', 
              '0 0 20px rgba(239, 68, 68, 0.5)'
            ]
          } : {}
        }
        transition={{ 
          repeat: (isTransmitting || isPressed) ? Infinity : 0, 
          duration: 1 
        }}
      >
        <div className="flex flex-col items-center space-y-1">
          {getIcon()}
          <span className={`text-sm font-bold ${
            isEnabled ? 'text-white' : 'text-gray-500'
          }`}>
            {getButtonText()}
          </span>
        </div>
      </motion.button>
    </div>
  );
};
