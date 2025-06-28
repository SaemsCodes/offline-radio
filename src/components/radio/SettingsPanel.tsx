
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Send, MessageSquare, Volume2, Shield } from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'voice';
}

interface SettingsPanelProps {
  isVisible: boolean;
  onClose: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  encryptionEnabled: boolean;
  onEncryptionToggle: (enabled: boolean) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isVisible,
  onClose,
  volume,
  onVolumeChange,
  encryptionEnabled,
  onEncryptionToggle
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 rounded-2xl border-2 border-gray-700 p-6 w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Volume Control */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300">Volume</span>
              </div>
              <span className="text-sm text-white font-mono">{volume}/10</span>
            </div>
            <div className="flex items-center gap-1">
              {[...Array(10)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => onVolumeChange(i + 1)}
                  className={`w-6 h-3 ${
                    i < volume ? 'bg-green-400' : 'bg-gray-600'
                  } ${i >= 7 ? 'bg-red-400' : ''} hover:opacity-80 transition-opacity`}
                />
              ))}
            </div>
          </div>

          {/* Encryption Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300">End-to-End Encryption</span>
              </div>
              <button
                onClick={() => onEncryptionToggle(!encryptionEnabled)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  encryptionEnabled ? 'bg-green-500' : 'bg-gray-600'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    encryptionEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {encryptionEnabled 
                ? 'All messages are encrypted with AES-256-GCM'
                : 'Messages are sent in plain text'
              }
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
