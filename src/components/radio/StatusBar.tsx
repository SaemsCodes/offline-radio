
import React from 'react';
import { X, Radio as RadioIcon, Wifi, WifiOff, Settings, Shield } from 'lucide-react';

interface StatusBarProps {
  isPoweredOn: boolean;
  isConnected: boolean;
  onClose: () => void;
  onShowTopology: () => void;
  onShowPairing: () => void;
  onShowSettings: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isPoweredOn,
  isConnected,
  onClose,
  onShowTopology,
  onShowPairing,
  onShowSettings
}) => {
  return (
    <div className="flex items-center justify-between mb-3 bg-black/50 rounded-lg p-2 border border-gray-700">
      <div className="flex items-center gap-2">
        <RadioIcon className={`w-4 h-4 ${isPoweredOn ? 'text-green-400' : 'text-gray-500'}`} />
        <span className="text-orange-400 font-mono text-xs font-bold tracking-wider">ORAD-MK1</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onShowTopology}
          className="w-6 h-6 bg-gray-800 hover:bg-gray-700 rounded border border-gray-600 flex items-center justify-center transition-colors"
          disabled={!isPoweredOn}
        >
          {isConnected ? (
            <Wifi className="w-3 h-3 text-green-400" />
          ) : (
            <WifiOff className="w-3 h-3 text-gray-500" />
          )}
        </button>
        <button
          onClick={onShowPairing}
          className="w-6 h-6 bg-gray-800 hover:bg-gray-700 rounded border border-gray-600 flex items-center justify-center transition-colors"
          disabled={!isPoweredOn}
        >
          <Shield className="w-3 h-3 text-blue-400" />
        </button>
        <button
          onClick={onShowSettings}
          className="w-6 h-6 bg-gray-800 hover:bg-gray-700 rounded border border-gray-600 flex items-center justify-center transition-colors"
        >
          <Settings className="w-3 h-3 text-white" />
        </button>
        <button
          onClick={onClose}
          className="w-6 h-6 bg-red-700 hover:bg-red-600 rounded border border-red-500 flex items-center justify-center transition-colors"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      </div>
    </div>
  );
};
