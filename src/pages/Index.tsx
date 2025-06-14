
import React, { useState } from 'react';
import { Radio, Shield, Zap, Globe } from 'lucide-react';
import { WalkieTalkieRadio } from '@/components/WalkieTalkieRadio';

const Index = () => {
  const [isRadioOpen, setIsRadioOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23ffffff\" fill-opacity=\"0.03\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>

      <div className="relative z-10 text-center space-y-12 max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="relative">
              <Radio className="w-16 h-16 text-orange-400" />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-6xl font-bold text-white mb-2 tracking-tight">
              <span className="text-orange-400">ORAD</span>
              <span className="text-slate-300 text-2xl font-normal ml-4">by CEKA</span>
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Off-grid Resilient Audio Communication
            </p>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Professional-grade mesh networking for critical communications in any environment
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-black/20 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 text-center">
            <Shield className="w-8 h-8 text-green-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Military Grade</h3>
            <p className="text-slate-400 text-sm">Secure mesh networking with end-to-end encryption</p>
          </div>
          
          <div className="bg-black/20 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 text-center">
            <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Zero Infrastructure</h3>
            <p className="text-slate-400 text-sm">Works without towers, internet, or cellular networks</p>
          </div>
          
          <div className="bg-black/20 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 text-center">
            <Globe className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Auto-Routing</h3>
            <p className="text-slate-400 text-sm">Intelligent mesh routing finds the best path automatically</p>
          </div>
        </div>

        {/* Main CTA Button */}
        <div className="space-y-6">
          <button
            onClick={() => setIsRadioOpen(true)}
            className="group relative inline-flex items-center space-x-4 bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 hover:from-orange-400 hover:via-red-400 hover:to-orange-500 text-white px-12 py-6 rounded-2xl font-bold text-xl transition-all duration-500 shadow-2xl hover:shadow-orange-500/30 transform hover:scale-105 border border-orange-400/30"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-red-400/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <Radio className="w-8 h-8 relative z-10" />
            <span className="relative z-10">ACTIVATE RADIO</span>
            <div className="relative z-10 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          </button>
          
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Tap to initialize secure mesh communication network
          </p>
        </div>

        {/* Technical Specs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-orange-400">10KM+</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Range</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-green-400">256-bit</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Encryption</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-blue-400">∞</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Nodes</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-purple-400">24/7</div>
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
