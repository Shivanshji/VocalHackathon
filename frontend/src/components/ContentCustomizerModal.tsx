import React, { useState } from 'react';
import { LandingContent } from '../types';
import { samplePresets } from '../content';
import { 
  X, 
  Copy, 
  Check, 
  RotateCcw, 
  LayoutTemplate, 
  Type, 
  Layers, 
  MessageSquare,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface ContentCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: LandingContent;
  onUpdateContent: (updated: LandingContent) => void;
  onReset: () => void;
}

export const ContentCustomizerModal: React.FC<ContentCustomizerModalProps> = ({
  isOpen,
  onClose,
  content,
  onUpdateContent,
  onReset,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'hero' | 'features' | 'testimonials' | 'cta'>('presets');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleApplyPreset = (presetKey: string) => {
    const preset = samplePresets[presetKey];
    if (preset) {
      onUpdateContent({
        ...content,
        ...preset.data,
        hero: { ...content.hero, ...(preset.data.hero || {}) },
        featuresHeading: { ...content.featuresHeading, ...(preset.data.featuresHeading || {}) },
      });
    }
  };

  const copyAsJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(content, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      id="customizer-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div 
        id="customizer-modal-content"
        className="relative w-full max-w-3xl max-h-[85vh] bg-zinc-950 border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
          <div>
            <h3 className="font-heading text-base font-bold text-white flex items-center gap-2">
              Content & Placeholder Editor
            </h3>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              Live in-place editing for tomorrow's AI hackathon presentation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyAsJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-white bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-lg transition-colors"
              title="Copy landingData JSON configuration"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
            </button>

            <button
              onClick={onReset}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Reset to Universal Defaults"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-5 border-b border-white/10 flex gap-2 bg-black overflow-x-auto">
          {[
            { id: 'presets', label: '1-Click Presets', icon: LayoutTemplate },
            { id: 'hero', label: 'Hero Placeholders', icon: Type },
            { id: 'features', label: '3 Feature Cards', icon: Layers },
            { id: 'testimonials', label: 'Testimonials', icon: MessageSquare },
            { id: 'cta', label: 'Final CTA', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-mono border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-white text-white font-semibold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left font-sans text-sm text-zinc-300">
          
          {/* TAB: PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <div className="text-xs text-zinc-400 font-mono">
                Click any AI domain preset to populate realistic, ready-to-present copy:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(samplePresets).map(([key, preset]) => (
                  <div
                    key={key}
                    onClick={() => handleApplyPreset(key)}
                    className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 hover:border-white/30 hover:bg-zinc-900 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-heading font-bold text-white text-sm">
                        {preset.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-1 group-hover:text-white transition-all" />
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      {preset.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: HERO */}
          {activeTab === 'hero' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-400">Brand Name</label>
                <input
                  type="text"
                  value={content.brandName}
                  onChange={(e) => onUpdateContent({ ...content, brandName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-400">Pill Badge Left</label>
                  <input
                    type="text"
                    value={content.hero.badgePillText}
                    onChange={(e) =>
                      onUpdateContent({
                        ...content,
                        hero: { ...content.hero, badgePillText: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-400">Pill Badge Right</label>
                  <input
                    type="text"
                    value={content.hero.badgePillLinkText}
                    onChange={(e) =>
                      onUpdateContent({
                        ...content,
                        hero: { ...content.hero, badgePillLinkText: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-400">Main Headline</label>
                <input
                  type="text"
                  value={content.hero.headline}
                  onChange={(e) =>
                    onUpdateContent({
                      ...content,
                      hero: { ...content.hero, headline: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-400">Headline Highlight</label>
                <input
                  type="text"
                  value={content.hero.headlineHighlight}
                  onChange={(e) =>
                    onUpdateContent({
                      ...content,
                      hero: { ...content.hero, headlineHighlight: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-400">Description</label>
                <textarea
                  rows={3}
                  value={content.hero.description}
                  onChange={(e) =>
                    onUpdateContent({
                      ...content,
                      hero: { ...content.hero, description: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-400">Primary CTA Text</label>
                  <input
                    type="text"
                    value={content.hero.primaryCtaText}
                    onChange={(e) =>
                      onUpdateContent({
                        ...content,
                        hero: { ...content.hero, primaryCtaText: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-400">Secondary CTA Text</label>
                  <input
                    type="text"
                    value={content.hero.secondaryCtaText}
                    onChange={(e) =>
                      onUpdateContent({
                        ...content,
                        hero: { ...content.hero, secondaryCtaText: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: FEATURES */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-400">Section Title</label>
                  <input
                    type="text"
                    value={content.featuresHeading.title}
                    onChange={(e) =>
                      onUpdateContent({
                        ...content,
                        featuresHeading: { ...content.featuresHeading, title: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-400">Section Subtitle</label>
                  <input
                    type="text"
                    value={content.featuresHeading.description}
                    onChange={(e) =>
                      onUpdateContent({
                        ...content,
                        featuresHeading: { ...content.featuresHeading, description: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                  />
                </div>
              </div>

              {content.features.map((feat, idx) => (
                <div key={feat.id} className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-3">
                  <div className="text-xs font-mono text-zinc-400 font-bold">
                    Feature #{idx + 1} ({feat.number})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-mono text-zinc-400">Title</label>
                      <input
                        type="text"
                        value={feat.title}
                        onChange={(e) => {
                          const updated = [...content.features];
                          updated[idx].title = e.target.value;
                          onUpdateContent({ ...content, features: updated });
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-white/10 text-white text-xs focus:border-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-zinc-400">Highlight Metric</label>
                      <input
                        type="text"
                        value={feat.metricHighlight || ''}
                        onChange={(e) => {
                          const updated = [...content.features];
                          updated[idx].metricHighlight = e.target.value;
                          onUpdateContent({ ...content, features: updated });
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-white/10 text-white text-xs focus:border-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400">Description</label>
                    <textarea
                      rows={2}
                      value={feat.description}
                      onChange={(e) => {
                        const updated = [...content.features];
                        updated[idx].description = e.target.value;
                        onUpdateContent({ ...content, features: updated });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-white/10 text-white text-xs focus:border-white focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: TESTIMONIALS */}
          {activeTab === 'testimonials' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-400">Title</label>
                <input
                  type="text"
                  value={content.testimonialsHeading.title}
                  onChange={(e) =>
                    onUpdateContent({
                      ...content,
                      testimonialsHeading: { ...content.testimonialsHeading, title: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-400">Description</label>
                <input
                  type="text"
                  value={content.testimonialsHeading.description}
                  onChange={(e) =>
                    onUpdateContent({
                      ...content,
                      testimonialsHeading: { ...content.testimonialsHeading, description: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB: CTA */}
          {activeTab === 'cta' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-400">Final Headline</label>
                <input
                  type="text"
                  value={content.finalCta.headline}
                  onChange={(e) =>
                    onUpdateContent({
                      ...content,
                      finalCta: { ...content.finalCta, headline: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-400">Description</label>
                <textarea
                  rows={2}
                  value={content.finalCta.description}
                  onChange={(e) =>
                    onUpdateContent({
                      ...content,
                      finalCta: { ...content.finalCta, description: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-400">Primary CTA Text</label>
                  <input
                    type="text"
                    value={content.finalCta.primaryCtaText}
                    onChange={(e) =>
                      onUpdateContent({
                        ...content,
                        finalCta: { ...content.finalCta, primaryCtaText: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-400">Secondary CTA Text</label>
                  <input
                    type="text"
                    value={content.finalCta.secondaryCtaText}
                    onChange={(e) =>
                      onUpdateContent({
                        ...content,
                        finalCta: { ...content.finalCta, secondaryCtaText: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm focus:border-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-zinc-900/60 flex items-center justify-between">
          <span className="text-xs font-mono text-zinc-500">
            Press ESC or click Outside to close
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors"
          >
            Apply & Close
          </button>
        </div>

      </div>
    </div>
  );
};
