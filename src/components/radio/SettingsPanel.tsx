
import React from 'react';
import { motion } from 'framer-motion';
import { X, Volume2, Shield } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 rounded-2xl border-2 border-gray-700 p-6 w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Radio Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Volume Control */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300">Volume</span>
              </div>
              <span className="text-sm text-white font-mono">{volume}/10</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={volume}
              onChange={(e) => onVolumeChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Encryption Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className={`w-4 h-4 ${encryptionEnabled ? 'text-green-400' : 'text-gray-400'}`} />
              <div>
                <span className="text-sm text-gray-300">Encryption</span>
                <p className="text-xs text-gray-500">End-to-end message encryption</p>
              </div>
            </div>
            <button
              onClick={() => onEncryptionToggle(!encryptionEnabled)}
              className={`w-12 h-6 rounded-full border-2 transition-all ${
                encryptionEnabled 
                  ? 'bg-green-600 border-green-400' 
                  : 'bg-gray-700 border-gray-500'
              }`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                encryptionEnabled ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Network Information */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Network Status</h3>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Protocol:</span>
                <span className="text-white">ORAD Mesh v1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Frequency:</span>
                <span className="text-white">2.4 GHz ISM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Range:</span>
                <span className="text-white">~5km line-of-sight</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button className="w-full p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
              Network Diagnostics
            </button>
            <button className="w-full p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">
              Factory Reset
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
