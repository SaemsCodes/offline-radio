
import React from 'react';

interface StatusDisplayProps {
  isPoweredOn: boolean;
  audioMetrics?: {
    quality: string;
  };
  messages: any[];
  audioError?: string | null;
  onClearAudioError?: () => void;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({
  isPoweredOn,
  audioMetrics,
  messages,
  audioError,
  onClearAudioError
}) => {
  if (!isPoweredOn && !audioError) return null;

  return (
    <div className="space-y-2">
      {/* Audio Error Display */}
      {audioError && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-2">
          <div className="flex items-center justify-between">
            <span className="text-red-400 text-xs font-mono">{audioError}</span>
            {onClearAudioError && (
              <button
                onClick={onClearAudioError}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status Information */}
      {isPoweredOn && (
        <div className="space-y-2">
          {audioMetrics && (
            <div className="bg-black/50 rounded-lg p-2 border border-gray-700">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-gray-400">AUDIO:</span>
                <span className={`font-bold ${
                  audioMetrics.quality === 'excellent' ? 'text-green-400' :
                  audioMetrics.quality === 'good' ? 'text-yellow-400' :
                  audioMetrics.quality === 'fair' ? 'text-orange-400' : 'text-red-400'
                }`}>
                  {audioMetrics.quality.toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div className="bg-black/50 rounded-lg p-2 border border-gray-700">
              <div className="text-xs text-green-400 font-mono">
                LAST RX: {messages[messages.length - 1]?.payload?.content || 'Signal received'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
