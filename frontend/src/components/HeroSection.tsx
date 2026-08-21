import React from 'react';
import { ArrowUpRight, ArrowDown } from 'lucide-react';
import { RobotPlaceholderStage } from './RobotPlaceholderStage';

interface HeroSectionProps {
  badgePillText: string;
  badgePillLinkText: string;
  headline: string;
  headlineHighlight: string;
  description: string;
  primaryCtaText: string;
  secondaryCtaText: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  badgePillText,
  badgePillLinkText,
  headline,
  headlineHighlight,
  description,
  primaryCtaText,
  secondaryCtaText,
}) => {
  const scrollToFeatures = () => {
    const el = document.getElementById('features');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="hero"
      className="relative min-h-[85vh] lg:min-h-screen pt-28 pb-16 lg:pt-36 lg:pb-24 flex items-center justify-center overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

          {/* ── LEFT: Value Proposition ────────────────────────────────── */}
          <div className="lg:col-span-7 flex flex-col items-start text-left space-y-6 sm:space-y-8">

            {/* Badge Pill */}
            <div
              id="hero-badge-pill"
              className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-zinc-900/80 border border-white/10 group"
            >
              <span className="px-2 py-0.5 text-[11px] font-mono uppercase font-semibold text-black bg-white rounded-full">
                {badgePillText}
              </span>
              <span className="text-xs font-mono text-zinc-300">
                {badgePillLinkText}
              </span>
            </div>

            {/* Main Headline */}
            <h1
              id="hero-main-headline"
              className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-extrabold tracking-[-0.04em] leading-[1.05] text-white"
            >
              <span>{headline} </span>
              <br />
              <span className="text-zinc-400">
                {headlineHighlight}
              </span>
            </h1>

            {/* Description */}
            <p
              id="hero-description-text"
              className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed max-w-xl"
            >
              {description}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2 sm:pt-4 w-full sm:w-auto">

              {/* Primary CTA → TryIt section */}
              <a
                href="#tryit"
                id="hero-primary-cta"
                className="inline-flex items-center justify-between gap-4 pl-6 pr-2 py-2 rounded-full bg-white text-black hover:bg-zinc-200 font-semibold text-sm sm:text-base tracking-tight transition-all duration-150 group shadow-lg"
              >
                <span>{primaryCtaText}</span>
                <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center transition-all duration-150 group-hover:scale-105">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </a>

              {/* Secondary CTA → Features */}
              <a
                href="#features"
                id="hero-secondary-cta"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 hover:border-white/20 text-sm font-mono transition-all duration-150"
              >
                <span>{secondaryCtaText}</span>
              </a>
            </div>

            {/* Trust badges — SachMein? specific */}
            <div className="flex flex-wrap items-center gap-6 pt-4 text-xs text-zinc-500 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>12+ Indian Languages</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                <span>Real-Time Fact-Checking</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>50+ Verified Sources</span>
              </div>
            </div>

            {/* Color legend inline */}
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-zinc-600">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">● Verified</span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">● Exaggerated</span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">● False</span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-800 border border-white/10 text-zinc-500">● Checking</span>
            </div>

          </div>

          {/* ── RIGHT: 3D Model Stage ───────────────────────────────────── */}
          <div className="lg:col-span-5 flex items-center justify-center relative">
            <RobotPlaceholderStage />
          </div>

        </div>

        {/* Scroll Down indicator */}
        <div className="hidden sm:flex justify-end mt-6 lg:mt-10">
          <button
            onClick={scrollToFeatures}
            id="hero-scroll-down-btn"
            className="w-11 h-11 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-white/30 flex items-center justify-center text-zinc-400 hover:text-white transition-all duration-150"
            aria-label="Scroll to features"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

      </div>
    </section>
  );
};
