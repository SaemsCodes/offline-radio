
import React from 'react';
import { motion } from 'framer-motion';

interface ChannelDisplayProps {
  channel: number;
  isPoweredOn: boolean;
  isReceiving: boolean;
  isTransmitting: boolean;
}

export const ChannelDisplay: React.FC<ChannelDisplayProps> = ({
  channel,
  isPoweredOn,
  isReceiving,
  isTransmitting
}) => {
  return (
    <div className={`relative bg-black border-2 border-green-400/30 rounded-lg p-4 font-mono ${
      isPoweredOn ? '' : 'opacity-30'
    }`}>
      {/* LCD Background */}
      <div className={`absolute inset-0 rounded-lg ${
        isPoweredOn ? 'bg-green-900/20' : 'bg-gray-900/20'
      }`} />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Channel Number */}
        <div className="text-center mb-2">
          <div className={`text-3xl font-bold ${
            isPoweredOn ? 'text-green-400' : 'text-gray-600'
          }`}>
            {isPoweredOn ? channel.toString().padStart(2, '0') : '--'}
          </div>
          <div className={`text-xs ${
            isPoweredOn ? 'text-green-400/70' : 'text-gray-600'
          }`}>
            CHANNEL
          </div>
        </div>
        
        {/* Status Indicators */}
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            {/* RX Indicator */}
            <div className={`flex items-center gap-1 ${
              isReceiving ? 'text-blue-400' : isPoweredOn ? 'text-green-400/50' : 'text-gray-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isReceiving ? 'bg-blue-400 animate-pulse' : isPoweredOn ? 'bg-green-400/30' : 'bg-gray-600'
              }`} />
              RX
            </div>
            
            {/* TX Indicator */}
            <div className={`flex items-center gap-1 ${
              isTransmitting ? 'text-red-400' : isPoweredOn ? 'text-green-400/50' : 'text-gray-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isTransmitting ? 'bg-red-400 animate-pulse' : isPoweredOn ? 'bg-green-400/30' : 'bg-gray-600'
              }`} />
              TX
            </div>
          </div>
          
          {/* Frequency Display */}
          <div className={`${isPoweredOn ? 'text-green-400/70' : 'text-gray-600'}`}>
            {isPoweredOn ? `${(462.550 + (channel - 1) * 0.025).toFixed(3)}` : '----.---'}
          </div>
        </div>
        
        {/* Activity Bar */}
        <div className={`mt-2 h-1 rounded-full overflow-hidden ${
          isPoweredOn ? 'bg-green-900/50' : 'bg-gray-800'
        }`}>
          {(isReceiving || isTransmitting) && (
            <motion.div
              className={`h-full ${isTransmitting ? 'bg-red-400' : 'bg-blue-400'}`}
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 0.3 }}
            />
          )}
        </div>
      </div>
      
      {/* Scan Lines Effect */}
      {isPoweredOn && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-400/5 to-transparent animate-pulse" />
        </div>
      )}
    </div>
  );
};
