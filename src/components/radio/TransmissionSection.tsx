
import React from 'react';
import { EnhancedPTTButton } from './EnhancedPTTButton';

interface TransmissionSectionProps {
  onAudioData: (audioData: Blob, isEmergency?: boolean) => void;
  isEnabled: boolean;
  isTransmitting: boolean;
  volume: number;
  encryptionEnabled: boolean;
}

export const TransmissionSection: React.FC<TransmissionSectionProps> = ({
  onAudioData,
  isEnabled,
  isTransmitting,
  volume,
  encryptionEnabled
}) => {
  return (
    <div className="mb-3">
      <EnhancedPTTButton
        onAudioData={onAudioData}
        isEnabled={isEnabled}
        isTransmitting={isTransmitting}
        volume={volume}
        encryptionEnabled={encryptionEnabled}
      />
    </div>
  );
};
