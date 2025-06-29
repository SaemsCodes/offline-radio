
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Volume2, Shield, Activity, RotateCcw, AlertTriangle, Zap } from 'lucide-react';
import { networkAnalyticsService } from '../../services/NetworkAnalyticsService';
import type { NetworkAnalytics } from '../../services/NetworkAnalyticsService';

interface EnhancedSettingsPanelProps {
  isVisible: boolean;
  onClose: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  encryptionEnabled: boolean;
  onEncryptionToggle: (enabled: boolean) => void;
  onFactoryReset: () => void;
}

export const EnhancedSettingsPanel: React.FC<EnhancedSettingsPanelProps> = ({
  isVisible,
  onClose,
  volume,
  onVolumeChange,
  encryptionEnabled,
  onEncryptionToggle,
  onFactoryReset
}) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [networkStats, setNetworkStats] = useState<NetworkAnalytics | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  useEffect(() => {
    if (showDiagnostics) {
      const unsubscribe = networkAnalyticsService.subscribeToRealTimeAnalytics((analytics) => {
        setNetworkStats(analytics);
      });
      return unsubscribe;
    }
  }, [showDiagnostics]);

  const runNetworkDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    setShowDiagnostics(true);
    
    // Simulate running diagnostics
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsRunningDiagnostics(false);
  };

  const handleFactoryReset = () => {
    if (showResetConfirm) {
      onFactoryReset();
      setShowResetConfirm(false);
      onClose();
    } else {
      setShowResetConfirm(true);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 rounded-xl border-4 border-gray-700 p-6 w-full max-w-md shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-orange-400 font-mono">RADIO CONFIG</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-red-700 hover:bg-red-600 rounded border-2 border-red-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Volume Control */}
          <div className="space-y-3 bg-gray-800 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-300 font-mono">VOLUME</span>
              </div>
              <span className="text-sm text-green-400 font-mono font-bold">{volume}/10</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={volume}
              onChange={(e) => onVolumeChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
            />
          </div>

          {/* Encryption Toggle */}
          <div className="flex items-center justify-between bg-gray-800 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2">
              <Shield className={`w-4 h-4 ${encryptionEnabled ? 'text-green-400' : 'text-gray-400'}`} />
              <div>
                <span className="text-sm text-gray-300 font-mono">ENCRYPTION</span>
                <p className="text-xs text-gray-500">AES-256 E2E</p>
              </div>
            </div>
            <button
              onClick={() => onEncryptionToggle(!encryptionEnabled)}
              className={`w-16 h-8 rounded-full border-2 transition-all relative ${
                encryptionEnabled 
                  ? 'bg-green-700 border-green-500' 
                  : 'bg-gray-700 border-gray-500'
              }`}
            >
              <div className={`w-6 h-6 bg-white rounded-full absolute top-0.5 transition-transform ${
                encryptionEnabled ? 'translate-x-8' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <motion.button 
              onClick={runNetworkDiagnostics}
              disabled={isRunningDiagnostics}
              className="w-full p-3 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white rounded-lg font-mono font-bold transition-colors border-2 border-blue-500 disabled:border-gray-500 flex items-center justify-center gap-2"
              whileTap={{ scale: 0.98 }}
            >
              <Activity className={`w-4 h-4 ${isRunningDiagnostics ? 'animate-pulse' : ''}`} />
              {isRunningDiagnostics ? 'SCANNING...' : 'NETWORK DIAG'}
            </motion.button>
            
            <motion.button 
              onClick={handleFactoryReset}
              className={`w-full p-3 rounded-lg font-mono font-bold transition-colors border-2 flex items-center justify-center gap-2 ${
                showResetConfirm 
                  ? 'bg-red-700 hover:bg-red-600 text-white border-red-500 animate-pulse'
                  : 'bg-orange-700 hover:bg-orange-600 text-white border-orange-500'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              {showResetConfirm ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  CONFIRM RESET
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  FACTORY RESET
                </>
              )}
            </motion.button>
          </div>

          {/* Network Diagnostics Display */}
          {showDiagnostics && networkStats && (
            <div className="bg-black rounded-lg p-4 border-2 border-green-500 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-green-400" />
                <span className="text-sm font-mono text-green-400 font-bold">NETWORK STATUS</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">SUCCESS:</span>
                  <span className={`${networkStats.successRate >= 90 ? 'text-green-400' : networkStats.successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {networkStats.successRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">LATENCY:</span>
                  <span className="text-green-400">{networkStats.averageLatency.toFixed(0)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">PEERS:</span>
                  <span className="text-green-400">{networkStats.activeConnections}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">HEALTH:</span>
                  <span className={`${
                    networkStats.networkHealth === 'excellent' ? 'text-green-400' :
                    networkStats.networkHealth === 'good' ? 'text-yellow-400' :
                    networkStats.networkHealth === 'fair' ? 'text-orange-400' : 'text-red-400'
                  }`}>
                    {networkStats.networkHealth.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => setShowDiagnostics(false)}
                className="w-full mt-3 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-mono text-xs transition-colors"
              >
                CLOSE DIAG
              </button>
            </div>
          )}

          {/* System Info */}
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-600">
            <h3 className="text-xs font-mono font-bold text-gray-400 mb-2">SYSTEM INFO</h3>
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">MODEL:</span>
                <span className="text-white">ORAD-MK1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">FREQ:</span>
                <span className="text-white">2.4GHz ISM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">RANGE:</span>
                <span className="text-white">5KM LOS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">PROTO:</span>
                <span className="text-white">MESH v1.2</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
