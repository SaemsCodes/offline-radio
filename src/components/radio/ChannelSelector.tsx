
import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface ChannelSelectorProps {
  channel: number;
  onChannelChange: (channel: number) => void;
  isPoweredOn: boolean;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  channel,
  onChannelChange,
  isPoweredOn
}) => {
  const incrementChannel = () => {
    if (channel < 99) {
      onChannelChange(channel + 1);
    }
  };

  const decrementChannel = () => {
    if (channel > 1) {
      onChannelChange(channel - 1);
    }
  };

  return (
    <div className="flex items-center justify-center space-x-4">
      <button
        onClick={decrementChannel}
        disabled={!isPoweredOn || channel <= 1}
        className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all ${
          isPoweredOn && channel > 1
            ? 'bg-gray-700 border-gray-500 hover:bg-gray-600 text-white'
            : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        <ChevronDown className="w-5 h-5" />
      </button>

      <div className={`flex flex-col items-center space-y-1 px-4 py-2 rounded-lg border ${
        isPoweredOn 
          ? 'bg-gray-700 border-gray-500' 
          : 'bg-gray-800 border-gray-700'
      }`}>
        <span className={`text-xs font-mono ${isPoweredOn ? 'text-orange-400' : 'text-gray-500'}`}>
          CHANNEL
        </span>
        <span className={`text-2xl font-mono font-bold ${isPoweredOn ? 'text-white' : 'text-gray-500'}`}>
          {channel.toString().padStart(2, '0')}
        </span>
      </div>

      <button
        onClick={incrementChannel}
        disabled={!isPoweredOn || channel >= 99}
        className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all ${
          isPoweredOn && channel < 99
            ? 'bg-gray-700 border-gray-500 hover:bg-gray-600 text-white'
            : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  );
};
