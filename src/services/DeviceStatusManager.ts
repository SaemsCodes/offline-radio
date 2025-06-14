
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

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
  private isNativeMode: boolean = false;

  constructor() {
    this.isNativeMode = Capacitor.isNativePlatform();
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
        manufacturer: deviceInfo.manufacturer,
        isNative: this.isNativeMode
      });

      // Get initial network status
      await this.updateNetworkStatus();
      
      // Get initial battery status
      await this.updateBatteryStatus();
      
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to initialize device info:', error);
      this.fallbackToWebAPIs();
    }
  }

  private fallbackToWebAPIs() {
    console.log('Using web API fallbacks');
    this.status.deviceModel = navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop';
    this.status.osVersion = navigator.platform;
    this.status.isOnline = navigator.onLine;
    
    // Set up web-specific listeners
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

    // Try to get battery info if available
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        this.status.batteryLevel = Math.round(battery.level * 100);
        this.status.isCharging = battery.charging;
        
        battery.addEventListener('chargingchange', () => {
          this.status.isCharging = battery.charging;
          this.notifyListeners();
        });

        battery.addEventListener('levelchange', () => {
          this.status.batteryLevel = Math.round(battery.level * 100);
          this.notifyListeners();
        });
        
        this.notifyListeners();
      }).catch(() => {
        console.log('Battery API not available');
        this.simulateBatteryForTesting();
      });
    } else {
      this.simulateBatteryForTesting();
    }
  }

  private setupListeners() {
    if (!this.isNativeMode) {
      this.fallbackToWebAPIs();
      return;
    }

    try {
      // Network status listener
      this.networkListener = Network.addListener('networkStatusChange', (status) => {
        this.status.isOnline = status.connected;
        this.status.isWifiConnected = status.connectionType === 'wifi';
        this.status.networkType = status.connectionType || 'unknown';
        this.updateSignalQuality();
        this.notifyListeners();
        
        console.log('Network status changed:', status);
      });

      console.log('Native network listeners set up');
    } catch (error) {
      console.error('Failed to set up native listeners:', error);
      this.fallbackToWebAPIs();
    }
  }

  private async updateNetworkStatus() {
    try {
      if (this.isNativeMode) {
        const networkStatus = await Network.getStatus();
        this.status.isOnline = networkStatus.connected;
        this.status.isWifiConnected = networkStatus.connectionType === 'wifi';
        this.status.networkType = networkStatus.connectionType || 'unknown';
        
        console.log('Network status updated:', networkStatus);
      } else {
        this.status.isOnline = navigator.onLine;
        this.status.networkType = this.status.isOnline ? 'wifi' : 'none';
        this.status.isWifiConnected = this.status.isOnline;
      }
      
      // Estimate signal strength based on connection type
      this.estimateSignalStrength(this.status.networkType);
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
      if (this.isNativeMode) {
        // Try to get battery info from device plugin
        const batteryInfo = await Device.getBatteryInfo();
        if (batteryInfo) {
          this.status.batteryLevel = Math.round(batteryInfo.batteryLevel || 100);
          this.status.isCharging = batteryInfo.isCharging || false;
          
          console.log('Battery status updated:', {
            level: this.status.batteryLevel,
            charging: this.status.isCharging
          });
        }
      } else {
        // Web fallback handled in fallbackToWebAPIs
        if (!('getBattery' in navigator)) {
          this.simulateBatteryForTesting();
        }
      }
    } catch (error) {
      console.error('Failed to get battery status:', error);
      this.simulateBatteryForTesting();
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

  private simulateBatteryForTesting() {
    console.log('Using simulated battery for testing');
    
    // Start with a realistic battery level
    this.status.batteryLevel = 85 + Math.random() * 15;
    this.status.isCharging = Math.random() > 0.7; // 30% chance of charging
    
    // Simulate realistic battery drain
    const drainRate = 0.001; // 0.1% per minute normally
    
    setInterval(() => {
      if (!this.status.isCharging && this.status.batteryLevel > 0) {
        this.status.batteryLevel = Math.max(0, this.status.batteryLevel - drainRate);
        
        // Notify if battery is low
        if (this.status.batteryLevel <= 20 && this.status.batteryLevel > 19.9) {
          console.warn('Low battery warning');
        }
        
        this.notifyListeners();
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
      if (this.isNativeMode) {
        // In a real app, you would use a Bluetooth plugin
        // For now, we'll check if it's in active transports
        return this.status.isBluetoothEnabled;
      } else {
        // Web fallback - check if bluetooth API is available
        if ('bluetooth' in navigator) {
          const bluetooth = (navigator as any).bluetooth;
          const available = await bluetooth.getAvailability();
          this.status.isBluetoothEnabled = available;
          return available;
        }
        return false;
      }
    } catch (error) {
      console.error('Bluetooth check failed:', error);
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
