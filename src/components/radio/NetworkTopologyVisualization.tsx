
import React, { useEffect, useRef, useState } from 'react';
import { Activity, X } from 'lucide-react';
import { meshNetworkCore, type MeshNode } from '../../services/MeshNetworkCore';

interface NetworkTopologyVisualizationProps {
  isVisible: boolean;
  onClose: () => void;
}

export const NetworkTopologyVisualization: React.FC<NetworkTopologyVisualizationProps> = ({
  isVisible,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);
  const [networkStats, setNetworkStats] = useState<any>({});

  useEffect(() => {
    if (isVisible) {
      // Get current network state
      const currentNodes = meshNetworkCore.getDiscoveredNodes();
      const stats = meshNetworkCore.getNetworkStats();
      
      setNodes(currentNodes);
      setNetworkStats(stats);

      // Set up listeners for real-time updates
      const handleNodeDiscovered = (node: MeshNode) => {
        setNodes(meshNetworkCore.getDiscoveredNodes());
      };

      const handleNodeLost = () => {
        setNodes(meshNetworkCore.getDiscoveredNodes());
      };

      meshNetworkCore.on('nodeDiscovered', handleNodeDiscovered);
      meshNetworkCore.on('nodeLost', handleNodeLost);

      // Update stats periodically
      const statsInterval = setInterval(() => {
        setNetworkStats(meshNetworkCore.getNetworkStats());
      }, 2000);

      return () => {
        clearInterval(statsInterval);
      };
    }
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !canvasRef.current || nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Position nodes in a circle
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height) / 3;

      const nodePositions = nodes.map((node, index) => {
        const angle = (index / nodes.length) * 2 * Math.PI;
        return {
          node,
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        };
      });

      // Draw connections
      nodePositions.forEach(({ node: sourceNode, x: sourceX, y: sourceY }) => {
        nodePositions.forEach(({ node: targetNode, x: targetX, y: targetY }) => {
          if (sourceNode.id !== targetNode.id) {
            ctx.beginPath();
            ctx.moveTo(sourceX, sourceY);
            ctx.lineTo(targetX, targetY);
            ctx.strokeStyle = `rgba(34, 197, 94, ${Math.min(sourceNode.signalStrength, targetNode.signalStrength) / 100 * 0.5})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      // Draw nodes
      nodePositions.forEach(({ node, x, y }) => {
        const radius = node.id === networkStats.nodeId ? 20 : 15;
        
        // Node circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = node.id === networkStats.nodeId ? '#22c55e' : getNodeColor(node);
        ctx.fill();
        
        // Signal strength ring
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, 2 * Math.PI * (node.signalStrength / 100));
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Node label
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.name || node.id.slice(-4), x, y + radius + 15);
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, [nodes, isVisible, networkStats]);

  const getNodeColor = (node: MeshNode): string => {
    if (node.batteryLevel < 20) return '#ef4444';
    if (node.batteryLevel < 50) return '#f59e0b';
    return '#3b82f6';
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Simple click detection - in a real implementation you'd check actual positions
    const clickedNode = nodes[0]; // Simplified
    setSelectedNode(clickedNode || null);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border-2 border-blue-400 p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Network Topology</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Canvas */}
          <div className="lg:col-span-2">
            <canvas
              ref={canvasRef}
              width={400}
              height={300}
              className="bg-gray-800 rounded-lg border border-gray-600 cursor-pointer w-full"
              onClick={handleCanvasClick}
            />
          </div>

          {/* Network Stats */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-400">Network Stats</h3>
            <div className="bg-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Total Nodes:</span>
                <span className="text-white font-mono">{nodes.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Active Routes:</span>
                <span className="text-white font-mono">{networkStats.activeRoutes || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Queue Depth:</span>
                <span className="text-white font-mono">{networkStats.queuedMessages || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Battery:</span>
                <span className="text-white font-mono">{Math.round(networkStats.batteryLevel || 0)}%</span>
              </div>
            </div>

            {selectedNode && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-blue-400 font-semibold mb-3">Node Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Name:</span>
                    <span className="text-white font-mono">{selectedNode.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Signal:</span>
                    <span className="text-white font-mono">{Math.round(selectedNode.signalStrength)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Battery:</span>
                    <span className="text-white font-mono">{Math.round(selectedNode.batteryLevel)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Relay:</span>
                    <span className="text-white font-mono">{selectedNode.isRelay ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Node List */}
            <div className="bg-gray-800 rounded-lg p-4 max-h-40 overflow-y-auto">
              <h4 className="text-blue-400 font-semibold mb-3">Connected Nodes</h4>
              <div className="space-y-1 text-xs">
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    className={`flex items-center gap-2 p-1 rounded ${
                      node.id === networkStats.nodeId ? 'bg-green-900/30' : ''
                    }`}
                  >
                    <div 
                      className={`w-2 h-2 rounded-full ${
                        node.signalStrength > 75 ? 'bg-green-400' :
                        node.signalStrength > 50 ? 'bg-yellow-400' : 'bg-red-400'
                      }`} 
                    />
                    <span className="text-gray-300 flex-1">{node.name}</span>
                    <span className="text-gray-400">{Math.round(node.signalStrength)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
