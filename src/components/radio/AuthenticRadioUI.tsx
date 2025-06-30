
import React, { useState } from 'react';
import { useRadioState } from '../../hooks/useRadioState';
import { useUnifiedRadioMesh } from '../../hooks/useUnifiedRadioMesh';
import { StatusBar } from './StatusBar';
import { StatusIndicators } from './StatusIndicators';
import { ControlPanel } from './ControlPanel';
import { PowerSection } from './PowerSection';
import { TransmissionSection } from './TransmissionSection';
import { StatusDisplay } from './StatusDisplay';
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

          {/* Status Bar */}
          <StatusBar
            isPoweredOn={radioState.isPoweredOn}
            isConnected={isConnected}
            onClose={onClose}
            onShowTopology={() => setShowTopology(true)}
            onShowPairing={() => setShowPairing(true)}
            onShowSettings={() => setShowSettings(true)}
          />

          {/* Status Indicators */}
          <StatusIndicators
            batteryLevel={radioState.batteryLevel}
            signalStrength={radioState.signalStrength}
            isPoweredOn={radioState.isPoweredOn}
            peerCount={peerCount}
          />

          {/* Control Panel */}
          <div className="mb-4">
            <ControlPanel
              channel={radioState.channel}
              volume={radioState.volume}
              squelch={radioState.squelch}
              isPoweredOn={radioState.isPoweredOn}
              isReceiving={isReceiving}
              isTransmitting={isTransmitting}
              encryptionEnabled={encryptionEnabled}
              onChannelChange={changeChannel}
              onVolumeChange={adjustVolume}
              onSquelchChange={adjustSquelch}
            />
          </div>

          {/* Power Section */}
          <div className="mb-4">
            <PowerSection
              isPoweredOn={radioState.isPoweredOn}
              emergencyMode={radioState.emergencyMode}
              onPowerToggle={powerToggle}
              onToggleEmergency={toggleEmergencyMode}
            />
          </div>

          {/* Transmission Section */}
          <TransmissionSection
            onAudioData={handleAudioData}
            isEnabled={radioState.isPoweredOn && isConnected}
            isTransmitting={isTransmitting}
            volume={radioState.volume}
            encryptionEnabled={encryptionEnabled}
          />

          {/* Status Display */}
          <StatusDisplay
            isPoweredOn={radioState.isPoweredOn}
            audioMetrics={audioMetrics}
            messages={messages}
            audioError={audioError}
            onClearAudioError={clearAudioError}
          />
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
