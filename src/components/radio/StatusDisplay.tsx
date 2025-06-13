
import React from 'react';
import { Battery, Wifi, WifiOff, Users } from 'lucide-react';

interface StatusDisplayProps {
  isPoweredOn: boolean;
  isConnected: boolean;
  peerCount: number;
  batteryLevel: number;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({
  isPoweredOn,
  isConnected,
  peerCount,
  batteryLevel
}) => {
  const getBatteryColor = () => {
    if (batteryLevel > 50) return 'text-green-400';
    if (batteryLevel > 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="flex items-center space-x-3">
      {/* Connection Status */}
      <div className="flex items-center space-x-1">
        {isPoweredOn && isConnected ? (
          <Wifi className="w-4 h-4 text-green-400" />
        ) : isPoweredOn ? (
          <WifiOff className="w-4 h-4 text-red-400" />
        ) : (
          <WifiOff className="w-4 h-4 text-gray-500" />
        )}
        <div className="flex items-center space-x-1">
          <Users className={`w-3 h-3 ${isPoweredOn ? 'text-blue-400' : 'text-gray-500'}`} />
          <span className={`text-xs font-mono ${isPoweredOn ? 'text-white' : 'text-gray-500'}`}>
            {peerCount}
          </span>
        </div>
      </div>

      {/* Battery Level */}
      <div className="flex items-center space-x-1">
        <Battery className={`w-4 h-4 ${isPoweredOn ? getBatteryColor() : 'text-gray-500'}`} />
        <span className={`text-xs font-mono ${isPoweredOn ? getBatteryColor() : 'text-gray-500'}`}>
          {Math.round(batteryLevel)}%
        </span>
      </div>
    </div>
  );
};
