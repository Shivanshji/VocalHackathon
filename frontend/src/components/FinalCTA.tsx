import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface FinalCTAProps {
  data: {
    badgeText: string;
    headline: string;
    description: string;
    primaryCtaText: string;
    secondaryCtaText: string;
    footnote: string;
  };
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ data }) => {
  return (
    <section 
      id="cta"
      className="relative py-24 sm:py-32 border-t border-white/[0.08] bg-black overflow-hidden"
    >
      <div className="max-w-5xl mx-auto px-6 sm:px-8 relative z-10">
        
        <div className="relative rounded-3xl p-8 sm:p-14 lg:p-16 bg-[#080808] border border-white/[0.08] overflow-hidden text-center">
          
          <div className="relative z-10 space-y-6 max-w-3xl mx-auto">
            
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 text-xs font-mono tracking-widest uppercase">
              <span>{data.badgeText}</span>
            </div>

            {/* Final Value Proposition Headline */}
            <h2 
              id="final-cta-headline"
              className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1]"
            >
              {data.headline}
            </h2>

            {/* Short CTA Description */}
            <p 
              id="final-cta-description"
              className="text-zinc-400 text-base sm:text-lg leading-relaxed font-sans max-w-2xl mx-auto"
            >
              {data.description}
            </p>

            {/* Buttons Group */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              
              {/* Primary High-Contrast Pill CTA */}
              <a
                href="#hero"
                id="final-primary-cta-btn"
                className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white hover:bg-zinc-200 text-black font-bold text-sm sm:text-base tracking-tight transition-all duration-150 group"
              >
                <span>{data.primaryCtaText}</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>

              {/* Secondary CTA → API Docs */}
              <a
                href="#"
                id="final-secondary-cta-btn"
                className="inline-flex items-center gap-2 px-6 py-4 rounded-full text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-sm font-mono transition-all duration-150"
              >
                <span>{data.secondaryCtaText}</span>
              </a>
            </div>

            {/* Footnote */}
            <p className="text-xs font-mono text-zinc-500 pt-4">
              {data.footnote}
            </p>

          </div>

        </div>

      </div>
    </section>
  );
};
