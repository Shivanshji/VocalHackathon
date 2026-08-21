import React, { useState } from 'react';
import { FeatureCard } from '../types';
import { 
  Cpu, 
  Network, 
  Layers, 
  Zap, 
  ShieldCheck, 
  Bot, 
  Code2, 
  ArrowRight
} from 'lucide-react';

interface FeaturesSectionProps {
  heading: {
    sectionTag: string;
    title: string;
    description: string;
  };
  features: FeatureCard[];
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({
  heading,
  features,
}) => {
  const [activeTab, setActiveTab] = useState<Record<string, 'overview' | 'code'>>({
    'feature-1': 'overview',
    'feature-2': 'overview',
    'feature-3': 'overview',
  });

  const getIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'cpu':
        return <Cpu className="w-5 h-5" />;
      case 'network':
        return <Network className="w-5 h-5" />;
      case 'layers':
        return <Layers className="w-5 h-5" />;
      case 'shield':
      case 'shieldcheck':
        return <ShieldCheck className="w-5 h-5" />;
      case 'bot':
        return <Bot className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  const toggleTab = (cardId: string, tab: 'overview' | 'code') => {
    setActiveTab((prev) => ({ ...prev, [cardId]: tab }));
  };

  return (
    <section 
      id="features"
      className="relative py-24 sm:py-32 border-t border-white/[0.08] bg-black"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="space-y-3 max-w-2xl text-left">
            <div className="text-xs font-mono uppercase tracking-widest text-zinc-500">
              // {heading.sectionTag}
            </div>
            <h2 
              id="features-section-title"
              className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white"
            >
              {heading.title}
            </h2>
            <p className="text-zinc-400 text-base sm:text-lg leading-relaxed font-sans">
              {heading.description}
            </p>
          </div>


        </div>

        {/* 3 Value / Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, idx) => {
            const currentTab = activeTab[feature.id] || 'overview';

            return (
              <div
                key={feature.id}
                id={`feature-card-${idx + 1}`}
                className="luxury-card rounded-2xl p-7 sm:p-8 flex flex-col justify-between"
              >
                <div>
                  {/* Card Top Row: Number & Icon */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-xs text-zinc-500 tracking-wider">
                      [{feature.number}] {feature.tag}
                    </span>

                    <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center text-white">
                      {getIcon(feature.iconName)}
                    </div>
                  </div>

                  {/* Feature Title */}
                  <h3 className="font-heading text-xl sm:text-2xl font-bold text-white mb-3">
                    {feature.title}
                  </h3>

                  {/* Tab switchers: Overview vs Code Snippet */}
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => toggleTab(feature.id, 'overview')}
                      className={`text-[11px] font-mono px-2.5 py-1 rounded transition-colors ${
                        currentTab === 'overview'
                          ? 'bg-white text-black font-semibold'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Overview
                    </button>
                    {feature.codeSnippet && (
                      <button
                        onClick={() => toggleTab(feature.id, 'code')}
                        className={`text-[11px] font-mono px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                          currentTab === 'code'
                            ? 'bg-white text-black font-semibold'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Code2 className="w-3 h-3" />
                        <span>Code</span>
                      </button>
                    )}
                  </div>

                  {/* Content View */}
                  {currentTab === 'overview' ? (
                    <p className="text-zinc-400 text-sm leading-relaxed mb-6 font-sans">
                      {feature.description}
                    </p>
                  ) : (
                    <div className="p-3 mb-6 rounded-lg bg-zinc-950 border border-white/10 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                      <pre className="whitespace-pre">{feature.codeSnippet}</pre>
                    </div>
                  )}
                </div>

                {/* Card Footer: Metric highlight & Action Link */}
                <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between mt-auto">
                  <span className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    {feature.metricHighlight || 'Verified Architecture'}
                  </span>

                  <a
                    href="#tryit"
                    className="text-xs font-mono text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <span>Try It</span>
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
