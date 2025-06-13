
import React, { useState } from 'react';
import { Radio } from 'lucide-react';
import { WalkieTalkieRadio } from '@/components/WalkieTalkieRadio';

const Index = () => {
  const [isRadioOpen, setIsRadioOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-white mb-2">
            Mesh Talk Radio
          </h1>
          <p className="text-xl text-slate-300 max-w-md mx-auto">
            Professional peer-to-peer communication system for any terrain
          </p>
        </div>

        <button
          onClick={() => setIsRadioOpen(true)}
          className="inline-flex items-center space-x-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <Radio className="w-6 h-6" />
          <span>Open Radio</span>
        </button>

        <div className="text-sm text-slate-400 max-w-lg mx-auto">
          <p>
            Military-grade mesh networking technology for reliable communication
            in remote areas, emergency situations, and extreme conditions.
          </p>
        </div>
      </div>

      <WalkieTalkieRadio 
        isOpen={isRadioOpen}
        onClose={() => setIsRadioOpen(false)}
      />
    </div>
  );
};

export default Index;
