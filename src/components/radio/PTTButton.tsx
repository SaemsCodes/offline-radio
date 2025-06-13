
import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';

interface PTTButtonProps {
  isTransmitting: boolean;
  onStartTransmission: () => void;
  onStopTransmission: () => void;
  isPoweredOn: boolean;
}

export const PTTButton: React.FC<PTTButtonProps> = ({
  isTransmitting,
  onStartTransmission,
  onStopTransmission,
  isPoweredOn
}) => {
  return (
    <motion.button
      onMouseDown={onStartTransmission}
      onMouseUp={onStopTransmission}
      onTouchStart={onStartTransmission}
      onTouchEnd={onStopTransmission}
      disabled={!isPoweredOn}
      className={`w-full h-20 rounded-2xl border-4 flex items-center justify-center transition-all duration-200 ${
        isPoweredOn
          ? isTransmitting
            ? 'bg-gradient-to-b from-red-500 to-red-700 border-red-400 shadow-lg shadow-red-500/50'
            : 'bg-gradient-to-b from-orange-500 to-orange-700 border-orange-400 hover:from-orange-400 hover:to-orange-600 shadow-lg'
          : 'bg-gray-800 border-gray-600 cursor-not-allowed'
      }`}
      whilePressed={{ scale: 0.95 }}
      animate={isTransmitting ? { 
        boxShadow: ['0 0 20px rgba(239, 68, 68, 0.5)', '0 0 40px rgba(239, 68, 68, 0.8)', '0 0 20px rgba(239, 68, 68, 0.5)']
      } : {}}
      transition={{ repeat: isTransmitting ? Infinity : 0, duration: 1 }}
    >
      <div className="flex flex-col items-center space-y-1">
        {isPoweredOn ? (
          isTransmitting ? (
            <Mic className="w-8 h-8 text-white" />
          ) : (
            <MicOff className="w-8 h-8 text-white" />
          )
        ) : (
          <MicOff className="w-8 h-8 text-gray-500" />
        )}
        <span className={`text-sm font-bold ${
          isPoweredOn ? 'text-white' : 'text-gray-500'
        }`}>
          {isPoweredOn ? (isTransmitting ? 'TRANSMITTING' : 'PUSH TO TALK') : 'PWR OFF'}
        </span>
      </div>
    </motion.button>
  );
};
