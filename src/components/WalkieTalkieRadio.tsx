
import React, { useState, useRef, useEffect } from 'react';
import { 
  Power, 
  Volume2, 
  Settings, 
  Antenna,
  Battery,
  Signal,
  WifiOff,
  Wifi,
  Bluetooth,
  BluetoothOff,
  Radio as RadioIcon,
  Speaker
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RadioControls } from './radio/RadioControls';
import { ChannelSelector } from './radio/ChannelSelector';
import { StatusDisplay } from './radio/StatusDisplay';
import { PTTButton } from './radio/PTTButton';
import { SettingsPanel } from './radio/SettingsPanel';
import { Settings as AdvancedSettings } from '../pages/Settings';
import { useRealRadioMesh } from '../hooks/useRealRadioMesh';
import { deviceStatusManager } from '../services/DeviceStatusManager';

interface WalkieTalkieRadioProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalkieTalkieRadio: React.FC<WalkieTalkieRadioProps> = ({ isOpen, onClose }) => {
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  const [volume, setVolume] = useState(7);
  const [channel, setChannel] = useState(1);
  const [squelch, setSquelch] = useState(3);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  const { 
    isConnected, 
    peerCount, 
    isTransmitting,
    isReceiving,
    batteryLevel,
    isCharging,
    connectionQuality,
    isOnline,
    isWifiConnected,
    isBluetoothEnabled,
    networkType,
    signalStrength,
    deviceModel,
    hasPermissions,
    messages,
    sendMessage,
    startTransmission,
    stopTransmission,
    testRadioSounds 
  } = useRealRadioMesh(isPoweredOn, channel);

  const handlePowerToggle = () => {
    setIsPoweredOn(!isPoweredOn);
    if (isPoweredOn) {
      setIsSettingsOpen(false);
      setShowAdvancedSettings(false);
    }
  };

  // Sync volume with device manager
  useEffect(() => {
    if (isPoweredOn) {
      deviceStatusManager.setVolume(volume);
    }
  }, [volume, isPoweredOn]);

  if (!isOpen) return null;

  return (
    
      {/* Background overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('https://images.unsplash.com/photo-1482881497185-d4a9ddbe4151?auto=format&fit=crop&w=2000&q=80')"
        }}
      />
      
      {/* Enhanced Walkie-Talkie Device */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, rotateY: -20 }}
        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
        exit={{ scale: 0.8, opacity: 0, rotateY: 20 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="relative w-full max-w-sm mx-auto"
      >
        {/* Radio Body with enhanced design */}
        <div className="bg-gradient-to-b from-gray-800 via-gray-900 to-black rounded-t-3xl rounded-b-xl shadow-2xl border-4 border-gray-700 overflow-hidden relative">
          
          {/* Antenna */}
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
            <div className={`w-2 h-12 rounded-full relative ${isPoweredOn ? 'bg-gradient-to-t from-orange-600 to-orange-400' : 'bg-gray-600'}`}>
              {isPoweredOn && (
                <motion.div
                  animate={{ 
                    boxShadow: ['0 0 5px rgba(251, 146, 60, 0.5)', '0 0 15px rgba(251, 146, 60, 0.8)', '0 0 5px rgba(251, 146, 60, 0.5)']
                  }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute top-0 w-full h-full rounded-full"
                />
              )}
              {/* Antenna segments */}
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-0.5 h-2 bg-gray-400 rounded-full" />
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-0.5 h-2 bg-gray-400 rounded-full" />
              <div className="absolute top-7 left-1/2 transform -translate-x-1/2 w-0.5 h-2 bg-gray-400 rounded-full" />
            </div>
          </div>

          {/* Speaker Grille at Top */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-700 p-4 border-b-2 border-gray-600 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Antenna className={`w-4 h-4 ${isPoweredOn ? 'text-orange-400' : 'text-gray-500'}`} />
                <div className={`text-xs font-mono ${isPoweredOn ? 'text-orange-400' : 'text-gray-500'}`}>
                  CH {channel.toString().padStart(2, '0')}
                </div>
              </div>
              <StatusDisplay 
                isPoweredOn={isPoweredOn}
                isConnected={isConnected && hasPermissions}
                peerCount={peerCount}
                batteryLevel={batteryLevel}
              />
            </div>
            
            {/* Speaker grille holes */}
            <div className="grid grid-cols-12 gap-1 opacity-60">
              {Array.from({ length: 48 }, (_, i) => (
                <div key={i} className="w-1 h-1 bg-gray-600 rounded-full" />
              ))}
            </div>
            
            {/* Audio activity indicator */}
            {(isReceiving || isTransmitting) && (
              <div className="absolute top-4 right-4">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="flex items-center space-x-1"
                >
                  <Speaker className={`w-4 h-4 ${isReceiving ? 'text-blue-400' : 'text-red-400'}`} />
                  <div className="flex space-x-0.5">
                    {Array.from({ length: 4 }, (_, i) => (
                      <motion.div
                        key={i}
                        animate={{ 
                          height: [4, 8, 4],
                          opacity: [0.3, 1, 0.3]
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 0.6,
                          delay: i * 0.1
                        }}
                        className={`w-1 bg-current ${isReceiving ? 'text-blue-400' : 'text-red-400'}`}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Enhanced Display Screen */}
          <div className="bg-black p-4 relative">
            {/* Screen bezel */}
            <div className="border-2 border-gray-600 rounded-lg p-1 bg-gradient-to-b from-gray-800 to-gray-900">
              <div className={`rounded-lg p-4 transition-all duration-300 ${isPoweredOn ? 'bg-gradient-to-b from-green-900 to-green-950 border border-green-700 shadow-inner' : 'bg-gray-900 border border-gray-700'}`}>
                {isPoweredOn ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-green-400 text-sm font-mono">
                      <span>ORAD MESH</span>
                      <div className="flex items-center space-x-1">
                        {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {isBluetoothEnabled ? <Bluetooth className="w-3 h-3" /> : <BluetoothOff className="w-3 h-3" />}
                        <Signal className="w-3 h-3" />
                      </div>
                    </div>
                    
                    <div className="text-green-300 text-xs font-mono flex justify-between">
                      <span>{peerCount} PEERS</span>
                      <span>{connectionQuality.toUpperCase()}</span>
                    </div>
                    
                    <div className="text-green-300 text-xs font-mono flex justify-between">
                      <span>VOL: {volume}</span>
                      <span>SQL: {squelch}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex space-x-1">
                        <span className={isOnline ? 'text-blue-400' : 'text-gray-400'}>
                          NET
                        </span>
                        <span className={isWifiConnected ? 'text-blue-400' : 'text-gray-400'}>
                          WIFI
                        </span>
                        <span className={isBluetoothEnabled ? 'text-blue-400' : 'text-gray-400'}>
                          BT
                        </span>
                      </div>
                      <span className="text-green-400">
                        {deviceModel}
                      </span>
                    </div>
                    
                    <div className="text-xs font-mono text-green-300 flex justify-between">
                      <span>SIG: {Math.round(signalStrength)}%</span>
                      <span>{networkType.toUpperCase()}</span>
                    </div>
                    
                    {!hasPermissions && (
                      <motion.div
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="text-yellow-400 text-xs font-mono font-bold text-center"
                      >
                        PERMISSIONS REQUIRED
                      </motion.div>
                    )}
                    
                    {isTransmitting && (
                      <motion.div
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="text-red-400 text-xs font-mono font-bold text-center"
                      >
                        *** TRANSMITTING ***
                      </motion.div>
                    )}
                    
                    {isReceiving && (
                      <motion.div
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 0.5 }}
                        className="text-blue-400 text-xs font-mono font-bold text-center"
                      >
                        *** RECEIVING ***
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-600 text-center text-sm h-24 flex items-center justify-center">
                    <div>
                      <RadioIcon className="w-8 h-8 mx-auto mb-2" />
                      <div>POWER OFF</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="p-4 space-y-4 bg-gradient-to-b from-gray-800 to-gray-900">
            {/* Power and Settings Row */}
            <div className="flex items-center justify-between">
              <motion.button
                onClick={handlePowerToggle}
                whileTap={{ scale: 0.95 }}
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                  isPoweredOn 
                    ? 'bg-gradient-to-b from-red-500 to-red-700 border-red-400 shadow-lg shadow-red-500/50' 
                    : 'bg-gradient-to-b from-gray-700 to-gray-800 border-gray-500 hover:from-gray-600 hover:to-gray-700'
                }`}
              >
                <Power className="w-6 h-6 text-white" />
              </motion.button>

              <div className="flex space-x-2">
                <motion.button
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  disabled={!isPoweredOn}
                  whileTap={{ scale: 0.95 }}
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all ${
                    isPoweredOn 
                      ? 'bg-gradient-to-b from-gray-600 to-gray-700 border-gray-500 hover:from-gray-500 hover:to-gray-600 text-white' 
                      : 'bg-gray-800 border-gray-700 text-gray-500'
                  }`}
                >
                  <Settings className="w-5 h-5" />
                </motion.button>

                <motion.button
                  onClick={testRadioSounds}
                  disabled={!isPoweredOn}
                  whileTap={{ scale: 0.95 }}
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all ${
                    isPoweredOn 
                      ? 'bg-gradient-to-b from-blue-600 to-blue-700 border-blue-500 hover:from-blue-500 hover:to-blue-600 text-white' 
                      : 'bg-gray-800 border-gray-700 text-gray-500'
                  }`}
                >
                  <Volume2 className="w-5 h-5" />
                </motion.button>
              </div>
            </div>

            {/* Channel Selector */}
            <ChannelSelector 
              channel={channel}
              onChannelChange={setChannel}
              isPoweredOn={isPoweredOn}
            />

            {/* Volume and Squelch Controls */}
            <RadioControls
              volume={volume}
              squelch={squelch}
              onVolumeChange={setVolume}
              onSquelchChange={setSquelch}
              isPoweredOn={isPoweredOn}
            />
          </div>

          {/* Enhanced PTT Button */}
          <div className="p-4 pt-0 bg-gradient-to-b from-gray-900 to-black">
            <PTTButton
              isTransmitting={isTransmitting}
              onStartTransmission={startTransmission}
              onStopTransmission={stopTransmission}
              isPoweredOn={isPoweredOn && hasPermissions}
            />
          </div>

          {/* Close Button */}
          <div className="absolute top-2 right-2">
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.95 }}
              className="w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
            >
              <span className="text-white text-lg">×</span>
            </motion.button>
          </div>

          {/* Battery Indicator */}
          <div className="absolute top-2 left-2">
            <div className="flex items-center space-x-1 bg-black/50 rounded-full px-2 py-1 backdrop-blur-sm">
              <Battery className={`w-3 h-3 ${
                isCharging ? 'text-green-400' : 
                batteryLevel > 50 ? 'text-green-400' : 
                batteryLevel > 20 ? 'text-yellow-400' : 'text-red-400'
              }`} />
              <span className="text-white text-xs font-mono">
                {Math.round(batteryLevel)}%
              </span>
              {isCharging && (
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-1 h-1 bg-green-400 rounded-full"
                />
              )}
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {isSettingsOpen && isPoweredOn && (
            <SettingsPanel 
              onClose={() => setIsSettingsOpen(false)}
              messages={messages}
              onSendMessage={sendMessage}
            />
          )}
        </AnimatePresence>

        {/* Advanced Settings Modal */}
        <AnimatePresence>
          {showAdvancedSettings && isPoweredOn && (
            <AdvancedSettings onClose={() => setShowAdvancedSettings(false)} />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
