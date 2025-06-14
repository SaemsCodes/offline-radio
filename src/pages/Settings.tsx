
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowDown, 
  ArrowUp, 
  Bluetooth, 
  BluetoothConnected, 
  BluetoothOff,
  Settings as SettingsIcon,
  Volume,
  Volume1,
  Volume2,
  VolumeOff,
  Wifi,
  WifiHigh,
  WifiLow,
  WifiOff,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning
} from 'lucide-react';
import { channelMeshService, type DeviceStatus } from '../services/ChannelMeshService';
import { MeshNetworking } from '../plugins/mesh-networking-plugin';

interface SettingsProps {
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    batteryLevel: 100,
    isOnline: false,
    isWifiConnected: false,
    isBluetoothEnabled: false,
    volume: 7,
    signalQuality: 'none'
  });
  
  const [settings, setSettings] = useState({
    emergencyMode: false,
    autoConnect: true,
    transmitPower: 'high',
    audioQuality: 'standard',
    channelScan: false,
    dataSync: true
  });

  const [networkStats, setNetworkStats] = useState({
    totalPeers: 0,
    dataTransferred: 0,
    uptime: 0,
    lastSync: null as Date | null
  });

  useEffect(() => {
    // Subscribe to device status updates
    const unsubscribe = channelMeshService.onDeviceStatusChange((status) => {
      setDeviceStatus(status);
    });

    // Update network stats
    updateNetworkStats();
    const statsInterval = setInterval(updateNetworkStats, 5000);

    return () => {
      unsubscribe();
      clearInterval(statsInterval);
    };
  }, []);

  const updateNetworkStats = async () => {
    try {
      const peers = await MeshNetworking.getConnectedPeers();
      const networkStatus = await MeshNetworking.getNetworkStatus();
      
      setNetworkStats(prev => ({
        ...prev,
        totalPeers: peers.peers.length,
        dataTransferred: networkStatus.currentBandwidth || 0,
        uptime: prev.uptime + 5,
        lastSync: deviceStatus.isOnline ? new Date() : prev.lastSync
      }));
    } catch (error) {
      console.error('Failed to update network stats:', error);
    }
  };

  const handleVolumeChange = (volume: number) => {
    channelMeshService.setVolume(volume);
  };

  const handleEmergencyModeToggle = async () => {
    try {
      if (!settings.emergencyMode) {
        await MeshNetworking.enableEmergencyMode();
        await MeshNetworking.sendEmergencyBeacon({ message: 'Emergency mode activated' });
      }
      setSettings(prev => ({ ...prev, emergencyMode: !prev.emergencyMode }));
    } catch (error) {
      console.error('Failed to toggle emergency mode:', error);
    }
  };

  const handleNetworkRestart = async () => {
    try {
      await MeshNetworking.stopNetwork();
      await new Promise(resolve => setTimeout(resolve, 2000));
      await MeshNetworking.startNetwork();
    } catch (error) {
      console.error('Failed to restart network:', error);
    }
  };

  const getBatteryIcon = () => {
    if (deviceStatus.batteryLevel > 75) return BatteryFull;
    if (deviceStatus.batteryLevel > 50) return BatteryMedium;
    if (deviceStatus.batteryLevel > 25) return BatteryLow;
    return BatteryWarning;
  };

  const getVolumeIcon = () => {
    if (deviceStatus.volume === 0) return VolumeOff;
    if (deviceStatus.volume <= 3) return Volume;
    if (deviceStatus.volume <= 7) return Volume1;
    return Volume2;
  };

  const getWifiIcon = () => {
    if (!deviceStatus.isWifiConnected) return WifiOff;
    if (deviceStatus.signalQuality === 'excellent') return Wifi;
    if (deviceStatus.signalQuality === 'good') return WifiHigh;
    return WifiLow;
  };

  const getBluetoothIcon = () => {
    if (!deviceStatus.isBluetoothEnabled) return BluetoothOff;
    return networkStats.totalPeers > 0 ? BluetoothConnected : Bluetooth;
  };

  const BatteryIcon = getBatteryIcon();
  const VolumeIcon = getVolumeIcon();
  const WifiIcon = getWifiIcon();
  const BluetoothIcon = getBluetoothIcon();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-gradient-to-b from-gray-800 to-black rounded-2xl border-4 border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 border-b-2 border-gray-600 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <SettingsIcon className="w-6 h-6 text-orange-400" />
            <h2 className="text-xl font-bold text-white">ORAD Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
          >
            <span className="text-white text-xl">×</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Device Status Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-orange-400 border-b border-gray-600 pb-2">
              Device Status
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center space-x-2 mb-2">
                  <BatteryIcon className={`w-5 h-5 ${
                    deviceStatus.batteryLevel > 25 ? 'text-green-400' : 'text-red-400'
                  }`} />
                  <span className="text-sm text-gray-300">Battery</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {Math.round(deviceStatus.batteryLevel)}%
                </div>
              </div>

              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center space-x-2 mb-2">
                  <WifiIcon className={`w-5 h-5 ${
                    deviceStatus.isWifiConnected ? 'text-green-400' : 'text-red-400'
                  }`} />
                  <span className="text-sm text-gray-300">WiFi</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {deviceStatus.isWifiConnected ? 'Connected' : 'Offline'}
                </div>
              </div>

              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center space-x-2 mb-2">
                  <BluetoothIcon className={`w-5 h-5 ${
                    deviceStatus.isBluetoothEnabled ? 'text-blue-400' : 'text-gray-400'
                  }`} />
                  <span className="text-sm text-gray-300">Bluetooth</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {networkStats.totalPeers} Peers
                </div>
              </div>

              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center space-x-2 mb-2">
                  <VolumeIcon className="w-5 h-5 text-orange-400" />
                  <span className="text-sm text-gray-300">Volume</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {deviceStatus.volume}/10
                </div>
              </div>
            </div>
          </section>

          {/* Network Configuration */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-orange-400 border-b border-gray-600 pb-2">
              Network Configuration
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-white font-medium">Auto Connect</span>
                  <p className="text-sm text-gray-400">Automatically connect to available mesh networks</p>
                </div>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, autoConnect: !prev.autoConnect }))}
                  className={`w-12 h-6 rounded-full border-2 transition-all ${
                    settings.autoConnect 
                      ? 'bg-green-600 border-green-400' 
                      : 'bg-gray-700 border-gray-500'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.autoConnect ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-white font-medium">Emergency Mode</span>
                  <p className="text-sm text-gray-400">Activate emergency beacon broadcasting</p>
                </div>
                <button
                  onClick={handleEmergencyModeToggle}
                  className={`w-12 h-6 rounded-full border-2 transition-all ${
                    settings.emergencyMode 
                      ? 'bg-red-600 border-red-400' 
                      : 'bg-gray-700 border-gray-500'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.emergencyMode ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-white font-medium">Data Sync</span>
                  <p className="text-sm text-gray-400">Sync messages when online connection available</p>
                </div>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, dataSync: !prev.dataSync }))}
                  className={`w-12 h-6 rounded-full border-2 transition-all ${
                    settings.dataSync 
                      ? 'bg-blue-600 border-blue-400' 
                      : 'bg-gray-700 border-gray-500'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.dataSync ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </section>

          {/* Audio Settings */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-orange-400 border-b border-gray-600 pb-2">
              Audio Configuration
            </h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">Volume Level</span>
                  <span className="text-gray-300">{deviceStatus.volume}/10</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={deviceStatus.volume}
                  onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              <div>
                <span className="text-white font-medium block mb-2">Audio Quality</span>
                <select
                  value={settings.audioQuality}
                  onChange={(e) => setSettings(prev => ({ ...prev, audioQuality: e.target.value }))}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="low">Low (8kHz)</option>
                  <option value="standard">Standard (16kHz)</option>
                  <option value="high">High (48kHz)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Network Statistics */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-orange-400 border-b border-gray-600 pb-2">
              Network Statistics
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">Connected Peers</div>
                <div className="text-2xl font-bold text-white">{networkStats.totalPeers}</div>
              </div>
              
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">Signal Quality</div>
                <div className={`text-2xl font-bold capitalize ${
                  deviceStatus.signalQuality === 'excellent' ? 'text-green-400' :
                  deviceStatus.signalQuality === 'good' ? 'text-yellow-400' :
                  deviceStatus.signalQuality === 'poor' ? 'text-orange-400' : 'text-red-400'
                }`}>
                  {deviceStatus.signalQuality}
                </div>
              </div>
              
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">Uptime</div>
                <div className="text-2xl font-bold text-white">
                  {Math.floor(networkStats.uptime / 60)}m {networkStats.uptime % 60}s
                </div>
              </div>
              
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">Last Sync</div>
                <div className="text-2xl font-bold text-white">
                  {networkStats.lastSync ? networkStats.lastSync.toLocaleTimeString() : 'Never'}
                </div>
              </div>
            </div>
          </section>

          {/* Actions */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-orange-400 border-b border-gray-600 pb-2">
              Actions
            </h3>
            
            <div className="space-y-3">
              <button
                onClick={handleNetworkRestart}
                className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Restart Network
              </button>
              
              <button
                onClick={() => MeshNetworking.discoverRoute({ destination: 'broadcast' })}
                className="w-full p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                Discover Routes
              </button>
              
              <button
                onClick={() => console.log('Network diagnostics:', { deviceStatus, networkStats, settings })}
                className="w-full p-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
              >
                Run Diagnostics
              </button>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
};
