
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  Users, 
  MessageSquare, 
  Shield, 
  Download,
  RefreshCw,
  Wifi,
  Battery,
  Signal
} from 'lucide-react';
import { productionErrorHandler, type ErrorReport, type SystemMetrics } from '../../services/ProductionErrorHandler';
import { messagePersistenceService, type MessageStats } from '../../services/MessagePersistenceService';
import { networkAnalyticsService, type NetworkAnalytics, type PeerAnalytics } from '../../services/NetworkAnalyticsService';

interface ProductionDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

export const ProductionDashboard: React.FC<ProductionDashboardProps> = ({
  isVisible,
  onClose
}) => {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [messageStats, setMessageStats] = useState<MessageStats | null>(null);
  const [networkAnalytics, setNetworkAnalytics] = useState<NetworkAnalytics | null>(null);
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  const [topPeers, setTopPeers] = useState<PeerAnalytics[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isVisible) return;

    const updateData = () => {
      setSystemMetrics(productionErrorHandler.getMetrics());
      setMessageStats(messagePersistenceService.getStats());
      setNetworkAnalytics(networkAnalyticsService.getAnalytics());
      setErrors(productionErrorHandler.getErrors(undefined, true));
      setTopPeers(networkAnalyticsService.getTopPerformingPeers(5));
    };

    updateData();
    const interval = setInterval(updateData, 5000);

    // Subscribe to real-time network analytics
    const unsubscribe = networkAnalyticsService.subscribeToRealTimeAnalytics(setNetworkAnalytics);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [isVisible]);

  const handleExportLogs = () => {
    const errorLogs = productionErrorHandler.exportErrorLogs();
    const messageExport = messagePersistenceService.exportMessages();
    const analyticsExport = networkAnalyticsService.exportAnalytics();
    
    const fullExport = {
      timestamp: new Date().toISOString(),
      errorLogs: JSON.parse(errorLogs),
      messages: JSON.parse(messageExport),
      analytics: JSON.parse(analyticsExport)
    };
    
    const blob = new Blob([JSON.stringify(fullExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mesh-radio-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearData = () => {
    productionErrorHandler.clearResolvedErrors();
    networkAnalyticsService.clearAnalytics(24); // Clear data older than 24 hours
    // Don't clear messages as they might be important
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Production Dashboard
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportLogs}
              className="text-green-400 border-green-400 hover:bg-green-400/10"
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearData}
              className="text-yellow-400 border-yellow-400 hover:bg-yellow-400/10"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-gray-400 border-gray-400 hover:bg-gray-400/10"
            >
              ×
            </Button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full mb-6 bg-gray-800">
              <TabsTrigger value="overview" className="text-gray-300">Overview</TabsTrigger>
              <TabsTrigger value="errors" className="text-gray-300">Errors</TabsTrigger>
              <TabsTrigger value="messages" className="text-gray-300">Messages</TabsTrigger>
              <TabsTrigger value="network" className="text-gray-300">Network</TabsTrigger>
              <TabsTrigger value="peers" className="text-gray-300">Peers</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {systemMetrics && (
                  <>
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          System Health
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                          {systemMetrics.successRate.toFixed(1)}%
                        </div>
                        <Progress 
                          value={systemMetrics.successRate} 
                          className="mt-2 h-2"
                        />
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Errors
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-400">
                          {systemMetrics.errorCount}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {errors.filter(e => !e.resolved).length} unresolved
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}

                {messageStats && (
                  <>
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Messages
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-400">
                          {messageStats.totalMessages}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {messageStats.pendingMessages} pending
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Delivery Rate
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                          {messageStats.totalMessages > 0 
                            ? ((messageStats.deliveredMessages / messageStats.totalMessages) * 100).toFixed(1)
                            : '0'
                          }%
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Avg: {messageStats.averageDeliveryTime.toFixed(0)}ms
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              {networkAnalytics && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <Wifi className="w-5 h-5" />
                      Network Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-400">Health</p>
                        <Badge 
                          variant={
                            networkAnalytics.networkHealth === 'excellent' ? 'default' :
                            networkAnalytics.networkHealth === 'good' ? 'secondary' :
                            networkAnalytics.networkHealth === 'fair' ? 'outline' : 'destructive'
                          }
                          className="mt-1"
                        >
                          {networkAnalytics.networkHealth}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Connections</p>
                        <p className="text-lg font-semibold text-blue-400">
                          {networkAnalytics.activeConnections}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Avg Latency</p>
                        <p className="text-lg font-semibold text-yellow-400">
                          {networkAnalytics.averageLatency.toFixed(0)}ms
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Success Rate</p>
                        <p className="text-lg font-semibold text-green-400">
                          {networkAnalytics.successRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="errors" className="space-y-4">
              {errors.length === 0 ? (
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-400">No unresolved errors</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {errors.slice(0, 10).map((error) => (
                    <Alert key={error.id} className="bg-gray-800 border-gray-700">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <div>
                            <Badge 
                              variant={
                                error.severity === 'critical' ? 'destructive' :
                                error.severity === 'high' ? 'outline' : 'secondary'
                              }
                              className="mr-2"
                            >
                              {error.type}
                            </Badge>
                            <span className="text-sm">{error.message}</span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(error.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="messages" className="space-y-4">
              {messageStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Message Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Messages:</span>
                        <span className="text-white">{messageStats.totalMessages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Delivered:</span>
                        <span className="text-green-400">{messageStats.deliveredMessages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Pending:</span>
                        <span className="text-yellow-400">{messageStats.pendingMessages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Failed:</span>
                        <span className="text-red-400">{messageStats.failedMessages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Storage Used:</span>
                        <span className="text-blue-400">
                          {(messageStats.storageUsed / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Performance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-400">Delivery Rate:</span>
                          <span className="text-green-400">
                            {messageStats.totalMessages > 0 
                              ? ((messageStats.deliveredMessages / messageStats.totalMessages) * 100).toFixed(1)
                              : '0'
                            }%
                          </span>
                        </div>
                        <Progress 
                          value={messageStats.totalMessages > 0 
                            ? (messageStats.deliveredMessages / messageStats.totalMessages) * 100
                            : 0
                          }
                          className="h-2"
                        />
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-400">Avg Delivery Time:</span>
                        <span className="text-blue-400">
                          {messageStats.averageDeliveryTime.toFixed(0)}ms
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="network" className="space-y-4">
              {networkAnalytics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Network Health</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Overall Health:</span>
                        <Badge 
                          variant={
                            networkAnalytics.networkHealth === 'excellent' ? 'default' :
                            networkAnalytics.networkHealth === 'good' ? 'secondary' :
                            networkAnalytics.networkHealth === 'fair' ? 'outline' : 'destructive'
                          }
                        >
                          {networkAnalytics.networkHealth}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Success Rate:</span>
                        <span className="text-green-400">{networkAnalytics.successRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Error Rate:</span>
                        <span className="text-red-400">{networkAnalytics.errorRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Avg Latency:</span>
                        <span className="text-yellow-400">{networkAnalytics.averageLatency.toFixed(0)}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Peak Bandwidth:</span>
                        <span className="text-blue-400">
                          {(networkAnalytics.peakBandwidth / 1000000).toFixed(1)} Mbps
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Transport Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {Object.entries(networkAnalytics.transportDistribution).map(([transport, count]) => (
                        <div key={transport} className="flex justify-between">
                          <span className="text-gray-400 capitalize">{transport}:</span>
                          <span className="text-blue-400">{count}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="peers" className="space-y-4">
              {topPeers.length === 0 ? (
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-400">No peer data available</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {topPeers.map((peer) => (
                    <Card key={peer.peerId} className="bg-gray-800 border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Users className="w-4 h-4 text-blue-400" />
                            <div>
                              <p className="font-medium text-white">
                                {peer.peerId.slice(-8)}
                              </p>
                              <p className="text-xs text-gray-400">
                                {peer.preferredTransport}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="text-center">
                              <p className="text-green-400">{peer.reliability.toFixed(0)}%</p>
                              <p className="text-xs text-gray-400">Reliability</p>
                            </div>
                            <div className="text-center">
                              <p className="text-yellow-400">{peer.averageLatency.toFixed(0)}ms</p>
                              <p className="text-xs text-gray-400">Latency</p>
                            </div>
                            <div className="text-center">
                              <p className="text-blue-400">{peer.averageSignalStrength.toFixed(0)}</p>
                              <p className="text-xs text-gray-400">Signal</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
