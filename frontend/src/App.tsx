import React, { useState, useEffect } from 'react';
import { defaultLandingContent } from './content';
import { LandingContent } from './types';
import { BackgroundEffects } from './components/BackgroundEffects';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { FeaturesSection } from './components/FeaturesSection';
import { TestimonialsMarquee } from './components/TestimonialsMarquee';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';
import { ContentCustomizerModal } from './components/ContentCustomizerModal';
import { Sliders } from 'lucide-react';

export default function App() {
  const [content, setContent] = useState<LandingContent>(defaultLandingContent);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  // Keyboard shortcut: Cmd+E or Ctrl+E to open customizer, Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsCustomizerOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isCustomizerOpen) {
        setIsCustomizerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCustomizerOpen]);

  const handleReset = () => {
    setContent(defaultLandingContent);
  };

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-white selection:text-black font-sans overflow-x-hidden">
      {/* 
        Clean Minimal Background
      */}
      <BackgroundEffects />

      {/* Main Navigation Bar */}
      <Navbar
        brandName={content.brandName}
        navLinks={content.navLinks}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
      />

      {/* Primary Landing Page Flow */}
      <main className="relative z-10">
        
        {/* 1. HERO SECTION (Left: Value Prop & Primary CTA, Right: Empty Space for 3D Robot Model) */}
        <HeroSection
          badgePillText={content.hero.badgePillText}
          badgePillLinkText={content.hero.badgePillLinkText}
          headline={content.hero.headline}
          headlineHighlight={content.hero.headlineHighlight}
          description={content.hero.description}
          primaryCtaText={content.hero.primaryCtaText}
          secondaryCtaText={content.hero.secondaryCtaText}
          onOpenCustomizer={() => setIsCustomizerOpen(true)}
        />

        {/* 2. VALUE PROPOSITION IN DETAIL (Features 01, 02, 03) */}
        <FeaturesSection
          heading={content.featuresHeading}
          features={content.features}
          onOpenCustomizer={() => setIsCustomizerOpen(true)}
        />

        {/* 3. TESTIMONIAL / TRUST SECTION (Dual-Lane Moving Marquee + Press Logotypes) */}
        <TestimonialsMarquee
          heading={content.testimonialsHeading}
          pressLogos={content.pressLogos}
          lane1={content.testimonialsLane1}
          lane2={content.testimonialsLane2}
          onOpenCustomizer={() => setIsCustomizerOpen(true)}
        />

        {/* 4. FINAL CALL TO ACTION */}
        <FinalCTA
          data={content.finalCta}
          onOpenCustomizer={() => setIsCustomizerOpen(true)}
        />

      </main>

      {/* Footer */}
      <Footer
        brandName={content.brandName}
        copyright={content.footer.copyright}
        links={content.footer.links}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
      />

      {/* Floating Quick-Customize Badge (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsCustomizerOpen(true)}
          className="group flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-950/90 hover:bg-zinc-900 border border-white/15 hover:border-white/30 text-zinc-300 hover:text-white text-xs font-mono backdrop-blur-md transition-all duration-200"
          title="Open Placeholder Editor (Ctrl+E)"
        >
          <Sliders className="w-3.5 h-3.5 text-zinc-400 group-hover:rotate-90 transition-transform duration-200" />
          <span className="hidden sm:inline">Customize Content</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-sans border border-white/10">
            Ctrl+E
          </span>
        </button>
      </div>

      {/* In-Place Customizer Modal / Drawer */}
      <ContentCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        content={content}
        onUpdateContent={setContent}
        onReset={handleReset}
      />
    </div>
  );
}
