import React, { useEffect, useRef, useState } from 'react';
import './TruckAnimation.css';

const FRAME_COUNT   = 300;
const SCROLL_HEIGHT = 2500; // px of scroll travel to play all frames

const getFramePath = (i) =>
  `/truck/ezgif-frame-${(i + 1).toString().padStart(3, '0')}.jpg`;

const TruckAnimation = ({ onExitStart, onTransitionComplete }) => {
  const canvasRef   = useRef(null);
  const contextRef  = useRef(null);
  const imagesRef   = useRef(Array(FRAME_COUNT).fill(null));
  const spacerRef   = useRef(null);   // tall div that provides scroll room
  const scrollTopRef = useRef(0);     // last rendered scroll position
  const rafRef      = useRef(null);

  const [showButton, setShowButton] = useState(false);
  const [isExiting,  setIsExiting]  = useState(false);

  // ── Render one frame ──
  const renderFrame = (idx) => {
    const canvas  = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;
    const img = imagesRef.current[idx];
    if (!img?.complete || !img.naturalWidth) return;

    const dpr      = window.devicePixelRatio || 1;
    const logicalW = canvas.width  / dpr;
    const logicalH = canvas.height / dpr;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, logicalW, logicalH);

    const scale = Math.max(logicalW / img.width, logicalH / img.height);
    const x = (logicalW - img.width  * scale) / 2;
    const y = (logicalH - img.height * scale) / 2;

    context.imageSmoothingEnabled  = true;
    context.imageSmoothingQuality  = 'high';
    context.drawImage(img, x, y, img.width * scale, img.height * scale);
  };

  // ── Fit canvas to viewport ──
  const resizeCanvas = () => {
    const canvas  = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.round(window.innerWidth  * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
  };

  useEffect(() => {
    // Prevent the page behind from scrolling visually — we handle scroll ourselves
    document.body.style.overflow = 'hidden';

    const canvas  = canvasRef.current;
    contextRef.current = canvas.getContext('2d');
    resizeCanvas();

    // ── Load frames ──
    const loadFrame = (i) => {
      if (imagesRef.current[i]) return;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        imagesRef.current[i] = img;
        if (i === 0) { resizeCanvas(); renderFrame(0); }
      };
      img.src = getFramePath(i);
    };

    const EAGER = 20;
    for (let i = 0; i < Math.min(EAGER, FRAME_COUNT); i++) loadFrame(i);

    const schedule = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 80));
    const loadBatch = (start) => {
      if (start >= FRAME_COUNT) return;
      const end = Math.min(start + 15, FRAME_COUNT);
      for (let i = start; i < end; i++) loadFrame(i);
      schedule(() => loadBatch(end));
    };
    schedule(() => loadBatch(EAGER));

    // ── Internal scroll state (we track wheel/touch ourselves) ──
    let internalScroll = 0;  // 0 → SCROLL_HEIGHT
    let targetScroll   = 0;
    let lastRenderedFrame = -1;

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // rAF loop — lerp scroll, map to frame
    const loop = () => {
      // Smooth lerp toward target
      internalScroll += (targetScroll - internalScroll) * 0.08;

      const progress = clamp(internalScroll / SCROLL_HEIGHT, 0, 1);
      const frameIdx = Math.round(progress * (FRAME_COUNT - 1));

      if (frameIdx !== lastRenderedFrame) {
        renderFrame(frameIdx);
        lastRenderedFrame = frameIdx;
      }

      // Show button near end
      if (progress >= 0.97) {
        setShowButton(true);
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    // ── Wheel handler ──
    const onWheel = (e) => {
      e.preventDefault();
      targetScroll = clamp(targetScroll + e.deltaY, 0, SCROLL_HEIGHT);
    };

    // ── Touch handler ──
    let touchStartY = 0;
    const onTouchStart = (e) => { touchStartY = e.touches[0].clientY; };
    const onTouchMove  = (e) => {
      e.preventDefault();
      const dy = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      targetScroll = clamp(targetScroll + dy * 1.5, 0, SCROLL_HEIGHT);
    };

    // ── Keyboard handler ──
    const onKeyDown = (e) => {
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        targetScroll = clamp(targetScroll + 120, 0, SCROLL_HEIGHT);
      }
      if (['ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        targetScroll = clamp(targetScroll - 120, 0, SCROLL_HEIGHT);
      }
    };

    window.addEventListener('wheel',      onWheel,      { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true  });
    window.addEventListener('touchmove',  onTouchMove,  { passive: false });
    window.addEventListener('keydown',    onKeyDown);
    window.addEventListener('resize',     resizeCanvas);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('wheel',      onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove',  onTouchMove);
      window.removeEventListener('keydown',    onKeyDown);
      window.removeEventListener('resize',     resizeCanvas);
      document.body.style.overflow = '';
    };
  }, []);

  const handleStartClick = () => {
    setIsExiting(true);
    document.body.style.overflow = '';
    if (onExitStart) onExitStart();
    setTimeout(() => {
      if (onTransitionComplete) onTransitionComplete();
    }, 1200);
  };

  return (
    <div className={`truck-anim-outer ${isExiting ? 'exit-active' : ''}`}>
      <canvas ref={canvasRef} className="truck-anim-canvas" />

      {/* Scroll hint shown at start */}
      {!showButton && (
        <div className="truck-scroll-hint">
          <span className="scroll-hint-arrow">↓</span>
          <span className="scroll-hint-text">SCROLL TO EXPLORE</span>
        </div>
      )}

      {showButton && (
        <button className="get-started-truck-btn" onClick={handleStartClick}>
          <span className="btn-truck-icon-wrapper">
            <svg className="btn-truck-svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
            </svg>
          </span>
          <span className="btn-text">GET STARTED</span>
        </button>
      )}
    </div>
  );
};

export default TruckAnimation;
