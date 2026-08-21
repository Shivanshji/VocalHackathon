import React, { useState } from 'react';
import { TestimonialItem, PressLogo } from '../types';
import { Pause, Play } from 'lucide-react';

interface TestimonialsMarqueeProps {
  heading: {
    sectionTag: string;
    title: string;
    description: string;
  };
  pressLogos: PressLogo[];
  lane1: TestimonialItem[];
  lane2: TestimonialItem[];
}

export const TestimonialsMarquee: React.FC<TestimonialsMarqueeProps> = ({
  heading,
  pressLogos,
  lane1,
  lane2,
}) => {
  const [isPaused, setIsPaused] = useState(false);

  // Duplicate items for continuous seamless loop
  const duplicatedLane1 = [...lane1, ...lane1, ...lane1, ...lane1];
  const duplicatedLane2 = [...lane2, ...lane2, ...lane2, ...lane2];

  return (
    <section 
      id="testimonials"
      className="relative py-24 sm:py-32 border-t border-white/[0.08] bg-black overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10 mb-12 text-center">
        
        {/* Section Header matching Reference Image 2: "Don't just take our word for it" */}
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="text-xs font-mono uppercase tracking-widest text-zinc-500">
            // {heading.sectionTag}
          </div>

          <h2 
            id="testimonials-section-title"
            className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white"
          >
            {heading.title}
          </h2>

          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed font-sans">
            {heading.description}
          </p>
        </div>

        {/* Press / Partner Ticker matching Reference Image 2 (Gizmodo, Forbes, Washington Post, etc.) */}
        <div className="mt-12 pt-8 pb-4 border-t border-b border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-center flex-wrap gap-8 sm:gap-14 md:gap-20 opacity-40 hover:opacity-80 transition-opacity">
            {pressLogos.map((logo, idx) => (
              <span 
                key={`${logo.id}-${idx}`}
                className="text-sm sm:text-base md:text-lg font-heading tracking-widest uppercase font-semibold text-zinc-300 select-none hover:text-white transition-colors cursor-default"
              >
                {logo.name}
              </span>
            ))}
          </div>
        </div>

        {/* Pause / Play micro-controller */}
          <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono text-zinc-400 hover:text-white bg-zinc-900 border border-white/10 rounded-full transition-colors"
          >
            {isPaused ? <Play className="w-3 h-3 text-white" /> : <Pause className="w-3 h-3 text-zinc-400" />}
            <span>{isPaused ? 'Resume' : 'Pause Carousel'}</span>
          </button>
        </div>

      </div>

      {/* =========================================================================
          DUAL-LANE CONTINUOUS MOVING MARQUEE (Reference Image 2 & 3)
          Lane 1: Moves Left-to-Right / Right-to-Left
          Lane 2: Moves in opposite direction
          Hover: Pauses animation & lifts card with crisp monochrome luxury border
         ========================================================================= */}
      <div 
        id="testimonials-lanes-container"
        className={`relative w-full space-y-6 overflow-hidden marquee-pause ${
          isPaused ? '[&_*]:!animate-none' : ''
        }`}
      >
        {/* Left & Right Edge Fade Gradients */}
        <div className="absolute top-0 bottom-0 left-0 w-16 sm:w-32 bg-gradient-to-r from-black to-transparent z-20 pointer-events-none" />
        <div className="absolute top-0 bottom-0 right-0 w-16 sm:w-32 bg-gradient-to-l from-black to-transparent z-20 pointer-events-none" />

        {/* TOP LANE: Moving Left */}
        <div className="flex gap-6 w-max animate-marquee-left">
          {duplicatedLane1.map((item, idx) => (
            <TestimonialCard key={`lane1-${item.id}-${idx}`} item={item} />
          ))}
        </div>

        {/* BOTTOM LANE: Moving Right (Opposite direction) */}
        <div className="flex gap-6 w-max animate-marquee-right">
          {duplicatedLane2.map((item, idx) => (
            <TestimonialCard key={`lane2-${item.id}-${idx}`} item={item} />
          ))}
        </div>

      </div>
    </section>
  );
};

// Sub-component for individual testimonial card with micro-interactions
const TestimonialCard: React.FC<{ item: TestimonialItem }> = ({ item }) => {
  return (
    <div 
      className="w-[320px] sm:w-[380px] p-6 rounded-2xl bg-[#080808] border border-white/[0.08] hover:border-white/25 hover:bg-[#0e0e0e] transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between group cursor-pointer"
    >
      {/* Testimonial Quote */}
      <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed mb-6 font-sans">
        "{item.content}"
      </p>

      {/* User Info Bar (Matching Reference Image 2) */}
      <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3">
          <img 
            src={item.avatar} 
            alt={item.name}
            className="w-10 h-10 rounded-full object-cover border border-white/10 group-hover:border-white/30 transition-colors grayscale"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          <div className="text-left">
            <div className="text-xs sm:text-sm font-semibold text-white">
              {item.name}
            </div>
            <div className="text-[11px] text-zinc-500 font-sans">
              {item.role}
            </div>
          </div>
        </div>

        {/* X / Twitter Platform Icon */}
        <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
          <svg className="w-3.5 h-3.5 fill-currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </div>
      </div>
    </div>
  );
};
