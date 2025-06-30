
import React, { useState, useEffect } from 'react';
import { Radio, Shield, Zap, Globe } from 'lucide-react';
import { WalkieTalkieRadio } from '@/components/WalkieTalkieRadio';

const Index = () => {
  const [isRadioOpen, setIsRadioOpen] = useState(false);
  const [currentBackground, setCurrentBackground] = useState(0);

  const backgrounds = [
    {
      name: 'Desert Operations',
      image: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=2070',
      gradient: 'from-amber-900/40 via-orange-800/60 to-red-900/40'
    },
    {
      name: 'Jungle Mission',
      image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2070',
      gradient: 'from-green-900/50 via-emerald-800/60 to-teal-900/40'
    },
    {
      name: 'Arctic Patrol',
      image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=2070',
      gradient: 'from-slate-900/60 via-blue-800/50 to-cyan-900/40'
    },
    {
      name: 'Urban Combat',
      image: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=2070',
      gradient: 'from-gray-900/70 via-slate-800/60 to-zinc-900/50'
    },
    {
      name: 'Mountain Recon',
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070',
      gradient: 'from-stone-900/50 via-gray-800/60 to-slate-900/40'
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBackground((prev) => (prev + 1) % backgrounds.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const currentBg = backgrounds[currentBackground];

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Dynamic Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-2000 ease-in-out"
        style={{ backgroundImage: `url(${currentBg.image})` }}
      />
      <div className={`absolute inset-0 bg-gradient-to-br ${currentBg.gradient} transition-all duration-2000`} />
      
      {/* Tactical Grid Pattern */}
      <div className="absolute inset-0 tactical-grid opacity-10"></div>

      <div className="relative z-10 text-center space-y-8 max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <div className="relative">
              <Radio className="w-12 h-12 text-orange-400" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
              <span className="text-orange-400">ORAD</span>
              <span className="text-slate-300 text-lg font-normal ml-3">by CEKA</span>
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Off-grid Resilient Audio Communication
            </p>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              {currentBg.name} • Professional-grade mesh networking
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-black/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 text-center">
            <Shield className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <h3 className="text-white font-semibold mb-1 text-sm">Military Grade</h3>
            <p className="text-slate-400 text-xs">Secure mesh networking</p>
          </div>
          
          <div className="bg-black/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 text-center">
            <Zap className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <h3 className="text-white font-semibold mb-1 text-sm">Zero Infrastructure</h3>
            <p className="text-slate-400 text-xs">Works without towers</p>
          </div>
          
          <div className="bg-black/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 text-center">
            <Globe className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <h3 className="text-white font-semibold mb-1 text-sm">Auto-Routing</h3>
            <p className="text-slate-400 text-xs">Intelligent mesh routing</p>
          </div>
        </div>

        {/* Main CTA Button */}
        <div className="space-y-4">
          <button
            onClick={() => setIsRadioOpen(true)}
            className="group relative inline-flex items-center space-x-3 bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 hover:from-orange-400 hover:via-red-400 hover:to-orange-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all duration-500 shadow-2xl hover:shadow-orange-500/30 transform hover:scale-105 border border-orange-400/30"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-red-400/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <Radio className="w-6 h-6 relative z-10" />
            <span className="relative z-10">ACTIVATE RADIO</span>
            <div className="relative z-10 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </button>
          
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Tap to initialize secure mesh communication network
          </p>
        </div>

        {/* Technical Specs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="space-y-1">
            <div className="text-lg font-bold text-orange-400">10KM+</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Range</div>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-green-400">256-bit</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Encryption</div>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-blue-400">∞</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Nodes</div>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-purple-400">24/7</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Uptime</div>
          </div>
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
