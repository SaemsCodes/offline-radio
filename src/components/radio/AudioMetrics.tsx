
import React from 'react';
import { motion } from 'framer-motion';
import { Signal, Volume2, Mic } from 'lucide-react';
import { AudioMetrics as AudioMetricsType } from '../../services/AudioManager';

interface AudioMetricsProps {
  metrics: AudioMetricsType;
  isRecording: boolean;
  isPoweredOn: boolean;
}

export const AudioMetrics: React.FC<AudioMetricsProps> = ({ 
  metrics, 
  isRecording, 
  isPoweredOn 
}) => {
  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'fair': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (!isPoweredOn) {
    return (
      <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
        <div className="text-gray-500 text-xs font-mono text-center">
          AUDIO OFFLINE
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-gray-900 to-black rounded-lg p-3 border border-gray-700">
      <div className="grid grid-cols-2 gap-3">
        {/* Input Level */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1">
            <Mic className="w-3 h-3 text-green-400" />
            <span className="text-xs font-mono text-green-400">INPUT</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
              <motion.div
                className={`h-full ${
                  metrics.inputLevel > 80 ? 'bg-red-500' :
                  metrics.inputLevel > 60 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(metrics.inputLevel, 100)}%` }}
                animate={isRecording ? { 
                  opacity: [1, 0.7, 1] 
                } : {}}
                transition={{ 
                  repeat: isRecording ? Infinity : 0, 
                  duration: 1 
                }}
              />
            </div>
            <span className="text-xs font-mono text-gray-300 w-6">
              {metrics.inputLevel}
            </span>
          </div>
        </div>

        {/* Signal Quality */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1">
            <Signal className="w-3 h-3 text-blue-400" />
            <span className="text-xs font-mono text-blue-400">QUALITY</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${
                  metrics.quality === 'excellent' ? 'bg-green-500' :
                  metrics.quality === 'good' ? 'bg-blue-500' :
                  metrics.quality === 'fair' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ 
                  width: `${
                    metrics.quality === 'excellent' ? 100 :
                    metrics.quality === 'good' ? 75 :
                    metrics.quality === 'fair' ? 50 : 25
                  }%` 
                }}
              />
            </div>
            <span className={`text-xs font-mono ${getQualityColor(metrics.quality)} w-12`}>
              {metrics.quality.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Signal to Noise Ratio */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1">
            <Volume2 className="w-3 h-3 text-purple-400" />
            <span className="text-xs font-mono text-purple-400">S/N</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${
                  metrics.signalToNoise > 40 ? 'bg-green-500' :
                  metrics.signalToNoise > 25 ? 'bg-blue-500' :
                  metrics.signalToNoise > 15 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${Math.min(metrics.signalToNoise * 2, 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-gray-300 w-6">
              {metrics.signalToNoise}dB
            </span>
          </div>
        </div>

        {/* Latency */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-orange-400" />
            <span className="text-xs font-mono text-orange-400">LAT</span>
          </div>
          <div className="text-xs font-mono text-gray-300">
            {metrics.latency}ms
          </div>
        </div>
      </div>
    </div>
  );
};
