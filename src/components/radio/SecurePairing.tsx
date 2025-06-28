
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, QrCode, Key, Check, X, Copy, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { DevicePairing } from '../../services/EncryptionService';

interface SecurePairingProps {
  onClose: () => void;
  pairedDevices: DevicePairing[];
  onGeneratePairingCode: () => Promise<string>;
  onProcessPairingCode: (code: string) => Promise<DevicePairing>;
  onVerifyPairing: (deviceId: string, code: string) => Promise<boolean>;
  onRemovePairing: (deviceId: string) => void;
  onRotateKeys: () => Promise<void>;
}

export const SecurePairing: React.FC<SecurePairingProps> = ({
  onClose,
  pairedDevices,
  onGeneratePairingCode,
  onProcessPairingCode,
  onVerifyPairing,
  onRemovePairing,
  onRotateKeys
}) => {
  const [activeTab, setActiveTab] = useState<'pair' | 'devices'>('pair');
  const [pairingCode, setPairingCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingDevice, setPendingDevice] = useState<DevicePairing | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGeneratePairingCode = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const code = await onGeneratePairingCode();
      setPairingCode(code);
    } catch (err) {
      setError('Failed to generate pairing code');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProcessPairingCode = async () => {
    if (!inputCode.trim()) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const pairing = await onProcessPairingCode(inputCode);
      setPendingDevice(pairing);
      setInputCode('');
      
      // Generate verification code for the user
      const timestamp = pairing.timestamp.toString();
      const simpleCode = timestamp.slice(-6);
      setVerificationCode(simpleCode);
    } catch (err) {
      setError('Invalid pairing code');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyPairing = async () => {
    if (!pendingDevice || !verificationCode) return;
    
    setIsVerifying(true);
    setError(null);
    
    try {
      const success = await onVerifyPairing(pendingDevice.deviceId, verificationCode);
      if (success) {
        setPendingDevice(null);
        setVerificationCode('');
      } else {
        setError('Verification failed');
      }
    } catch (err) {
      setError('Verification error');
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
    >
      <Card className="w-full max-w-md bg-gray-900 border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <CardTitle className="text-white">Secure Pairing</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex space-x-2">
            <Button
              variant={activeTab === 'pair' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('pair')}
              className="flex-1"
            >
              <Key className="w-4 h-4 mr-1" />
              Pair Device
            </Button>
            <Button
              variant={activeTab === 'devices' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('devices')}
              className="flex-1"
            >
              <Shield className="w-4 h-4 mr-1" />
              Devices ({pairedDevices.filter(d => d.verified).length})
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'pair' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {/* Generate Pairing Code */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">Share this code:</label>
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleGeneratePairingCode}
                      disabled={isGenerating}
                      className="flex-1"
                    >
                      {isGenerating ? (
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <QrCode className="w-4 h-4 mr-1" />
                      )}
                      Generate Code
                    </Button>
                  </div>
                  
                  {pairingCode && (
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <code className="text-xs text-green-400 break-all font-mono">
                          {pairingCode}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(pairingCode)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Enter Pairing Code */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">Enter pairing code:</label>
                  <div className="flex space-x-2">
                    <Input
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value)}
                      placeholder="Paste pairing code here..."
                      className="flex-1 bg-gray-800 border-gray-600"
                    />
                    <Button
                      onClick={handleProcessPairingCode}
                      disabled={!inputCode.trim() || isProcessing}
                    >
                      {isProcessing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        'Pair'
                      )}
                    </Button>
                  </div>
                </div>

                {/* Verification Step */}
                {pendingDevice && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3"
                  >
                    <div className="space-y-2">
                      <div className="text-sm text-yellow-300">
                        Verify pairing with {pendingDevice.deviceId}:
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-mono text-white bg-gray-800 px-3 py-2 rounded">
                          {verificationCode}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Confirm this code matches on both devices
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={handleVerifyPairing}
                          disabled={isVerifying}
                          className="flex-1"
                        >
                          {isVerifying ? (
                            <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-1" />
                          )}
                          Verify
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setPendingDevice(null)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-400 text-sm bg-red-900/20 border border-red-700 rounded p-2"
                  >
                    {error}
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'devices' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Paired Devices</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onRotateKeys}
                    className="text-xs"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Rotate Keys
                  </Button>
                </div>

                {pairedDevices.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No paired devices
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {pairedDevices.map((device) => (
                      <div
                        key={device.deviceId}
                        className="flex items-center justify-between bg-gray-800 p-3 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-white font-mono">
                              {device.deviceId}
                            </span>
                            <Badge
                              variant={device.verified ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {device.verified ? 'Verified' : 'Pending'}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(device.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRemovePairing(device.deviceId)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};
