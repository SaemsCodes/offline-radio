
import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface PowerSectionProps {
  isPoweredOn: boolean;
  emergencyMode: boolean;
  onPowerToggle: () => void;
  onToggleEmergency: () => void;
}

export const PowerSection: React.FC<PowerSectionProps> = ({
  isPoweredOn,
  emergencyMode,
  onPowerToggle,
  onToggleEmergency
}) => {
  return (
    <div className="space-y-4">
      {/* Power Button */}
      <div className="flex justify-center">
        <motion.button
          onClick={onPowerToggle}
          className={`w-16 h-16 rounded-full font-bold text-base transition-all duration-300 shadow-lg border-2 ${
            isPoweredOn
              ? 'bg-green-700 hover:bg-green-600 text-white border-green-500 shadow-green-600/50 ring-2 ring-green-400/30'
              : 'bg-red-700 hover:bg-red-600 text-white border-red-500 shadow-red-600/50'
          }`}
          whileTap={{ scale: 0.95 }}
        >
          <div className="font-mono font-bold text-sm">PWR</div>
          <div className="text-xs font-mono">
            {isPoweredOn ? 'ON' : 'OFF'}
          </div>
        </motion.button>
      </div>

      {/* Emergency Button */}
      <div className="flex justify-center">
        <motion.button
          onClick={onToggleEmergency}
          disabled={!isPoweredOn}
          className={`px-6 py-2 rounded-lg font-bold text-xs transition-all border font-mono ${
            emergencyMode
              ? 'bg-red-700 text-white animate-pulse border-red-500'
              : isPoweredOn
              ? 'bg-orange-700 hover:bg-orange-600 text-white border-orange-500'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed border-gray-600'
          }`}
          whileTap={isPoweredOn ? { scale: 0.95 } : {}}
        >
          <Zap className="w-3 h-3 inline mr-1" />
          {emergencyMode ? 'EMERGENCY ACTIVE' : 'EMERGENCY'}
        </motion.button>
      </div>
    </div>
  );
};
