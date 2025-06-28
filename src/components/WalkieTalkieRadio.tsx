
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Power, 
  Volume2, 
  Settings, 
  Shield, 
  Users, 
  Activity,
  BarChart3,
  AlertTriangle,
  Wifi,
  Battery,
  Signal,
  X,
  Zap,
  Map
} from 'lucide-react';
import { ChannelSelector } from './radio/ChannelSelector';
import { EnhancedPTTButton } from './radio/EnhancedPTTButton';
import { StatusDisplay } from './radio/StatusDisplay';
import { AudioMetrics } from './radio/AudioMetrics';
import { SecurePairing } from './radio/SecurePairing';
import { SettingsPanel } from './radio/SettingsPanel';
import { ProductionDashboard } from './radio/ProductionDashboard';
import { NetworkTopologyVisualization } from './radio/NetworkTopologyVisualization';
import { useUnifiedRadioMesh } from '../hooks/useUnifiedRadioMesh';
import { useToast } from './ui/use-toast';
import { emergencyBeaconService } from '../services/EmergencyBeaconService';

interface WalkieTalkieRadioProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalkieTalkieRadio: React.FC<WalkieTalkieRadioProps> = ({ isOpen, onClose }) => {
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  const [channel, setChannel] = useState(1);
  const [volume, setVolume] = useState(7);
  const [showSettings, setShowSettings] = useState(false);
  const [showPairing, setShowPairing] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showTopology, setShowTopology] = useState(false);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);

  const { toast } = useToast();

  const {
    isConnected,
    peerCount,
    isTransmitting,
    isReceiving,
    connectionQuality,
    batteryLevel,
    messages,
    audioMetrics,
    sendMessage,
    handleAudioData
  } = useUnifiedRadioMesh(isPoweredOn, channel);

  useEffect(() => {
    if (isPoweredOn && isConnected) {
      toast({
        title: "Radio Connected",
        description: `Connected to mesh network on channel ${channel}`,
      });
    }
  }, [isPoweredOn, isConnected, channel, toast]);

  const handlePowerToggle = () => {
    setIsPoweredOn(!isPoweredOn);
    if (!isPoweredOn) {
      toast({
        title: "Radio Powered On",
        description: "Connecting to mesh network...",
      });
    } else {
      toast({
        title: "Radio Powered Off",
        description: "Disconnected from mesh network",
      });
      setEmergencyMode(false);
      emergencyBeaconService.deactivateEmergencyMode();
    }
  };

  const handleChannelChange = (newChannel: number) => {
    setChannel(newChannel);
    if (isPoweredOn) {
      toast({
        title: `Channel Changed`,
        description: `Now on channel ${newChannel}`,
      });
    }
  };

  const handleEmergencyToggle = async () => {
    if (!isPoweredOn) {
      toast({
        title: "Power On Required",
        description: "Turn on the radio to activate emergency mode",
        variant: "destructive"
      });
      return;
    }

    if (!emergencyMode) {
      setEmergencyMode(true);
      await emergencyBeaconService.activateEmergencyMode();
      
      // Send emergency beacon
      await emergencyBeaconService.sendEmergencyBeacon({
        type: 'other',
        severity: 4,
        message: 'Emergency mode activated - requesting assistance',
        location: emergencyBeaconService.getCurrentLocation() || undefined
      });

      toast({
        title: "Emergency Mode Activated",
        description: "Broadcasting emergency beacon to all nearby devices",
        variant: "destructive"
      });
    } else {
      setEmergencyMode(false);
      await emergencyBeaconService.deactivateEmergencyMode();
      toast({
        title: "Emergency Mode Deactivated",
        description: "Emergency beacon stopped",
      });
    }
  };

  const handleEmergencyTransmission = (audioData: Blob, isEmergency: boolean = false) => {
    if (isEmergency || emergencyMode) {
      toast({
        title: "Emergency Transmission",
        description: "Broadcasting emergency message with high priority",
        variant: "destructive"
      });
    }
    handleAudioData(audioData);
  };

  const getSignalQualityColor = () => {
    switch (connectionQuality) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'poor': return 'text-yellow-400';
      default: return 'text-red-400';
    }
  };

  const getSignalQualityIcon = () => {
    switch (connectionQuality) {
      case 'excellent': return <Signal className="w-4 h-4 text-green-400" />;
      case 'good': return <Signal className="w-4 h-4 text-blue-400" />;
      case 'poor': return <Signal className="w-4 h-4 text-yellow-400" />;
      default: return <Signal className="w-4 h-4 text-red-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-2 md:p-4">
      <div className="relative w-full max-w-sm mx-auto">
        {/* Main Radio Body */}
        <Card className="bg-gradient-to-b from-gray-800 to-gray-900 border-4 border-gray-600 shadow-2xl shadow-black/50 rounded-3xl overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-gray-700 to-gray-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-yellow-400 font-mono tracking-wider">
                MESH RADIO
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTopology(true)}
                  className="text-blue-400 hover:bg-blue-400/10 p-1"
                >
                  <Map className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDashboard(true)}
                  className="text-blue-400 hover:bg-blue-400/10 p-1"
                >
                  <BarChart3 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPairing(true)}
                  className="text-green-400 hover:bg-green-400/10 p-1"
                >
                  <Shield className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  className="text-gray-400 hover:bg-gray-400/10 p-1"
                >
                  <Settings className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-red-400 hover:bg-red-400/10 p-1"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            {/* LED Status Indicators */}
            <div className="flex items-center justify-between bg-black/30 rounded-lg p-2">
              <StatusDisplay
                isPoweredOn={isPoweredOn}
                isConnected={isConnected}
                peerCount={peerCount}
                batteryLevel={batteryLevel}
              />
              <div className="flex items-center gap-2">
                {getSignalQualityIcon()}
                {encryptionEnabled && (
                  <Shield className="w-3 h-3 text-green-400" />
                )}
                {emergencyMode && (
                  <Zap className="w-3 h-3 text-red-400 animate-pulse" />
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-4">
            {/* Power Button */}
            <div className="flex justify-center">
              <Button
                onClick={handlePowerToggle}
                className={`w-14 h-14 rounded-full text-xl font-bold transition-all duration-300 shadow-lg ${
                  isPoweredOn
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/50 ring-2 ring-green-400/50'
                    : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/50'
                }`}
              >
                <Power className="w-6 h-6" />
              </Button>
            </div>

            {/* LCD Display */}
            {isPoweredOn && (
              <div className="bg-green-900/20 border-2 border-green-400/30 rounded-lg p-3 font-mono text-green-400">
                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                  <div>
                    <div className={`font-bold ${getSignalQualityColor()}`}>
                      {connectionQuality.toUpperCase()}
                    </div>
                    <div className="text-gray-400">SIGNAL</div>
                  </div>
                  <div>
                    <div className="font-bold text-blue-400">
                      {peerCount}
                    </div>
                    <div className="text-gray-400">PEERS</div>
                  </div>
                  <div>
                    <div className="font-bold text-yellow-400">
                      CH {channel.toString().padStart(2, '0')}
                    </div>
                    <div className="text-gray-400">CHANNEL</div>
                  </div>
                </div>
              </div>
            )}

            <Separator className="bg-gray-600" />

            {/* Channel Selector - Fixed disabled logic */}
            <ChannelSelector
              currentChannel={channel}
              onChannelChange={handleChannelChange}
              disabled={!isPoweredOn}
            />

            <Separator className="bg-gray-600" />

            {/* PTT Button */}
            <EnhancedPTTButton
              isEnabled={isPoweredOn && isConnected}
              isTransmitting={isTransmitting}
              onAudioData={handleEmergencyTransmission}
              volume={volume}
              encryptionEnabled={encryptionEnabled}
            />

            {/* Emergency Button */}
            <div className="flex justify-center">
              <Button
                onClick={handleEmergencyToggle}
                disabled={!isPoweredOn}
                className={`px-6 py-2 font-bold rounded-lg transition-all ${
                  emergencyMode
                    ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                <Zap className="w-4 h-4 mr-2" />
                {emergencyMode ? 'EMERGENCY ACTIVE' : 'EMERGENCY'}
              </Button>
            </div>

            {/* Audio Metrics */}
            {isPoweredOn && (
              <AudioMetrics
                metrics={audioMetrics}
                isRecording={isTransmitting}
                isPoweredOn={isPoweredOn}
              />
            )}

            {/* Connection Status Alert */}
            {isPoweredOn && !isConnected && (
              <Alert className="bg-red-900/20 border-red-500">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-300">
                  No mesh network connection. Check your network settings.
                </AlertDescription>
              </Alert>
            )}

            {/* Encryption Status */}
            {isPoweredOn && encryptionEnabled && (
              <Alert className="bg-green-900/20 border-green-500">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-green-300">
                  End-to-end encryption enabled. All transmissions are secure.
                </AlertDescription>
              </Alert>
            )}

            {/* Recent Messages */}
            {isPoweredOn && messages.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-300">Recent Activity</h3>
                <div className="bg-black/40 rounded-lg p-2 space-y-1 max-h-24 overflow-y-auto">
                  {messages.slice(-3).map((message) => (
                    <div key={message.id} className="text-xs text-gray-400 font-mono">
                      <span className="text-blue-400">{message.sender}:</span> {message.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Volume Control */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">Volume</span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 h-3 rounded-sm ${
                      i < volume ? 'bg-green-400' : 'bg-gray-600'
                    } ${i >= 7 ? 'bg-red-400' : ''}`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modal Overlays */}
        <SettingsPanel
          isVisible={showSettings}
          onClose={() => setShowSettings(false)}
          volume={volume}
          onVolumeChange={setVolume}
          encryptionEnabled={encryptionEnabled}
          onEncryptionToggle={setEncryptionEnabled}
        />

        <SecurePairing
          isVisible={showPairing}
          onClose={() => setShowPairing(false)}
        />

        <ProductionDashboard
          isVisible={showDashboard}
          onClose={() => setShowDashboard(false)}
        />

        <NetworkTopologyVisualization
          isVisible={showTopology}
          onClose={() => setShowTopology(false)}
        />
      </div>
    </div>
  );
};
