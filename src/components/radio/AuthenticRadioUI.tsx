import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Zap, Radio as RadioIcon, Wifi, WifiOff, Settings, Shield } from 'lucide-react';
import { useRadioState } from '../../hooks/useRadioState';
import { useUnifiedRadioMesh } from '../../hooks/useUnifiedRadioMesh';
import { RadialDial } from './RadialDial';
import { ChannelDisplay } from './ChannelDisplay';
import { ChannelSelector } from './ChannelSelector';
import { EnhancedPTTButton } from './EnhancedPTTButton';
import { SignalMeter } from './SignalMeter';
import { BatteryIndicator } from './BatteryIndicator';
import { NetworkTopologyVisualization } from './NetworkTopologyVisualization';
import { EnhancedSettingsPanel } from './EnhancedSettingsPanel';
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

  const handleFactoryReset = () => {
    changeChannel(1);
    adjustVolume(5);
    adjustSquelch(3);
    setEncryptionEnabled(false);
    localStorage.removeItem('orad-radio-settings');
    console.log('Factory reset completed');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-2">
      <div className="relative w-full max-w-sm h-[75vh] overflow-y-auto">
        {/* Main Radio Body - Compact Military Grade Styling */}
        <div className="bg-gradient-to-b from-gray-900 via-gray-800 to-black rounded-xl border-2 border-gray-600 shadow-2xl p-4 relative">
          {/* Tactical Corner Details */}
          <div className="absolute top-1 left-1 w-2 h-2 border-l border-t border-orange-500"></div>
          <div className="absolute top-1 right-1 w-2 h-2 border-r border-t border-orange-500"></div>
          <div className="absolute bottom-1 left-1 w-2 h-2 border-l border-b border-orange-500"></div>
          <div className="absolute bottom-1 right-1 w-2 h-2 border-r border-b border-orange-500"></div>

          {/* Top Control Bar */}
          <div className="flex items-center justify-between mb-3 bg-black/50 rounded-lg p-2 border border-gray-700">
            <div className="flex items-center gap-2">
              <RadioIcon className={`w-4 h-4 ${radioState.isPoweredOn ? 'text-green-400' : 'text-gray-500'}`} />
              <span className="text-orange-400 font-mono text-xs font-bold tracking-wider">ORAD-MK1</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowTopology(true)}
                className="w-6 h-6 bg-gray-800 hover:bg-gray-700 rounded border border-gray-600 flex items-center justify-center transition-colors"
                disabled={!radioState.isPoweredOn}
              >
                {isConnected ? (
                  <Wifi className="w-3 h-3 text-green-400" />
                ) : (
                  <WifiOff className="w-3 h-3 text-gray-500" />
                )}
              </button>
              <button
                onClick={() => setShowPairing(true)}
                className="w-6 h-6 bg-gray-800 hover:bg-gray-700 rounded border border-gray-600 flex items-center justify-center transition-colors"
                disabled={!radioState.isPoweredOn}
              >
                <Shield className="w-3 h-3 text-blue-400" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
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

          {/* Status Indicators */}
          <div className="flex items-center justify-between mb-4 bg-black/70 rounded-lg p-2 border border-gray-700">
            <BatteryIndicator level={radioState.batteryLevel} isPoweredOn={radioState.isPoweredOn} />
            <SignalMeter strength={radioState.signalStrength} isPoweredOn={radioState.isPoweredOn} />
            <div className="flex flex-col items-center">
              <div className={`text-xs font-mono ${radioState.isPoweredOn ? 'text-blue-400' : 'text-gray-500'}`}>
                MESH
              </div>
              <div className={`text-sm font-bold font-mono ${radioState.isPoweredOn ? 'text-white' : 'text-gray-500'}`}>
                {radioState.isPoweredOn ? peerCount : '--'}
              </div>
            </div>
          </div>

          {/* Channel Display */}
          <div className="mb-4">
            <ChannelDisplay 
              channel={radioState.channel}
              isPoweredOn={radioState.isPoweredOn}
              isReceiving={isReceiving}
              isTransmitting={isTransmitting}
            />
          </div>

          {/* Channel Selector and Control Dials */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <ChannelSelector
              currentChannel={radioState.channel}
              onChannelChange={changeChannel}
              disabled={radioState.isPoweredOn}
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
            <div className="flex flex-col items-center justify-center">
              <div className={`text-xs font-mono mb-1 ${radioState.isPoweredOn ? 'text-gray-300' : 'text-gray-500'}`}>
                MODE
              </div>
              <div className={`text-xs font-mono font-bold ${
                encryptionEnabled && radioState.isPoweredOn ? 'text-green-400' : 
                radioState.isPoweredOn ? 'text-white' : 'text-gray-500'
              }`}>
                {encryptionEnabled && radioState.isPoweredOn ? 'SEC' : 'CLR'}
              </div>
            </div>
          </div>

          {/* Power Button */}
          <div className="flex justify-center mb-4">
            <motion.button
              onClick={powerToggle}
              className={`w-16 h-16 rounded-full font-bold text-base transition-all duration-300 shadow-lg border-2 ${
                radioState.isPoweredOn
                  ? 'bg-green-700 hover:bg-green-600 text-white border-green-500 shadow-green-600/50 ring-2 ring-green-400/30'
                  : 'bg-red-700 hover:bg-red-600 text-white border-red-500 shadow-red-600/50'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <div className="font-mono font-bold text-sm">PWR</div>
              <div className="text-xs font-mono">
                {radioState.isPoweredOn ? 'ON' : 'OFF'}
              </div>
            </motion.button>
          </div>

          {/* Enhanced PTT Button */}
          <div className="mb-3">
            <EnhancedPTTButton
              onAudioData={handleAudioData}
              isEnabled={radioState.isPoweredOn && isConnected}
              isTransmitting={isTransmitting}
              volume={radioState.volume}
              encryptionEnabled={encryptionEnabled}
            />
          </div>

          {/* Emergency Button */}
          <div className="flex justify-center mb-3">
            <motion.button
              onClick={toggleEmergencyMode}
              disabled={!radioState.isPoweredOn}
              className={`px-6 py-2 rounded-lg font-bold text-xs transition-all border font-mono ${
                radioState.emergencyMode
                  ? 'bg-red-700 text-white animate-pulse border-red-500'
                  : radioState.isPoweredOn
                  ? 'bg-orange-700 hover:bg-orange-600 text-white border-orange-500'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed border-gray-600'
              }`}
              whileTap={radioState.isPoweredOn ? { scale: 0.95 } : {}}
            >
              <Zap className="w-3 h-3 inline mr-1" />
              {radioState.emergencyMode ? 'EMERGENCY ACTIVE' : 'EMERGENCY'}
            </motion.button>
          </div>

          {/* Compact Status Display */}
          {radioState.isPoweredOn && (
            <div className="space-y-2">
              {audioMetrics && (
                <div className="bg-black/50 rounded-lg p-2 border border-gray-700">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-gray-400">AUDIO:</span>
                    <span className={`font-bold ${
                      audioMetrics.quality === 'excellent' ? 'text-green-400' :
                      audioMetrics.quality === 'good' ? 'text-yellow-400' :
                      audioMetrics.quality === 'fair' ? 'text-orange-400' : 'text-red-400'
                    }`}>
                      {audioMetrics.quality.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}

              {messages.length > 0 && (
                <div className="bg-black/50 rounded-lg p-2 border border-gray-700">
                  <div className="text-xs text-green-400 font-mono">
                    LAST RX: {messages[messages.length - 1]?.payload?.content || 'Signal received'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audio Error Display */}
          {audioError && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-2 mb-2">
              <div className="flex items-center justify-between">
                <span className="text-red-400 text-xs font-mono">{audioError}</span>
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
          <EnhancedSettingsPanel
            isVisible={showSettings}
            onClose={() => setShowSettings(false)}
            volume={radioState.volume}
            onVolumeChange={adjustVolume}
            encryptionEnabled={encryptionEnabled}
            onEncryptionToggle={setEncryptionEnabled}
            onFactoryReset={handleFactoryReset}
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
