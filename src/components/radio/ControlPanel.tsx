
import React from 'react';
import { ChannelDisplay } from './ChannelDisplay';
import { ChannelSelector } from './ChannelSelector';
import { RadialDial } from './RadialDial';

interface ControlPanelProps {
  channel: number;
  volume: number;
  squelch: number;
  isPoweredOn: boolean;
  isReceiving: boolean;
  isTransmitting: boolean;
  encryptionEnabled: boolean;
  onChannelChange: (channel: number) => void;
  onVolumeChange: (volume: number) => void;
  onSquelchChange: (squelch: number) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  channel,
  volume,
  squelch,
  isPoweredOn,
  isReceiving,
  isTransmitting,
  encryptionEnabled,
  onChannelChange,
  onVolumeChange,
  onSquelchChange
}) => {
  return (
    <div className="space-y-4">
      {/* Channel Display */}
      <ChannelDisplay 
        channel={channel}
        isPoweredOn={isPoweredOn}
        isReceiving={isReceiving}
        isTransmitting={isTransmitting}
      />

      {/* Channel Selector and Control Dials */}
      <div className="grid grid-cols-4 gap-2">
        <ChannelSelector
          currentChannel={channel}
          onChannelChange={onChannelChange}
          disabled={isPoweredOn}
        />
        <RadialDial
          value={volume}
          min={0}
          max={10}
          onChange={onVolumeChange}
          disabled={!isPoweredOn}
          label="VOL"
          color="green"
        />
        <RadialDial
          value={squelch}
          min={0}
          max={10}
          onChange={onSquelchChange}
          disabled={!isPoweredOn}
          label="SQL"
          color="blue"
        />
        <div className="flex flex-col items-center justify-center">
          <div className={`text-xs font-mono mb-1 ${isPoweredOn ? 'text-gray-300' : 'text-gray-500'}`}>
            MODE
          </div>
          <div className={`text-xs font-mono font-bold ${
            encryptionEnabled && isPoweredOn ? 'text-green-400' : 
            isPoweredOn ? 'text-white' : 'text-gray-500'
          }`}>
            {encryptionEnabled && isPoweredOn ? 'SEC' : 'CLR'}
          </div>
        </div>
      </div>
    </div>
  );
};
