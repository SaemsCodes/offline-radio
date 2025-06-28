
import React from 'react';

interface BatteryIndicatorProps {
  level: number;
  isPoweredOn: boolean;
}

export const BatteryIndicator: React.FC<BatteryIndicatorProps> = ({ level, isPoweredOn }) => {
  const getColor = () => {
    if (!isPoweredOn) return 'text-gray-500';
    if (level > 50) return 'text-green-400';
    if (level > 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBatteryFill = () => {
    return Math.max(0, Math.min(100, level));
  };

  return (
    <div className="flex flex-col items-center">
      <div className={`relative w-6 h-3 border border-current rounded-sm ${getColor()}`}>
        {/* Battery tip */}
        <div className={`absolute -right-1 top-1/2 transform -translate-y-1/2 w-1 h-1 bg-current rounded-r-sm`} />
        
        {/* Battery fill */}
        <div
          className={`absolute inset-0.5 bg-current rounded-sm origin-left transition-all duration-1000`}
          style={{
            transform: `scaleX(${getBatteryFill() / 100})`,
            opacity: isPoweredOn ? 1 : 0.3
          }}
        />
      </div>
      <div className={`text-xs mt-1 ${getColor()}`}>
        {isPoweredOn ? `${Math.round(level)}%` : '--'}
      </div>
    </div>
  );
};
