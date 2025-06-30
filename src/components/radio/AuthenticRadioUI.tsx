
import React, { useState, useEffect } from 'react';
import { useRadioState } from '../../hooks/useRadioState';
import { enhancedUnifiedMeshService, type EnhancedDeviceStatus, type EnhancedTransmission } from '../../services/EnhancedUnifiedMeshService';
import { useAudioManager } from '../../hooks/useAudioManager';
import { StatusBar } from './StatusBar';
import { StatusIndicators } from './StatusIndicators';
import { ControlPanel } from './ControlPanel';
import { PowerSection } from './PowerSection';
import { TransmissionSection } from './TransmissionSection';
import { StatusDisplay } from './StatusDisplay';
import { NetworkTopologyVisualization } from './NetworkTopologyVisualization';
import { EnhancedSettingsPanel } from './EnhancedSettingsPanel';
import { SecurePairing } from './SecurePairing';
import { ErrorBoundary } from '../ErrorBoundary';

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
    isInitialized,
    isRecording,
    error: audioError,
    audioMetrics,
    initialize,
    startRecording,
    stopRecording,
    playAudio,
    setAudioChunkHandler,
    clearError
  } = useAudioManager();

  const [deviceStatus, setDeviceStatus] = useState<EnhancedDeviceStatus>({
    batteryLevel: 100,
    isOnline: false,
    isWifiConnected: false,
    isBluetoothEnabled: false,
    volume: 7,
    signalQuality: 'none',
    networkMetrics: {
      totalPeers: 0,
      activePeers: 0,
      averageLatency: 0,
      networkReliability: 0,
      availableTransports: []
    }
  });

  const [transmissions, setTransmissions] = useState<EnhancedTransmission[]>([]);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [showTopology, setShowTopology] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPairing, setShowPairing] = useState(false);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);

  // Initialize audio when powered on
  useEffect(() => {
    if (radioState.isPoweredOn && !isInitialized) {
      initialize();
    }
  }, [radioState.isPoweredOn, isInitialized, initialize]);

  // Subscribe to enhanced device status
  useEffect(() => {
    const unsubscribe = enhancedUnifiedMeshService.onStatusChange(setDeviceStatus);
    return () => {
      unsubscribe();
    };
  }, []);

  // Subscribe to transmissions
  useEffect(() => {
    const unsubscribe = enhancedUnifiedMeshService.onTransmission((transmission) => {
      setTransmissions(prev => [...prev, transmission].slice(-50));
      setIsReceiving(true);
      
      // Play received voice messages
      if (transmission.type === 'voice' && transmission.content instanceof ArrayBuffer) {
        playAudio(transmission.content);
      }
      
      setTimeout(() => setIsReceiving(false), 1000);
    });
    return () => {
      unsubscribe();
    };
  }, [playAudio]);

  // Update channel in enhanced service
  useEffect(() => {
    if (radioState.isPoweredOn) {
      enhancedUnifiedMeshService.setChannel(radioState.channel);
    }
  }, [radioState.isPoweredOn, radioState.channel]);

  // Set up real-time audio streaming
  useEffect(() => {
    setAudioChunkHandler(async (chunk: Blob) => {
      if (isTransmitting && radioState.isPoweredOn) {
        const arrayBuffer = await chunk.arrayBuffer();
        await enhancedUnifiedMeshService.transmitVoice(arrayBuffer);
      }
    });
  }, [isTransmitting, radioState.isPoweredOn, setAudioChunkHandler]);

  const handleAudioData = async (audioData: Blob) => {
    if (!radioState.isPoweredOn) return;
    
    try {
      const arrayBuffer = await audioData.arrayBuffer();
      await enhancedUnifiedMeshService.transmitVoice(arrayBuffer);
      transmitMessage('voice', arrayBuffer);
    } catch (error) {
      console.error('Error processing audio data:', error);
    }
  };

  const handlePTTPress = async () => {
    if (!radioState.isPoweredOn || !isInitialized) return;
    
    setIsTransmitting(true);
    const success = await startRecording();
    if (!success) {
      setIsTransmitting(false);
    }
  };

  const handlePTTRelease = async () => {
    if (!isTransmitting) return;
    
    setIsTransmitting(false);
    const audioBlob = await stopRecording();
    
    if (audioBlob && radioState.isPoweredOn) {
      await handleAudioData(audioBlob);
    }
  };

  const handleFactoryReset = async () => {
    await enhancedUnifiedMeshService.factoryReset();
    changeChannel(1);
    adjustVolume(5);
    adjustSquelch(3);
    setEncryptionEnabled(false);
    setTransmissions([]);
    console.log('Enhanced factory reset completed');
  };

  const handleEmergencyToggle = async () => {
    const wasEmergency = enhancedUnifiedMeshService.getEmergencyMode();
    const isNowEmergency = enhancedUnifiedMeshService.toggleEmergencyMode();
    
    if (isNowEmergency && !wasEmergency) {
      // Send emergency beacon
      await enhancedUnifiedMeshService.sendEmergencyBeacon(
        'Emergency mode activated - immediate assistance required'
      );
    }
    
    toggleEmergencyMode();
  };

  if (!isOpen) return null;

  return (
    <ErrorBoundary>
      <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-2">
        <div className="relative w-full max-w-sm h-[75vh] overflow-y-auto">
          {/* Main Radio Body */}
          <div className="bg-gradient-to-b from-gray-900 via-gray-800 to-black rounded-xl border-2 border-gray-600 shadow-2xl p-4 relative">
            {/* Tactical Corner Details */}
            <div className="absolute top-1 left-1 w-2 h-2 border-l border-t border-orange-500"></div>
            <div className="absolute top-1 right-1 w-2 h-2 border-r border-t border-orange-500"></div>
            <div className="absolute bottom-1 left-1 w-2 h-2 border-l border-b border-orange-500"></div>
            <div className="absolute bottom-1 right-1 w-2 h-2 border-r border-b border-orange-500"></div>

            {/* Status Bar */}
            <StatusBar
              isPoweredOn={radioState.isPoweredOn}
              isConnected={deviceStatus.signalQuality !== 'none'}
              onClose={onClose}
              onShowTopology={() => setShowTopology(true)}
              onShowPairing={() => setShowPairing(true)}
              onShowSettings={() => setShowSettings(true)}
            />

            {/* Status Indicators */}
            <StatusIndicators
              batteryLevel={deviceStatus.batteryLevel}
              signalStrength={radioState.signalStrength}
              isPoweredOn={radioState.isPoweredOn}
              peerCount={deviceStatus.networkMetrics.activePeers}
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
                emergencyMode={enhancedUnifiedMeshService.getEmergencyMode()}
                onPowerToggle={powerToggle}
                onToggleEmergency={handleEmergencyToggle}
              />
            </div>

            {/* Transmission Section */}
            <TransmissionSection
              onAudioData={handleAudioData}
              isEnabled={radioState.isPoweredOn && deviceStatus.signalQuality !== 'none'}
              isTransmitting={isTransmitting}
              volume={radioState.volume}
              encryptionEnabled={encryptionEnabled}
            />

            {/* Status Display */}
            <StatusDisplay
              isPoweredOn={radioState.isPoweredOn}
              audioMetrics={audioMetrics}
              messages={[...messages, ...transmissions]}
              audioError={audioError}
              onClearAudioError={clearError}
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
    </ErrorBoundary>
  );
};
