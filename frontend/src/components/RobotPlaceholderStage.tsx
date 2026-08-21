import React, { useState, useEffect, useRef } from 'react';

interface RobotPlaceholderStageProps {
  sceneUrl?: string;
}

export const RobotPlaceholderStage: React.FC<RobotPlaceholderStageProps> = ({
  sceneUrl = 'https://prod.spline.design/SK9itLygS2YFMF1F/scene.splinecode',
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ensure Spline Viewer web component script is loaded dynamically from CDN
  useEffect(() => {
    if (typeof window !== 'undefined' && customElements.get('spline-viewer')) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@splinetool/viewer@1.9.72/build/spline-viewer.js';
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      // Try fallback to unpkg latest if specific version fails
      const fallbackScript = document.createElement('script');
      fallbackScript.type = 'module';
      fallbackScript.src = 'https://unpkg.com/@splinetool/viewer/build/spline-viewer.js';
      fallbackScript.onload = () => setScriptLoaded(true);
      fallbackScript.onerror = () => {
        setHasError(true);
        setIsLoading(false);
      };
      document.head.appendChild(fallbackScript);
    };
    document.head.appendChild(script);
  }, []);



  // Listen for load event from spline-viewer custom element
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current) return;

    const viewerEl = containerRef.current.querySelector('spline-viewer');
    if (!viewerEl) return;

    const handleViewerLoad = () => {
      setIsLoading(false);
      setHasError(false);
    };

    viewerEl.addEventListener('load', handleViewerLoad);
    
    // Safety timer: hide spinner after 3.5s
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3500);

    return () => {
      viewerEl.removeEventListener('load', handleViewerLoad);
      clearTimeout(timer);
    };
  }, [scriptLoaded, sceneUrl]);

  return (
    <div 
      id="robot-model-stage-container"
      ref={containerRef}
      className="relative w-full h-[440px] sm:h-[520px] lg:h-[600px] xl:h-[650px] flex items-center justify-center select-none rounded-3xl overflow-hidden group"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Subtle Circular Ground Base Platform Accent */}
      <div 
        className="absolute w-[320px] sm:w-[420px] lg:w-[500px] h-[320px] sm:h-[420px] lg:h-[500px] rounded-full border border-white/[0.07] pointer-events-none transition-opacity duration-700"
        style={{ transform: 'rotateX(68deg) translateY(60px)', opacity: isLoading ? 0.3 : 0.6 }}
      />
      
      {/* Inner Concentric Stage Ring */}
      <div 
        className="absolute w-[220px] sm:w-[280px] lg:w-[340px] h-[220px] sm:h-[280px] lg:h-[340px] rounded-full border border-dashed border-white/[0.05] pointer-events-none"
        style={{ transform: 'rotateX(68deg) translateY(60px)' }}
      />

      {/* Subtle Ground Stage Horizon Line */}
      <div className="absolute bottom-10 w-[70%] h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none z-0" />

      {/* Ambient Soft Glow behind Robot */}
      <div className="absolute inset-0 bg-radial from-white/[0.04] via-transparent to-transparent pointer-events-none rounded-full blur-2xl" />

      {/* Loading Skeleton & Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 backdrop-blur-xs bg-black/20 rounded-3xl transition-opacity duration-300">
          <div className="relative w-16 h-16 flex items-center justify-center">
            {/* Outer spinning ring */}
            <div className="absolute inset-0 rounded-full border-2 border-white/10 border-t-white animate-spin" />
            {/* Inner pulsing core */}
            <div className="w-6 h-6 rounded-full bg-white/20 animate-pulse" />
          </div>
          <div className="mt-4 text-xs font-mono text-zinc-400 tracking-wider uppercase animate-pulse">
            Loading 3D Robot Scene...
          </div>
        </div>
      )}

      {/* Fallback Display on Error */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-zinc-900/60 border border-white/10 rounded-3xl p-6 text-center">
          <div className="text-sm font-mono text-zinc-400 mb-2">[ 3D SCENE LOAD ERROR ]</div>
          <p className="text-xs text-zinc-500 max-w-xs">
            Unable to connect to Spline 3D scene. Please check internet connection.
          </p>
          <button 
            onClick={() => { setHasError(false); setIsLoading(true); setScriptLoaded(false); }}
            className="mt-4 px-4 py-1.5 rounded-full text-xs font-mono bg-white text-black hover:bg-zinc-200 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Interactive 3D Spline Canvas */}
      {!hasError && scriptLoaded && (
        <div className="relative z-10 w-full h-full flex items-center justify-center bg-transparent">
          {React.createElement('spline-viewer', {
            url: sceneUrl,
            'loading-anim-type': 'none',
            style: {
              width: '100%',
              height: '100%',
              background: 'transparent',
            },
          })}
        </div>
      )}

      {/* Subtle Corner Status Marker */}
      <div className="absolute bottom-3 right-4 z-20 pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity">
        <span className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase bg-zinc-950/80 px-2 py-0.5 rounded border border-white/10">
          Interactive 3D Stage
        </span>
      </div>
    </div>
  );
};



