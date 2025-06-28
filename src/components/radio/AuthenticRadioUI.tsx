
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Zap, Radio as RadioIcon, Wifi, WifiOff } from 'lucide-react';
import { useRadioState } from '../../hooks/useRadioState';
import { RadialDial } from './RadialDial';
import { ChannelDisplay } from './ChannelDisplay';
import { PTTButton } from './PTTButton';
import { SignalMeter } from './SignalMeter';
import { BatteryIndicator } from './BatteryIndicator';
import { NetworkTopologyVisualization } from './NetworkTopologyVisualization';
import { SettingsPanel } from './SettingsPanel';

interface AuthenticRadioUIProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthenticRadioUI: React.FC<AuthenticRadioUIProps> = ({ isOpen, onClose }) => {
  const {
    radioState,
    messages,
    powerToggle,
    changeChannel,
    adjustVolume,
    adjustSquelch,
    transmitMessage,
    toggleEmergencyMode
  } = useRadioState();

  const [showTopology, setShowTopology] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const handlePTTPress = () => {
    if (!radioState.isPoweredOn) return;
    setIsTransmitting(true);
    transmitMessage('voice', 'Voice transmission');
  };

  const handlePTTRelease = () => {
    setIsTransmitting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm">
        {/* Main Radio Body */}
        <div className="bg-gradient-to-b from-gray-900 via-gray-800 to-black rounded-3xl border-4 border-gray-600 shadow-2xl p-6">
          {/* Top Control Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <RadioIcon className={`w-5 h-5 ${radioState.isPoweredOn ? 'text-green-400' : 'text-gray-500'}`} />
              <span className="text-orange-400 font-mono text-sm font-bold">ORAD MESH</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTopology(true)}
                className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
                disabled={!radioState.isPoweredOn}
              >
                {radioState.signalStrength > 0 ? (
                  <Wifi className="w-4 h-4 text-green-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-gray-500" />
                )}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white text-xs">⚙</span>
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center justify-between mb-6 bg-black/50 rounded-lg p-3">
            <BatteryIndicator level={radioState.batteryLevel} isPoweredOn={radioState.isPoweredOn} />
            <SignalMeter strength={radioState.signalStrength} isPoweredOn={radioState.isPoweredOn} />
            <div className="flex items-center gap-1">
              <span className={`text-xs ${radioState.isPoweredOn ? 'text-blue-400' : 'text-gray-500'}`}>
                NODES: {radioState.discoveredNodes.length}
              </span>
            </div>
          </div>

          {/* Channel Display */}
          <div className="mb-6">
            <ChannelDisplay 
              channel={radioState.channel}
              isPoweredOn={radioState.isPoweredOn}
              isReceiving={radioState.isReceiving}
              isTransmitting={isTransmitting}
            />
          </div>

          {/* Control Dials */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Channel Dial */}
            <div className="flex flex-col items-center">
              <RadialDial
                value={radioState.channel}
                min={1}
                max={99}
                onChange={changeChannel}
                disabled={!radioState.isPoweredOn}
                label="CH"
                color="orange"
              />
            </div>

            {/* Volume Dial */}
            <div className="flex flex-col items-center">
              <RadialDial
                value={radioState.volume}
                min={0}
                max={10}
                onChange={adjustVolume}
                disabled={!radioState.isPoweredOn}
                label="VOL"
                color="green"
              />
            </div>

            {/* Squelch Dial */}
            <div className="flex flex-col items-center">
              <RadialDial
                value={radioState.squelch}
                min={0}
                max={10}
                onChange={adjustSquelch}
                disabled={!radioState.isPoweredOn}
                label="SQL"
                color="blue"
              />
            </div>
          </div>

          {/* Power Button */}
          <div className="flex justify-center mb-6">
            <motion.button
              onClick={powerToggle}
              className={`w-16 h-16 rounded-full font-bold text-lg transition-all duration-300 shadow-lg ${
                radioState.isPoweredOn
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/50 ring-2 ring-green-400/50'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/50'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              PWR
            </motion.button>
          </div>

          {/* PTT Button */}
          <div className="mb-4">
            <PTTButton
              isTransmitting={isTransmitting}
              onStartTransmission={handlePTTPress}
              onStopTransmission={handlePTTRelease}
              isPoweredOn={radioState.isPoweredOn}
            />
          </div>

          {/* Emergency Button */}
          <div className="flex justify-center">
            <motion.button
              onClick={toggleEmergencyMode}
              disabled={!radioState.isPoweredOn}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                radioState.emergencyMode
                  ? 'bg-red-600 text-white animate-pulse'
                  : radioState.isPoweredOn
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
              whileTap={radioState.isPoweredOn ? { scale: 0.95 } : {}}
            >
              <Zap className="w-4 h-4 inline mr-1" />
              {radioState.emergencyMode ? 'EMERGENCY ACTIVE' : 'EMERGENCY'}
            </motion.button>
          </div>

          {/* Message Activity */}
          {radioState.isPoweredOn && messages.length > 0 && (
            <div className="mt-4 bg-black/30 rounded-lg p-2">
              <div className="text-xs text-green-400 font-mono">
                LAST: {messages[messages.length - 1]?.payload?.content || 'Signal received'}
              </div>
            </div>
          )}
        </div>

        {/* Modal Overlays */}
        {showTopology && (
          <NetworkTopologyVisualization
            isVisible={showTopology}
            onClose={() => setShowTopology(false)}
          />
        )}

        {showSettings && (
          <SettingsPanel
            isVisible={showSettings}
            onClose={() => setShowSettings(false)}
            volume={radioState.volume}
            onVolumeChange={adjustVolume}
            encryptionEnabled={false}
            onEncryptionToggle={() => {}}
          />
        )}
      </div>
    </div>
  );
};
