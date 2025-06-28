
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, Key, Check, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';
import { unifiedMeshService } from '../../services/UnifiedMeshService';

interface PairingResult {
  success: boolean;
  deviceId?: string;
  deviceName?: string;
  error?: string;
}

interface SecurePairingProps {
  isVisible: boolean;
  onClose: () => void;
}

export const SecurePairing: React.FC<SecurePairingProps> = ({ isVisible, onClose }) => {
  const [pairingCode, setPairingCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    if (isVisible) {
      loadPairedDevices();
    }
  }, [isVisible]);

  const loadPairedDevices = () => {
    const devices = unifiedMeshService.getPairedDevices();
    setPairedDevices(devices);
  };

  const generatePairingCode = async () => {
    setIsGenerating(true);
    try {
      const code = await unifiedMeshService.generatePairingCode();
      setPairingCode(code);
      toast({
        title: "Pairing Code Generated",
        description: "Share this code with the device you want to pair",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate pairing code",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const processPairingCode = async () => {
    if (!inputCode.trim()) return;

    setIsProcessing(true);
    try {
      const result: PairingResult = await unifiedMeshService.processPairingCode(inputCode);
      if (result.success && result.deviceId && result.deviceName) {
        setSelectedDevice(result.deviceId);
        toast({
          title: "Device Found",
          description: `Found device: ${result.deviceName}`,
        });
      } else {
        toast({
          title: "Invalid Code",
          description: result.error || "The pairing code is invalid or expired",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process pairing code",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const verifyPairing = async () => {
    if (!selectedDevice || !verificationCode) return;

    try {
      const success = await unifiedMeshService.verifyPairing(selectedDevice, verificationCode);
      if (success) {
        toast({
          title: "Pairing Successful",
          description: "Device successfully paired and encrypted communication enabled",
        });
        loadPairedDevices();
        setSelectedDevice(null);
        setVerificationCode('');
        setInputCode('');
      } else {
        toast({
          title: "Verification Failed",
          description: "Invalid verification code",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify pairing",
        variant: "destructive"
      });
    }
  };

  const removePairing = (deviceId: string) => {
    unifiedMeshService.removePairing(deviceId);
    loadPairedDevices();
    toast({
      title: "Device Removed",
      description: "Device pairing has been removed",
    });
  };

  const rotateKeys = async () => {
    try {
      await unifiedMeshService.rotateKeys();
      toast({
        title: "Keys Rotated",
        description: "Encryption keys have been rotated for all paired devices",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to rotate encryption keys",
        variant: "destructive"
      });
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 rounded-2xl border-2 border-green-400 p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-green-400" />
            <h2 className="text-xl font-bold text-white">Secure Pairing</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Generate Pairing Code */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-green-400">Generate Pairing Code</h3>
          <div className="bg-gray-800 rounded-lg p-4">
            {pairingCode ? (
              <div className="text-center">
                <div className="text-2xl font-mono text-white bg-gray-700 rounded p-3 mb-3">
                  {pairingCode}
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Share this code with the device you want to pair
                </p>
                <Button
                  onClick={() => setPairingCode('')}
                  variant="outline"
                  size="sm"
                  className="text-gray-300"
                >
                  Generate New Code
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <Button
                  onClick={generatePairingCode}
                  disabled={isGenerating}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      Generate Code
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Enter Pairing Code */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-green-400">Enter Pairing Code</h3>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white font-mono text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                maxLength={8}
              />
              <Button
                onClick={processPairingCode}
                disabled={!inputCode.trim() || isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </Button>
            </div>

            {selectedDevice && (
              <div className="border-t border-gray-700 pt-3">
                <p className="text-sm text-green-400 mb-2">Device found! Enter verification code:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Verification Code"
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <Button
                    onClick={verifyPairing}
                    disabled={!verificationCode}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Verify
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Paired Devices */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-green-400">Paired Devices</h3>
            {pairedDevices.length > 0 && (
              <Button
                onClick={rotateKeys}
                variant="outline"
                size="sm"
                className="text-yellow-400 border-yellow-400 hover:bg-yellow-400/10"
              >
                Rotate Keys
              </Button>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            {pairedDevices.length === 0 ? (
              <div className="text-center text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No paired devices</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pairedDevices.map((device) => (
                  <div key={device.deviceId} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                    <div>
                      <div className="font-mono text-white">{device.name}</div>
                      <div className="text-xs text-gray-400">{device.deviceId}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {device.verified ? (
                          <span className="text-green-400 text-xs flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="text-yellow-400 text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => removePairing(device.deviceId)}
                      variant="destructive"
                      size="sm"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
