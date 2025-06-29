
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Zap, Radio as RadioIcon, Wifi, WifiOff, Settings, Shield } from 'lucide-react';
import { useRadioState } from '../../hooks/useRadioState';
import { useUnifiedRadioMesh } from '../../hooks/useUnifiedRadioMesh';
import { RadialDial } from './RadialDial';
import { ChannelDisplay } from './ChannelDisplay';
import { EnhancedPTTButton } from './EnhancedPTTButton';
import { SignalMeter } from './SignalMeter';
import { BatteryIndicator } from './BatteryIndicator';
import { NetworkTopologyVisualization } from './NetworkTopologyVisualization';
import { SettingsPanel } from './SettingsPanel';
import { SecurePairing } from './SecurePairing';

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

  const {
    isConnected,
    peerCount,
    isTransmitting,
    isReceiving,
    audioError,
    audioMetrics,
    connectionQuality,
    handlePTTPress,
    handlePTTRelease,
    sendMessage,
    clearAudioError
  } = useUnifiedRadioMesh(radioState.isPoweredOn, radioState.channel);

  const [showTopology, setShowTopology] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPairing, setShowPairing] = useState(false);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);

  const handleAudioData = async (audioData: Blob) => {
    if (!radioState.isPoweredOn) return;
    
    try {
      const arrayBuffer = await audioData.arrayBuffer();
      transmitMessage('voice', arrayBuffer);
    } catch (error) {
      console.error('Error processing audio data:', error);
    }
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
                {isConnected ? (
                  <Wifi className="w-4 h-4 text-green-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-gray-500" />
                )}
              </button>
              <button
                onClick={() => setShowPairing(true)}
                className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
                disabled={!radioState.isPoweredOn}
              >
                <Shield className="w-4 h-4 text-blue-400" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
              >
                <Settings className="w-4 h-4 text-white" />
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
            <div className="flex flex-col items-center">
              <div className={`text-xs ${radioState.isPoweredOn ? 'text-blue-400' : 'text-gray-500'}`}>
                PEERS
              </div>
              <div className={`text-sm font-bold ${radioState.isPoweredOn ? 'text-white' : 'text-gray-500'}`}>
                {radioState.isPoweredOn ? peerCount : '--'}
              </div>
            </div>
          </div>

          {/* Channel Display */}
          <div className="mb-6">
            <ChannelDisplay 
              channel={radioState.channel}
              isPoweredOn={radioState.isPoweredOn}
              isReceiving={isReceiving}
              isTransmitting={isTransmitting}
            />
          </div>

          {/* Control Dials */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <RadialDial
              value={radioState.channel}
              min={1}
              max={99}
              onChange={changeChannel}
              disabled={!radioState.isPoweredOn}
              label="CH"
              color="orange"
            />
            <RadialDial
              value={radioState.volume}
              min={0}
              max={10}
              onChange={adjustVolume}
              disabled={!radioState.isPoweredOn}
              label="VOL"
              color="green"
            />
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

          {/* Enhanced PTT Button */}
          <div className="mb-4">
            <EnhancedPTTButton
              onAudioData={handleAudioData}
              isEnabled={radioState.isPoweredOn && isConnected}
              isTransmitting={isTransmitting}
              volume={radioState.volume}
              encryptionEnabled={encryptionEnabled}
            />
          </div>

          {/* Emergency Button */}
          <div className="flex justify-center mb-4">
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

          {/* Audio Quality Indicator */}
          {radioState.isPoweredOn && audioMetrics && (
            <div className="bg-black/30 rounded-lg p-2 mb-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">AUDIO:</span>
                <span className={`font-semibold ${
                  audioMetrics.quality === 'excellent' ? 'text-green-400' :
                  audioMetrics.quality === 'good' ? 'text-yellow-400' :
                  audioMetrics.quality === 'fair' ? 'text-orange-400' : 'text-red-400'
                }`}>
                  {audioMetrics.quality.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">S/N:</span>
                <span className="text-gray-300">{audioMetrics.signalToNoise}dB</span>
              </div>
            </div>
          )}

          {/* Message Activity */}
          {radioState.isPoweredOn && messages.length > 0 && (
            <div className="bg-black/30 rounded-lg p-2">
              <div className="text-xs text-green-400 font-mono">
                LAST: {messages[messages.length - 1]?.payload?.content || 'Signal received'}
              </div>
            </div>
          )}

          {/* Audio Error Display */}
          {audioError && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-red-400 text-xs">{audioError}</span>
                <button
                  onClick={clearAudioError}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  ×
                </button>
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
            encryptionEnabled={encryptionEnabled}
            onEncryptionToggle={setEncryptionEnabled}
          />
        )}

        {showPairing && (
          <SecurePairing
            isVisible={showPairing}
            onClose={() => setShowPairing(false)}
          />
        )}
      </div>
    </div>
  );
};
