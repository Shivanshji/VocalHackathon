import React, { useState, useEffect } from 'react';
import { NavLink } from '../types';
import { Sliders, Menu, X, ArrowUpRight, Sparkles } from 'lucide-react';

interface NavbarProps {
  brandName: string;
  navLinks: NavLink[];
  onOpenCustomizer: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ brandName, navLinks, onOpenCustomizer }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      id="main-navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-black/90 backdrop-blur-md border-b border-white/[0.08] py-3.5'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 flex items-center justify-between">
        {/* Brand Logo & Name (Top-Left) */}
        <a
          href="#"
          className="flex items-center gap-3 group focus:outline-none"
          id="nav-brand-link"
        >
          {/* Minimalist Monochrome Emblem */}
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-bold font-mono transition-transform duration-200 group-hover:scale-105">
            <svg 
              className="w-4 h-4 text-black" 
              viewBox="0 0 24 24" 
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" fill="black" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>

          <div className="flex flex-col">
            <span className="font-heading text-base font-bold tracking-tight text-white group-hover:text-zinc-300 transition-colors">
              {brandName}
            </span>
          </div>
        </a>

        {/* Minimal Nav Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-8 text-xs uppercase tracking-widest font-mono text-zinc-400">
          {navLinks.map((link) => (
            <a
              key={link.id}
              id={link.id}
              href={link.href}
              className="text-zinc-400 hover:text-white transition-colors duration-150 py-1"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Controls (Desktop) */}
        <div className="hidden md:flex items-center gap-3">
          {/* Quick Customizer Trigger */}
          <button
            id="btn-open-customizer"
            onClick={onOpenCustomizer}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-white/20 rounded-full transition-all duration-150"
            title="Edit all placeholders in real time"
          >
            <Sliders className="w-3.5 h-3.5 text-zinc-400" />
            <span>Customize Text</span>
          </button>

          <a
            href="#testimonials"
            id="nav-login-btn"
            className="text-xs uppercase tracking-wider font-mono text-zinc-400 hover:text-white px-3 py-1.5 transition-colors"
          >
            Sign in
          </a>

          {/* Luxury High-Contrast White Action Button */}
          <a
            href="#cta"
            id="nav-signup-btn"
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full bg-white text-black hover:bg-zinc-200 transition-all duration-150 gap-1.5"
          >
            <span>Launch</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={onOpenCustomizer}
            className="p-2 text-zinc-300 bg-zinc-900 border border-white/10 rounded-lg"
            title="Customize Placeholders"
            id="mobile-btn-customizer"
          >
            <Sliders className="w-4 h-4" />
          </button>
          <button
            id="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-zinc-300 hover:text-white bg-zinc-900 border border-white/10 rounded-lg focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div 
          id="mobile-dropdown-nav"
          className="md:hidden mt-3 mx-4 p-5 rounded-2xl bg-zinc-950 border border-white/10 shadow-2xl space-y-4"
        >
          <div className="flex flex-col space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.id}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm uppercase tracking-wider font-mono text-zinc-300 hover:text-white py-1 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="pt-3 border-t border-white/10 flex flex-col gap-2.5">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenCustomizer();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-mono text-zinc-300 bg-zinc-900 border border-white/10 rounded-xl"
            >
              <Sliders className="w-4 h-4 text-zinc-400" />
              <span>Edit Hackathon Content</span>
            </button>
            <a
              href="#cta"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 px-4 bg-white text-black font-semibold rounded-xl text-xs uppercase tracking-wider"
            >
              Launch App
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
