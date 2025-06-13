
import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface RadioControlsProps {
  volume: number;
  squelch: number;
  onVolumeChange: (volume: number) => void;
  onSquelchChange: (squelch: number) => void;
  isPoweredOn: boolean;
}

export const RadioControls: React.FC<RadioControlsProps> = ({
  volume,
  squelch,
  onVolumeChange,
  onSquelchChange,
  isPoweredOn
}) => {
  return (
    <div className="space-y-4">
      {/* Volume Control */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 w-16">
          {volume === 0 ? (
            <VolumeX className={`w-4 h-4 ${isPoweredOn ? 'text-orange-400' : 'text-gray-500'}`} />
          ) : (
            <Volume2 className={`w-4 h-4 ${isPoweredOn ? 'text-orange-400' : 'text-gray-500'}`} />
          )}
          <span className={`text-xs font-mono ${isPoweredOn ? 'text-white' : 'text-gray-500'}`}>
            VOL
          </span>
        </div>
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max="10"
            value={volume}
            onChange={(e) => onVolumeChange(parseInt(e.target.value))}
            disabled={!isPoweredOn}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
              isPoweredOn 
                ? 'bg-gray-700' 
                : 'bg-gray-800'
            }`}
            style={{
              background: isPoweredOn 
                ? `linear-gradient(to right, #f97316 0%, #f97316 ${volume * 10}%, #374151 ${volume * 10}%, #374151 100%)`
                : '#374151'
            }}
          />
        </div>
        <span className={`text-xs font-mono w-6 ${isPoweredOn ? 'text-white' : 'text-gray-500'}`}>
          {volume}
        </span>
      </div>

      {/* Squelch Control */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 w-16">
          <div className={`w-4 h-4 rounded border ${isPoweredOn ? 'border-green-400 bg-green-400/20' : 'border-gray-500'}`} />
          <span className={`text-xs font-mono ${isPoweredOn ? 'text-white' : 'text-gray-500'}`}>
            SQL
          </span>
        </div>
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max="10"
            value={squelch}
            onChange={(e) => onSquelchChange(parseInt(e.target.value))}
            disabled={!isPoweredOn}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
              isPoweredOn 
                ? 'bg-gray-700' 
                : 'bg-gray-800'
            }`}
            style={{
              background: isPoweredOn 
                ? `linear-gradient(to right, #10b981 0%, #10b981 ${squelch * 10}%, #374151 ${squelch * 10}%, #374151 100%)`
                : '#374151'
            }}
          />
        </div>
        <span className={`text-xs font-mono w-6 ${isPoweredOn ? 'text-white' : 'text-gray-500'}`}>
          {squelch}
        </span>
      </div>
    </div>
  );
};
