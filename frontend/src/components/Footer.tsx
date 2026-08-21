import React from 'react';
import { ArrowUp } from 'lucide-react';

interface FooterProps {
  brandName: string;
  copyright: string;
  links: { label: string; href: string }[];
  onOpenCustomizer: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  brandName,
  copyright,
  links,
  onOpenCustomizer,
}) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-white/[0.08] bg-black py-12 relative z-10">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/[0.06]">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-black text-xs font-mono font-bold">
              AI
            </div>
            <span className="font-heading font-bold text-white tracking-wider text-sm">
              {brandName}
            </span>
          </div>

          {/* Nav & Policy Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500 font-mono uppercase">
            {links.map((link, idx) => (
              <a
                key={idx}
                href={link.href}
                className="hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenCustomizer}
              className="text-xs font-mono text-zinc-400 hover:text-white bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <span>Customize</span>
            </button>

            <button
              onClick={scrollToTop}
              className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              aria-label="Back to top"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-600 font-mono gap-4">
          <p>{copyright}</p>
          <p>
            Universal AI Architecture • Ready for Deployment
          </p>
        </div>

      </div>
    </footer>
  );
};
