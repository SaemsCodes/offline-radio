
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Radio, Wifi, Users, Signal, Battery, Zap } from 'lucide-react';
import { meshNetworkCore, type MeshNode } from '../../services/MeshNetworkCore';

interface NetworkTopologyVisualizationProps {
  isVisible: boolean;
  onClose: () => void;
}

export const NetworkTopologyVisualization: React.FC<NetworkTopologyVisualizationProps> = ({
  isVisible,
  onClose
}) => {
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [networkStats, setNetworkStats] = useState<any>({});
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    const updateNetworkData = () => {
      const discoveredNodes = meshNetworkCore.getDiscoveredNodes();
      const stats = meshNetworkCore.getNetworkStats();
      
      setNodes(discoveredNodes);
      setNetworkStats(stats);
    };

    // Initial load
    updateNetworkData();

    // Update every 2 seconds
    const interval = setInterval(updateNetworkData, 2000);

    return () => clearInterval(interval);
  }, [isVisible]);

  const getSignalStrengthColor = (strength: number) => {
    if (strength > 70) return 'text-green-400';
    if (strength > 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBatteryColor = (level: number) => {
    if (level > 50) return 'text-green-400';
    if (level > 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatLastSeen = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[120] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 rounded-2xl border-2 border-green-400 w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Wifi className="w-6 h-6 text-green-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Network Topology</h2>
              <p className="text-sm text-gray-400">
                {nodes.length} nodes • {networkStats.queuedMessages || 0} queued messages
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Network Visualization */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-4">
              {/* Network Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-300">Active Nodes</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{nodes.length}</div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Signal className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-300">Avg Signal</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {nodes.length > 0 ? Math.round(nodes.reduce((sum, node) => sum + node.signalStrength, 0) / nodes.length) : 0}%
                  </div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Battery className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-gray-300">Avg Battery</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {nodes.length > 0 ? Math.round(nodes.reduce((sum, node) => sum + node.batteryLevel, 0) / nodes.length) : 0}%
                  </div>
                </div>
              </div>

              {/* Node Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {nodes.map((node) => (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-gray-800 rounded-lg p-4 cursor-pointer transition-all hover:bg-gray-700 ${
                      selectedNode?.id === node.id ? 'ring-2 ring-green-400' : ''
                    }`}
                    onClick={() => setSelectedNode(node)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Radio className="w-5 h-5 text-green-400" />
                        <span className="font-mono text-white font-semibold">{node.name}</span>
                      </div>
                      {node.isRelay && (
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                          RELAY
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Signal:</span>
                        <span className={`text-sm font-semibold ${getSignalStrengthColor(node.signalStrength)}`}>
                          {Math.round(node.signalStrength)}%
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Battery:</span>
                        <span className={`text-sm font-semibold ${getBatteryColor(node.batteryLevel)}`}>
                          {Math.round(node.batteryLevel)}%
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Last Seen:</span>
                        <span className="text-sm text-gray-300">
                          {formatLastSeen(node.lastSeen)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Capabilities */}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {node.capabilities.map((capability) => (
                        <span
                          key={capability}
                          className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                        >
                          {capability.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>

              {nodes.length === 0 && (
                <div className="text-center py-12">
                  <Wifi className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-400 mb-2">No Nodes Discovered</h3>
                  <p className="text-gray-500">
                    Turn on your radio and wait for other nodes to appear in the network.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Node Details Panel */}
          {selectedNode && (
            <div className="w-80 border-l border-gray-700 bg-gray-800 p-6 overflow-y-auto">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-white mb-2">Node Details</h3>
                <div className="text-sm text-gray-400 font-mono">{selectedNode.id}</div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Status</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Name:</span>
                      <span className="text-sm text-white">{selectedNode.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Signal Strength:</span>
                      <span className={`text-sm font-semibold ${getSignalStrengthColor(selectedNode.signalStrength)}`}>
                        {Math.round(selectedNode.signalStrength)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Battery Level:</span>
                      <span className={`text-sm font-semibold ${getBatteryColor(selectedNode.batteryLevel)}`}>
                        {Math.round(selectedNode.batteryLevel)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Is Relay:</span>
                      <span className="text-sm text-white">
                        {selectedNode.isRelay ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Capabilities</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                      >
                        {capability.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>

                {selectedNode.location && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Location</h4>
                    <div className="text-sm text-gray-400 font-mono">
                      {selectedNode.location.lat.toFixed(6)}, {selectedNode.location.lng.toFixed(6)}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Network Info</h4>
                  <div className="space-y-1 text-sm">
                    <div className="text-gray-400">
                      Last seen: {formatLastSeen(selectedNode.lastSeen)}
                    </div>
                    <div className="text-gray-400">
                      Node ID: {selectedNode.id.slice(-8)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
