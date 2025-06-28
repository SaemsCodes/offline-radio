
import React from 'react';
import { AuthenticRadioUI } from './radio/AuthenticRadioUI';

interface WalkieTalkieRadioProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalkieTalkieRadio: React.FC<WalkieTalkieRadioProps> = ({ isOpen, onClose }) => {
  return <AuthenticRadioUI isOpen={isOpen} onClose={onClose} />;
};
