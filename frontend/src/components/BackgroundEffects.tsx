import React from 'react';

export const BackgroundEffects: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-black" aria-hidden="true">
      {/* Crisp, ultra-minimal subtle dark matte grid */}
      <div 
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.6) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.6) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />
      {/* Top subtle soft neutral gradient vignette */}
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
    </div>
  );
};
