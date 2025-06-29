
import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChannelSelectorProps {
  currentChannel: number;
  onChannelChange: (channel: number) => void;
  disabled: boolean;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  currentChannel,
  onChannelChange,
  disabled
}) => {
  const incrementChannel = () => {
    if (currentChannel < 99) {
      onChannelChange(currentChannel + 1);
    }
  };

  const decrementChannel = () => {
    if (currentChannel > 1) {
      onChannelChange(currentChannel - 1);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-2">
      <motion.button
        onClick={incrementChannel}
        disabled={disabled || currentChannel >= 99}
        className={`w-12 h-8 rounded border-2 flex items-center justify-center transition-all font-bold ${
          disabled && currentChannel < 99
            ? 'bg-gray-800 border-orange-500 hover:bg-gray-700 text-orange-400 shadow-md'
            : 'bg-gray-900 border-gray-600 text-gray-500 cursor-not-allowed'
        }`}
        whileTap={disabled && currentChannel < 99 ? { scale: 0.95 } : {}}
      >
        <ChevronUp className="w-5 h-5" />
      </motion.button>

      <div className={`flex flex-col items-center space-y-1 px-3 py-2 rounded border-2 bg-black ${
        disabled 
          ? 'border-orange-500 shadow-inner' 
          : 'border-gray-700'
      }`}>
        <span className={`text-xs font-mono font-bold ${disabled ? 'text-orange-400' : 'text-gray-500'}`}>
          CHAN
        </span>
        <span className={`text-xl font-mono font-bold leading-none ${disabled ? 'text-green-400' : 'text-gray-500'}`}>
          {currentChannel.toString().padStart(2, '0')}
        </span>
      </div>

      <motion.button
        onClick={decrementChannel}
        disabled={disabled || currentChannel <= 1}
        className={`w-12 h-8 rounded border-2 flex items-center justify-center transition-all font-bold ${
          disabled && currentChannel > 1
            ? 'bg-gray-800 border-orange-500 hover:bg-gray-700 text-orange-400 shadow-md'
            : 'bg-gray-900 border-gray-600 text-gray-500 cursor-not-allowed'
        }`}
        whileTap={disabled && currentChannel > 1 ? { scale: 0.95 } : {}}
      >
        <ChevronDown className="w-5 h-5" />
      </motion.button>
    </div>
  );
};
