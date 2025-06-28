
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
  Signal
} from 'lucide-react';
import { ChannelSelector } from './radio/ChannelSelector';
import { EnhancedPTTButton } from './radio/EnhancedPTTButton';
import { StatusDisplay } from './radio/StatusDisplay';
import { AudioMetrics } from './radio/AudioMetrics';
import { SecurePairing } from './radio/SecurePairing';
import { SettingsPanel } from './radio/SettingsPanel';
import { ProductionDashboard } from './radio/ProductionDashboard';
import { useUnifiedRadioMesh } from '../hooks/useUnifiedRadioMesh';
import { useToast } from './ui/use-toast';

export const WalkieTalkieRadio: React.FC = () => {
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  const [channel, setChannel] = useState(1);
  const [volume, setVolume] = useState(7);
  const [showSettings, setShowSettings] = useState(false);
  const [showPairing, setShowPairing] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);

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

  const handleEmergencyTransmission = (audioData: Blob, isEmergency: boolean = false) => {
    if (isEmergency) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 p-4">
      <div className="max-w-md mx-auto">
        <Card className="bg-black border-2 border-yellow-400 shadow-2xl shadow-yellow-400/20">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-yellow-400 font-mono">
                MESH RADIO
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDashboard(true)}
                  className="text-blue-400 hover:bg-blue-400/10"
                >
                  <BarChart3 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPairing(true)}
                  className="text-green-400 hover:bg-green-400/10"
                >
                  <Shield className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  className="text-gray-400 hover:bg-gray-400/10"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <StatusDisplay
                isPoweredOn={isPoweredOn}
                isConnected={isConnected}
                peerCount={peerCount}
                batteryLevel={batteryLevel}
              />
              <div className="flex items-center gap-2">
                {getSignalQualityIcon()}
                {encryptionEnabled && (
                  <Shield className="w-4 h-4 text-green-400" />
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Power Button */}
            <div className="flex justify-center">
              <Button
                onClick={handlePowerToggle}
                className={`w-16 h-16 rounded-full text-2xl font-bold transition-all duration-300 ${
                  isPoweredOn
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/50'
                    : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/50'
                }`}
              >
                <Power className="w-8 h-8" />
              </Button>
            </div>

            {/* Status Indicators */}
            {isPoweredOn && (
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <div className={`text-sm font-mono ${getSignalQualityColor()}`}>
                    {connectionQuality.toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-400">SIGNAL</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-mono text-blue-400">
                    {peerCount}
                  </div>
                  <div className="text-xs text-gray-400">PEERS</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-mono text-yellow-400">
                    CH {channel}
                  </div>
                  <div className="text-xs text-gray-400">CHANNEL</div>
                </div>
              </div>
            )}

            <Separator className="bg-gray-700" />

            {/* Channel Selector */}
            <ChannelSelector
              currentChannel={channel}
              onChannelChange={handleChannelChange}
              disabled={!isPoweredOn}
            />

            <Separator className="bg-gray-700" />

            {/* Enhanced PTT Button */}
            <EnhancedPTTButton
              isEnabled={isPoweredOn && isConnected}
              isTransmitting={isTransmitting}
              onAudioData={handleEmergencyTransmission}
              volume={volume}
              encryptionEnabled={encryptionEnabled}
            />

            {/* Audio Metrics */}
            {isPoweredOn && (
              <AudioMetrics
                metrics={audioMetrics}
                isTransmitting={isTransmitting}
                isReceiving={isReceiving}
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
                <div className="space-y-1 max-h-32 overflow-y-auto">
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
                    className={`w-1 h-3 ${
                      i < volume ? 'bg-green-400' : 'bg-gray-600'
                    } ${i >= 7 ? 'bg-red-400' : ''}`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
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
    </div>
  );
};
