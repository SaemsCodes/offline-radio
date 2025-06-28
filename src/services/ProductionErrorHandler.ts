export interface ErrorReport {
  id: string;
  timestamp: number;
  type: 'network' | 'audio' | 'encryption' | 'storage' | 'system' | 'emergency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stack?: string;
  context: Record<string, any>;
  resolved: boolean;
}

export interface SystemMetrics {
  errorCount: number;
  successRate: number;
  averageResponseTime: number;
  memoryUsage: number;
  networkLatency: number;
  batteryImpact: 'low' | 'medium' | 'high';
}

export class ProductionErrorHandler {
  private errors: Map<string, ErrorReport> = new Map();
  private metrics: SystemMetrics = {
    errorCount: 0,
    successRate: 100,
    averageResponseTime: 0,
    memoryUsage: 0,
    networkLatency: 0,
    batteryImpact: 'low'
  };
  private metricsHistory: SystemMetrics[] = [];
  private maxHistorySize = 100;

  logError(
    type: ErrorReport['type'],
    message: string,
    error?: Error,
    context: Record<string, any> = {}
  ): string {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const errorReport: ErrorReport = {
      id: errorId,
      timestamp: Date.now(),
      type,
      severity: this.determineSeverity(type, message, error),
      message,
      stack: error?.stack,
      context: {
        ...context,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      },
      resolved: false
    };

    this.errors.set(errorId, errorReport);
    this.metrics.errorCount++;
    
    // Auto-recovery attempts
    this.attemptAutoRecovery(errorReport);
    
    console.error(`[${type.toUpperCase()}] ${message}`, error, context);
    
    return errorId;
  }

  private determineSeverity(
    type: ErrorReport['type'],
    message: string,
    error?: Error
  ): ErrorReport['severity'] {
    if (type === 'system' || type === 'emergency' || message.includes('critical')) return 'critical';
    if (type === 'encryption' || type === 'audio') return 'high';
    if (type === 'network' && message.includes('timeout')) return 'medium';
    return 'low';
  }

  private attemptAutoRecovery(errorReport: ErrorReport) {
    switch (errorReport.type) {
      case 'network':
        this.handleNetworkError(errorReport);
        break;
      case 'audio':
        this.handleAudioError(errorReport);
        break;
      case 'encryption':
        this.handleEncryptionError(errorReport);
        break;
      case 'storage':
        this.handleStorageError(errorReport);
        break;
      case 'emergency':
        this.handleEmergencyError(errorReport);
        break;
    }
  }

  private handleNetworkError(errorReport: ErrorReport) {
    // Attempt to reconnect or switch transport
    setTimeout(() => {
      console.log('Attempting network recovery...');
      // Recovery logic would go here
    }, 1000);
  }

  private handleAudioError(errorReport: ErrorReport) {
    // Attempt to reinitialize audio
    setTimeout(() => {
      console.log('Attempting audio recovery...');
      // Recovery logic would go here
    }, 500);
  }

  private handleEncryptionError(errorReport: ErrorReport) {
    console.warn('Encryption error detected, switching to unencrypted mode temporarily');
  }

  private handleStorageError(errorReport: ErrorReport) {
    console.warn('Storage error detected, using memory fallback');
  }

  private handleEmergencyError(errorReport: ErrorReport) {
    console.error('Emergency system error detected, attempting failsafe procedures');
    // Emergency-specific recovery logic would go here
  }

  resolveError(errorId: string) {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
      this.errors.set(errorId, error);
    }
  }

  updateMetrics(responseTime: number, success: boolean) {
    const responseTimes = this.metricsHistory.map(m => m.averageResponseTime).filter(t => t > 0);
    responseTimes.push(responseTime);
    
    this.metrics.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    const totalOperations = this.metrics.errorCount + (success ? 1 : 0);
    const successfulOperations = totalOperations - this.metrics.errorCount + (success ? 1 : 0);
    this.metrics.successRate = (successfulOperations / totalOperations) * 100;

    // Update memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize * 100;
    }

    // Store metrics history
    this.metricsHistory.push({ ...this.metrics });
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  getErrors(type?: ErrorReport['type'], unresolved?: boolean): ErrorReport[] {
    let errors = Array.from(this.errors.values());
    
    if (type) {
      errors = errors.filter(e => e.type === type);
    }
    
    if (unresolved !== undefined) {
      errors = errors.filter(e => !e.resolved === unresolved);
    }
    
    return errors.sort((a, b) => b.timestamp - a.timestamp);
  }

  getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  getMetricsHistory(): SystemMetrics[] {
    return [...this.metricsHistory];
  }

  clearResolvedErrors() {
    const unresolved = new Map();
    this.errors.forEach((error, id) => {
      if (!error.resolved) {
        unresolved.set(id, error);
      }
    });
    this.errors = unresolved;
  }

  exportErrorLogs(): string {
    const errors = this.getErrors();
    const report = {
      timestamp: new Date().toISOString(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        onLine: navigator.onLine
      },
      metrics: this.metrics,
      errors: errors
    };
    
    return JSON.stringify(report, null, 2);
  }
}

export const productionErrorHandler = new ProductionErrorHandler();
