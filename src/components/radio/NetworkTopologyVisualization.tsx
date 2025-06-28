
import React, { useEffect, useRef, useState } from 'react';
import { Activity, Zap, Wifi, Users } from 'lucide-react';

interface NetworkNode {
  id: string;
  name: string;
  x: number;
  y: number;
  connections: string[];
  signalStrength: number;
  isLocal: boolean;
  transport: string;
}

interface NetworkTopologyVisualizationProps {
  isVisible: boolean;
  onClose: () => void;
}

export const NetworkTopologyVisualization: React.FC<NetworkTopologyVisualizationProps> = ({
  isVisible,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);

  useEffect(() => {
    if (isVisible) {
      generateMockTopology();
    }
  }, [isVisible]);

  const generateMockTopology = () => {
    const mockNodes: NetworkNode[] = [
      {
        id: 'local',
        name: 'Local Device',
        x: 200,
        y: 200,
        connections: ['alpha', 'beta'],
        signalStrength: 100,
        isLocal: true,
        transport: 'webrtc'
      },
      {
        id: 'alpha',
        name: 'ALPHA-001',
        x: 100,
        y: 100,
        connections: ['local', 'charlie'],
        signalStrength: 85,
        isLocal: false,
        transport: 'webrtc'
      },
      {
        id: 'beta',
        name: 'BETA-002',
        x: 300,
        y: 150,
        connections: ['local', 'delta'],
        signalStrength: 72,
        isLocal: false,
        transport: 'websocket'
      },
      {
        id: 'charlie',
        name: 'CHARLIE-003',
        x: 50,
        y: 250,
        connections: ['alpha'],
        signalStrength: 60,
        isLocal: false,
        transport: 'bluetooth'
      },
      {
        id: 'delta',
        name: 'DELTA-004',
        x: 350,
        y: 100,
        connections: ['beta'],
        signalStrength: 45,
        isLocal: false,
        transport: 'webrtc'
      }
    ];
    setNodes(mockNodes);
  };

  useEffect(() => {
    if (!isVisible || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw connections
      nodes.forEach(node => {
        node.connections.forEach(connId => {
          const connectedNode = nodes.find(n => n.id === connId);
          if (connectedNode) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(connectedNode.x, connectedNode.y);
            ctx.strokeStyle = `rgba(34, 197, 94, ${node.signalStrength / 100 * 0.7})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        });
      });

      // Draw nodes
      nodes.forEach(node => {
        const radius = node.isLocal ? 20 : 15;
        
        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = node.isLocal ? '#22c55e' : getTransportColor(node.transport);
        ctx.fill();
        
        // Signal strength ring
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI * (node.signalStrength / 100));
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Node label
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.name, node.x, node.y + radius + 15);
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, [nodes, isVisible]);

  const getTransportColor = (transport: string): string => {
    switch (transport) {
      case 'webrtc': return '#3b82f6';
      case 'websocket': return '#8b5cf6';
      case 'bluetooth': return '#06b6d4';
      case 'mdns': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const clickedNode = nodes.find(node => {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      return distance <= (node.isLocal ? 20 : 15);
    });

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
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Canvas */}
          <div className="lg:col-span-2">
            <canvas
              ref={canvasRef}
              width={400}
              height={300}
              className="bg-gray-800 rounded-lg border border-gray-600 cursor-pointer"
              onClick={handleCanvasClick}
            />
          </div>

          {/* Node Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-400">Network Stats</h3>
            <div className="bg-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Total Nodes:</span>
                <span className="text-white font-mono">{nodes.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Active Connections:</span>
                <span className="text-white font-mono">
                  {nodes.reduce((acc, node) => acc + node.connections.length, 0) / 2}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Avg Signal:</span>
                <span className="text-white font-mono">
                  {Math.round(nodes.reduce((acc, node) => acc + node.signalStrength, 0) / nodes.length)}%
                </span>
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
                    <span className="text-white font-mono">{selectedNode.signalStrength}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Transport:</span>
                    <span className="text-white font-mono">{selectedNode.transport}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Connections:</span>
                    <span className="text-white font-mono">{selectedNode.connections.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Transport Legend */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-blue-400 font-semibold mb-3">Transport Types</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-300">WebRTC</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-gray-300">WebSocket</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                  <span className="text-gray-300">Bluetooth</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-gray-300">mDNS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
