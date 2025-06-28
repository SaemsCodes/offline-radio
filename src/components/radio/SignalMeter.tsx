
import React from 'react';

interface SignalMeterProps {
  strength: number;
  isPoweredOn: boolean;
}

export const SignalMeter: React.FC<SignalMeterProps> = ({ strength, isPoweredOn }) => {
  const bars = Array.from({ length: 5 }, (_, i) => {
    const threshold = (i + 1) * 20;
    const isActive = strength >= threshold;
    
    return (
      <div
        key={i}
        className={`w-1 rounded-full transition-all duration-300 ${
          isPoweredOn && isActive
            ? strength >= 80
              ? 'bg-green-400 h-4'
              : strength >= 60
              ? 'bg-yellow-400 h-3'
              : 'bg-red-400 h-2'
            : 'bg-gray-600 h-1'
        }`}
      />
    );
  });

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-end gap-1 h-5">
        {bars}
      </div>
      <div className={`text-xs mt-1 ${isPoweredOn ? 'text-gray-300' : 'text-gray-500'}`}>
        SIG
      </div>
    </div>
  );
};
