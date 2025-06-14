
import React, { useState, useRef, useEffect } from 'react';
import { 
  Power, 
  Volume2, 
  VolumeX, 
  Settings, 
  Antenna,
  Battery,
  Signal,
  WifiOff,
  Wifi
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RadioControls } from './radio/RadioControls';
import { ChannelSelector } from './radio/ChannelSelector';
import { StatusDisplay } from './radio/StatusDisplay';
import { PTTButton } from './radio/PTTButton';
import { SettingsPanel } from './radio/SettingsPanel';
import { useRadioMesh } from '../hooks/useRadioMesh';

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
  const [batteryLevel, setBatteryLevel] = useState(85);
  
  const { 
    isConnected, 
    peerCount, 
    isTransmitting, 
    messages,
    sendMessage,
    startTransmission,
    stopTransmission 
  } = useRadioMesh(isPoweredOn, channel);

  // Battery simulation
  useEffect(() => {
    if (!isPoweredOn) return;
    
    const interval = setInterval(() => {
      setBatteryLevel(prev => Math.max(0, prev - 0.1));
    }, 30000); // Drain battery slowly
    
    return () => clearInterval(interval);
  }, [isPoweredOn]);

  const handlePowerToggle = () => {
    setIsPoweredOn(!isPoweredOn);
    if (isPoweredOn) {
      setIsSettingsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background overlay with rugged terrain */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('https://images.unsplash.com/photo-1482881497185-d4a9ddbe4151?auto=format&fit=crop&w=2000&q=80')`
        }}
      />
      
      {/* Walkie-Talkie Device */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, rotateY: -20 }}
        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
        exit={{ scale: 0.8, opacity: 0, rotateY: 20 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="relative w-full max-w-sm mx-auto"
      >
        {/* Main Radio Body */}
        <div className="bg-gradient-to-b from-gray-800 to-black rounded-t-3xl rounded-b-xl shadow-2xl border-4 border-gray-700 overflow-hidden">
          {/* Top Section - Antenna and Status */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 border-b-2 border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Antenna className={`w-4 h-4 ${isPoweredOn ? 'text-green-400' : 'text-gray-500'}`} />
                <div className={`text-xs font-mono ${isPoweredOn ? 'text-green-400' : 'text-gray-500'}`}>
                  CH {channel.toString().padStart(2, '0')}
                </div>
              </div>
              <StatusDisplay 
                isPoweredOn={isPoweredOn}
                isConnected={isConnected}
                peerCount={peerCount}
                batteryLevel={batteryLevel}
              />
            </div>
          </div>

          {/* Display Screen */}
          <div className="bg-black p-4">
            <div className={`rounded-lg p-4 transition-all duration-300 ${
              isPoweredOn 
                ? 'bg-gradient-to-b from-green-900 to-green-950 border border-green-700' 
                : 'bg-gray-900 border border-gray-700'
            }`}>
              {isPoweredOn ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-green-400 text-sm font-mono">
                    <span>MESH RADIO</span>
                    <div className="flex items-center space-x-1">
                      {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      <Signal className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="text-green-300 text-xs font-mono">
                    {peerCount} PEERS CONNECTED
                  </div>
                  <div className="text-green-300 text-xs font-mono">
                    VOL: {volume} | SQL: {squelch}
                  </div>
                  {isTransmitting && (
                    <motion.div
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="text-red-400 text-xs font-mono font-bold"
                    >
                      *** TRANSMITTING ***
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="text-gray-600 text-center text-sm">
                  POWER OFF
                </div>
              )}
            </div>
          </div>

          {/* Control Panel */}
          <div className="p-4 space-y-4">
            {/* Power and Settings Row */}
            <div className="flex items-center justify-between">
              <button
                onClick={handlePowerToggle}
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                  isPoweredOn 
                    ? 'bg-red-600 border-red-400 shadow-lg shadow-red-500/50' 
                    : 'bg-gray-700 border-gray-500 hover:bg-gray-600'
                }`}
              >
                <Power className="w-6 h-6 text-white" />
              </button>

              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                disabled={!isPoweredOn}
                className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all ${
                  isPoweredOn 
                    ? 'bg-gray-700 border-gray-500 hover:bg-gray-600 text-white' 
                    : 'bg-gray-800 border-gray-700 text-gray-500'
                }`}
              >
                <Settings className="w-5 h-5" />
              </button>
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

          {/* PTT Button */}
          <div className="p-4 pt-0">
            <PTTButton
              isTransmitting={isTransmitting}
              onStartTransmission={startTransmission}
              onStopTransmission={stopTransmission}
              isPoweredOn={isPoweredOn}
            />
          </div>

          {/* Close Button */}
          <div className="absolute top-2 right-2">
            <button
              onClick={onClose}
              className="w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
            >
              <span className="text-white text-lg">×</span>
            </button>
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
      </motion.div>
    </div>
  );
};
