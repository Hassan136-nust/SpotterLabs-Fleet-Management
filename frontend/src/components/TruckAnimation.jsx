import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './TruckAnimation.css';

gsap.registerPlugin(ScrollTrigger);

const TruckAnimation = ({ onExitStart, onTransitionComplete }) => {
  const canvasRef = useRef(null);
  const outerRef = useRef(null);
  const containerRef = useRef(null);

  const imagesRef = useRef([]);
  const animationObjRef = useRef({ frame: 0 });
  const contextRef = useRef(null);

  const [showButton, setShowButton] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const frameCount = 300;

  const getFramePath = (index) =>
    `/truck/ezgif-frame-${(index + 1).toString().padStart(3, '0')}.jpg`;

  function renderFrame(frameIndex) {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    const images = imagesRef.current;
    let idx = Math.round(frameIndex);
    let img = images[idx];

    if (!img || !img.complete || img.naturalWidth === 0) {
      for (let back = idx - 1; back >= 0; back--) {
        if (images[back] && images[back].complete && images[back].naturalWidth > 0) {
          img = images[back];
          break;
        }
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const logicalW = canvas.width / dpr;
    const logicalH = canvas.height / dpr;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    context.clearRect(0, 0, logicalW, logicalH);

    const scale = Math.max(logicalW / img.width, logicalH / img.height);
    const x = (logicalW / 2) - (img.width / 2) * scale;
    const y = (logicalH / 2) - (img.height / 2) * scale;

    context.drawImage(img, x, y, img.width * scale, img.height * scale);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    contextRef.current = context;

    const setCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const logicalW = window.innerWidth;
      const logicalH = window.innerHeight;
      canvas.width = Math.round(logicalW * dpr);
      canvas.height = Math.round(logicalH * dpr);
      canvas.style.width = logicalW + 'px';
      canvas.style.height = logicalH + 'px';
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
    };

    setCanvasSize();

    imagesRef.current = [];
    for (let i = 0; i < frameCount; i++) {
      imagesRef.current.push(null);
    }

    const CRITICAL_FRAMES = 15;
    let firstFrameLoaded = false;

    const loadFrame = (index) => {
      if (imagesRef.current[index]) return;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        imagesRef.current[index] = img;
        if (!firstFrameLoaded && index === 0) {
          firstFrameLoaded = true;
          setCanvasSize();
          renderFrame(0);
        }
      };
      img.src = getFramePath(index);
    };

    for (let i = 0; i < CRITICAL_FRAMES && i < frameCount; i++) {
      loadFrame(i);
    }

    const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 150));
    const loadRemainingFrames = (startIndex) => {
      if (startIndex >= frameCount) return;
      const batchEnd = Math.min(startIndex + 10, frameCount);
      for (let i = startIndex; i < batchEnd; i++) {
        loadFrame(i);
      }
      const scheduleNext = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));
      scheduleNext(() => loadRemainingFrames(batchEnd));
    };

    scheduleIdle(() => loadRemainingFrames(CRITICAL_FRAMES));

    const animationObj = animationObjRef.current;
    const isMobileDevice = window.innerWidth <= 768;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: outerRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: isMobileDevice ? 1 : 2.5,
        onUpdate: (self) => {
          const progress = self.progress;
          if (progress >= 0.96) {
            setShowButton(true);
          } else {
            setShowButton(false);
          }
        }
      }
    });

    tl.to(animationObj, {
      frame: frameCount - 1,
      ease: "none",
      duration: frameCount,
      onUpdate: () => renderFrame(animationObj.frame),
    }, 0);

    const handleResize = () => {
      setCanvasSize();
      renderFrame(animationObj.frame);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      tl.kill();
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  const handleStartClick = () => {
    setIsExiting(true);
    if (onExitStart) {
      onExitStart();
    }
    setTimeout(() => {
      if (onTransitionComplete) {
        onTransitionComplete();
      }
    }, 1200);
  };

  return (
    <div ref={outerRef} className={`truck-anim-outer ${isExiting ? 'exit-active' : ''}`}>
      <div ref={containerRef} className={`truck-anim-container ${isExiting ? 'exit-active' : ''}`}>
        <canvas ref={canvasRef} className="truck-anim-canvas" />
        
        {showButton && (
          <button 
            className="get-started-truck-btn"
            onClick={handleStartClick}
          >
            <span className="btn-truck-icon-wrapper">
              <svg className="btn-truck-svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-7.5H4V6h11v5h3l2 2.5h-2v-2.5z"/>
              </svg>
            </span>
            <span className="btn-text">GET STARTED</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default TruckAnimation;
