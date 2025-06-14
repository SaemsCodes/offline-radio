
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { StatusBar } from '@capacitor/status-bar';

export interface RealDeviceStatus {
  batteryLevel: number;
  isCharging: boolean;
  isOnline: boolean;
  isWifiConnected: boolean;
  isBluetoothEnabled: boolean;
  networkType: string;
  signalStrength: number;
  deviceModel: string;
  osVersion: string;
  isLowPowerMode: boolean;
  volume: number;
  signalQuality: 'excellent' | 'good' | 'poor' | 'none';
}

class DeviceStatusManager {
  private status: RealDeviceStatus = {
    batteryLevel: 100,
    isCharging: false,
    isOnline: navigator.onLine,
    isWifiConnected: false,
    isBluetoothEnabled: false,
    networkType: 'unknown',
    signalStrength: 0,
    deviceModel: 'Unknown',
    osVersion: 'Unknown',
    isLowPowerMode: false,
    volume: 7,
    signalQuality: 'none'
  };

  private listeners: Set<(status: RealDeviceStatus) => void> = new Set();
  private updateInterval: NodeJS.Timeout | null = null;
  private networkListener: any = null;

  constructor() {
    this.initializeDeviceInfo();
    this.setupListeners();
    this.startPeriodicUpdates();
  }

  private async initializeDeviceInfo() {
    try {
      // Get device information
      const deviceInfo = await Device.getInfo();
      this.status.deviceModel = deviceInfo.model || 'Unknown';
      this.status.osVersion = deviceInfo.osVersion || 'Unknown';
      
      console.log('Device Info:', {
        model: deviceInfo.model,
        platform: deviceInfo.platform,
        osVersion: deviceInfo.osVersion,
        manufacturer: deviceInfo.manufacturer
      });

      // Get initial network status
      await this.updateNetworkStatus();
      
      // Get initial battery status
      await this.updateBatteryStatus();
      
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to initialize device info:', error);
    }
  }

  private setupListeners() {
    // Network status listener
    this.networkListener = Network.addListener('networkStatusChange', (status) => {
      this.status.isOnline = status.connected;
      this.status.isWifiConnected = status.connectionType === 'wifi';
      this.status.networkType = status.connectionType || 'unknown';
      this.updateSignalQuality();
      this.notifyListeners();
    });

    // Browser online/offline events
    window.addEventListener('online', () => {
      this.status.isOnline = true;
      this.updateSignalQuality();
      this.notifyListeners();
    });

    window.addEventListener('offline', () => {
      this.status.isOnline = false;
      this.updateSignalQuality();
      this.notifyListeners();
    });

    // Battery events (if supported)
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        battery.addEventListener('chargingchange', () => {
          this.status.isCharging = battery.charging;
          this.notifyListeners();
        });

        battery.addEventListener('levelchange', () => {
          this.status.batteryLevel = Math.round(battery.level * 100);
          this.notifyListeners();
        });
      });
    }
  }

  private async updateNetworkStatus() {
    try {
      const networkStatus = await Network.getStatus();
      this.status.isOnline = networkStatus.connected;
      this.status.isWifiConnected = networkStatus.connectionType === 'wifi';
      this.status.networkType = networkStatus.connectionType || 'unknown';
      
      // Estimate signal strength based on connection type
      this.estimateSignalStrength(networkStatus.connectionType);
      this.updateSignalQuality();
    } catch (error) {
      console.error('Failed to get network status:', error);
      // Fallback to browser API
      this.status.isOnline = navigator.onLine;
      this.status.networkType = 'unknown';
      this.updateSignalQuality();
    }
  }

  private async updateBatteryStatus() {
    try {
      // Try to get battery info from device plugin
      const batteryInfo = await Device.getBatteryInfo();
      if (batteryInfo) {
        this.status.batteryLevel = Math.round(batteryInfo.batteryLevel || 100);
        this.status.isCharging = batteryInfo.isCharging || false;
      }
    } catch (error) {
      // Fallback to browser battery API
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          this.status.batteryLevel = Math.round(battery.level * 100);
          this.status.isCharging = battery.charging;
        } catch {
          console.log('Battery API not available, using simulated battery');
          this.simulateBatteryDrain();
        }
      } else {
        this.simulateBatteryDrain();
      }
    }
  }

  private estimateSignalStrength(connectionType: string) {
    switch (connectionType) {
      case 'wifi':
        this.status.signalStrength = 85 + Math.random() * 15; // 85-100%
        break;
      case 'cellular':
        this.status.signalStrength = 60 + Math.random() * 30; // 60-90%
        break;
      case 'bluetooth':
        this.status.signalStrength = 70 + Math.random() * 20; // 70-90%
        break;
      case 'ethernet':
        this.status.signalStrength = 95 + Math.random() * 5; // 95-100%
        break;
      default:
        this.status.signalStrength = 0;
    }
  }

  private updateSignalQuality() {
    if (!this.status.isOnline || this.status.signalStrength === 0) {
      this.status.signalQuality = 'none';
    } else if (this.status.signalStrength >= 80) {
      this.status.signalQuality = 'excellent';
    } else if (this.status.signalStrength >= 50) {
      this.status.signalQuality = 'good';
    } else {
      this.status.signalQuality = 'poor';
    }
  }

  private simulateBatteryDrain() {
    // Simulate realistic battery drain for demonstration
    const drainRate = 0.01; // 1% per minute when transmitting
    const baseDrain = 0.001; // 0.1% per minute normally
    
    setInterval(() => {
      if (this.status.batteryLevel > 0 && !this.status.isCharging) {
        this.status.batteryLevel = Math.max(0, this.status.batteryLevel - baseDrain);
        
        // Notify if battery is low
        if (this.status.batteryLevel <= 20 && this.status.batteryLevel > 19.9) {
          console.warn('Low battery warning');
        }
      }
    }, 60000); // Check every minute
  }

  private startPeriodicUpdates() {
    // Update device status every 10 seconds
    this.updateInterval = setInterval(async () => {
      await this.updateNetworkStatus();
      await this.updateBatteryStatus();
      this.notifyListeners();
    }, 10000);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.status));
  }

  // Public API methods
  public getStatus(): RealDeviceStatus {
    return { ...this.status };
  }

  public setVolume(volume: number) {
    this.status.volume = Math.max(0, Math.min(10, volume));
    this.notifyListeners();
  }

  public onStatusChange(listener: (status: RealDeviceStatus) => void) {
    this.listeners.add(listener);
    // Immediately call with current status
    listener(this.status);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async checkBluetoothStatus(): Promise<boolean> {
    try {
      // In a real app, you would use a Bluetooth plugin
      // For now, we'll simulate based on device capabilities
      if ('bluetooth' in navigator) {
        const bluetooth = (navigator as any).bluetooth;
        const available = await bluetooth.getAvailability();
        this.status.isBluetoothEnabled = available;
        return available;
      }
      return false;
    } catch {
      return false;
    }
  }

  public simulateTransmission() {
    // Simulate battery drain during transmission
    if (this.status.batteryLevel > 0) {
      this.status.batteryLevel = Math.max(0, this.status.batteryLevel - 0.1);
      this.notifyListeners();
    }
  }

  public async requestLocationPermission(): Promise<boolean> {
    try {
      if ('geolocation' in navigator) {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
            { timeout: 5000 }
          );
        });
      }
      return false;
    } catch {
      return false;
    }
  }

  public destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    if (this.networkListener) {
      this.networkListener.remove();
    }
    
    this.listeners.clear();
  }
}

export const deviceStatusManager = new DeviceStatusManager();
