
import { useState, useEffect, useCallback } from 'react';
import { meshNetworkCore, type MeshNode, type MeshPacket } from '../services/MeshNetworkCore';

export interface RadioState {
  isPoweredOn: boolean;
  channel: number;
  volume: number;
  squelch: number;
  batteryLevel: number;
  signalStrength: number;
  isTransmitting: boolean;
  isReceiving: boolean;
  discoveredNodes: MeshNode[];
  networkStats: any;
  emergencyMode: boolean;
}

export const useRadioState = () => {
  const [radioState, setRadioState] = useState<RadioState>({
    isPoweredOn: false,
    channel: 1,
    volume: 5,
    squelch: 3,
    batteryLevel: 100,
    signalStrength: 0,
    isTransmitting: false,
    isReceiving: false,
    discoveredNodes: [],
    networkStats: {},
    emergencyMode: false
  });

  const [messages, setMessages] = useState<MeshPacket[]>([]);

  useEffect(() => {
    // Set up mesh network listeners
    meshNetworkCore.on('nodeDiscovered', (node: MeshNode) => {
      setRadioState(prev => ({
        ...prev,
        discoveredNodes: meshNetworkCore.getDiscoveredNodes(),
        signalStrength: Math.max(prev.signalStrength, node.signalStrength)
      }));
    });

    meshNetworkCore.on('messageReceived', (packet: MeshPacket) => {
      setMessages(prev => [...prev.slice(-49), packet]);
      
      if (packet.type === 'voice' || packet.type === 'text') {
        setRadioState(prev => ({ ...prev, isReceiving: true }));
        setTimeout(() => {
          setRadioState(prev => ({ ...prev, isReceiving: false }));
        }, 1000);
      }
    });

    meshNetworkCore.on('networkStarted', () => {
      setRadioState(prev => ({ ...prev, signalStrength: 75 }));
    });

    // Update network stats periodically
    const statsInterval = setInterval(() => {
      if (radioState.isPoweredOn) {
        const stats = meshNetworkCore.getNetworkStats();
        setRadioState(prev => ({
          ...prev,
          networkStats: stats,
          batteryLevel: stats.batteryLevel,
          discoveredNodes: meshNetworkCore.getDiscoveredNodes()
        }));
      }
    }, 2000);

    return () => {
      clearInterval(statsInterval);
    };
  }, [radioState.isPoweredOn]);

  const powerToggle = useCallback(() => {
    setRadioState(prev => {
      const newPowerState = !prev.isPoweredOn;
      
      if (newPowerState) {
        meshNetworkCore.startNetwork();
      } else {
        meshNetworkCore.stopNetwork();
        setMessages([]);
      }

      return {
        ...prev,
        isPoweredOn: newPowerState,
        signalStrength: newPowerState ? 75 : 0,
        discoveredNodes: newPowerState ? prev.discoveredNodes : [],
        emergencyMode: newPowerState ? prev.emergencyMode : false
      };
    });
  }, []);

  const changeChannel = useCallback((newChannel: number) => {
    if (newChannel >= 1 && newChannel <= 99) {
      setRadioState(prev => ({ ...prev, channel: newChannel }));
    }
  }, []);

  const adjustVolume = useCallback((newVolume: number) => {
    if (newVolume >= 0 && newVolume <= 10) {
      setRadioState(prev => ({ ...prev, volume: newVolume }));
    }
  }, []);

  const adjustSquelch = useCallback((newSquelch: number) => {
    if (newSquelch >= 0 && newSquelch <= 10) {
      setRadioState(prev => ({ ...prev, squelch: newSquelch }));
    }
  }, []);

  const transmitMessage = useCallback((type: 'voice' | 'text' | 'emergency', payload: any) => {
    if (!radioState.isPoweredOn) return null;

    setRadioState(prev => ({ ...prev, isTransmitting: true }));
    
    const messageId = meshNetworkCore.sendMessage(type, {
      channel: radioState.channel,
      content: payload,
      timestamp: Date.now()
    });

    setTimeout(() => {
      setRadioState(prev => ({ ...prev, isTransmitting: false }));
    }, type === 'voice' ? 2000 : 500);

    return messageId;
  }, [radioState.isPoweredOn, radioState.channel]);

  const toggleEmergencyMode = useCallback(() => {
    if (!radioState.isPoweredOn) return;

    setRadioState(prev => {
      const newEmergencyMode = !prev.emergencyMode;
      
      if (newEmergencyMode) {
        // Send emergency beacon
        meshNetworkCore.sendMessage('emergency', {
          type: 'distress',
          location: 'Unknown',
          message: 'Emergency beacon activated',
          timestamp: Date.now()
        });
      }

      return { ...prev, emergencyMode: newEmergencyMode };
    });
  }, [radioState.isPoweredOn]);

  return {
    radioState,
    messages,
    powerToggle,
    changeChannel,
    adjustVolume,
    adjustSquelch,
    transmitMessage,
    toggleEmergencyMode
  };
};
