import React, { useState } from 'react';
import { defaultLandingContent } from './content';
import { LandingContent } from './types';
import { BackgroundEffects } from './components/BackgroundEffects';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { FeaturesSection } from './components/FeaturesSection';
import { TryItSection } from './components/TryItSection';
import { TestimonialsMarquee } from './components/TestimonialsMarquee';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';
import Person2Pipeline from './Person2Pipeline';

export default function App() {
  if (window.location.pathname === '/person2-test') return <Person2Pipeline />;
  const [content] = useState<LandingContent>(defaultLandingContent);

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-white selection:text-black font-sans overflow-x-hidden">
      {/* Clean Minimal Background */}
      <BackgroundEffects />

      {/* Main Navigation Bar */}
      <Navbar
        brandName={content.brandName}
        navLinks={content.navLinks}
      />

      {/* Primary Landing Page Flow */}
      <main className="relative z-10">

        {/* 1. HERO */}
        <HeroSection
          badgePillText={content.hero.badgePillText}
          badgePillLinkText={content.hero.badgePillLinkText}
          headline={content.hero.headline}
          headlineHighlight={content.hero.headlineHighlight}
          description={content.hero.description}
          primaryCtaText={content.hero.primaryCtaText}
          secondaryCtaText={content.hero.secondaryCtaText}
        />

        {/* 2. HOW IT WORKS — Features */}
        <FeaturesSection
          heading={content.featuresHeading}
          features={content.features}
        />

        {/* 3. TRY IT — Interactive Demo */}
        <TryItSection />

        {/* 4. TESTIMONIALS */}
        <TestimonialsMarquee
          heading={content.testimonialsHeading}
          pressLogos={content.pressLogos}
          lane1={content.testimonialsLane1}
          lane2={content.testimonialsLane2}
        />

        {/* 5. FINAL CTA */}
        <FinalCTA
          data={content.finalCta}
        />

      </main>

      {/* Footer */}
      <Footer
        brandName={content.brandName}
        copyright={content.footer.copyright}
        links={content.footer.links}
      />
    </div>
  );
}
