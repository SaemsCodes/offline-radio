
import React from 'react';
import { BatteryIndicator } from './BatteryIndicator';
import { SignalMeter } from './SignalMeter';

interface StatusIndicatorsProps {
  batteryLevel: number;
  signalStrength: number;
  isPoweredOn: boolean;
  peerCount: number;
}

export const StatusIndicators: React.FC<StatusIndicatorsProps> = ({
  batteryLevel,
  signalStrength,
  isPoweredOn,
  peerCount
}) => {
  return (
    <div className="flex items-center justify-between mb-4 bg-black/70 rounded-lg p-2 border border-gray-700">
      <BatteryIndicator level={batteryLevel} isPoweredOn={isPoweredOn} />
      <SignalMeter strength={signalStrength} isPoweredOn={isPoweredOn} />
      <div className="flex flex-col items-center">
        <div className={`text-xs font-mono ${isPoweredOn ? 'text-blue-400' : 'text-gray-500'}`}>
          MESH
        </div>
        <div className={`text-sm font-bold font-mono ${isPoweredOn ? 'text-white' : 'text-gray-500'}`}>
          {isPoweredOn ? peerCount : '--'}
        </div>
      </div>
    </div>
  );
};
