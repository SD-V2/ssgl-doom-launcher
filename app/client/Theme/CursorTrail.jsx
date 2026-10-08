import PropTypes from 'prop-types';
import React, { useEffect, useRef } from 'react';

import { Trail } from './trail';

// things that show the "hand" pointer: the trail is more colorful over them
const CLICKABLE =
  "button, a, [role='button'], [draggable='true'], input[type='range'], input[type='checkbox'], label, .ssgl-item, .ssgl-folder, .ssgl-tabs button, .ssgl-button";

const reducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// One transparent canvas over the whole window (the mouse goes through it). Only runs
// while there is something to draw, so it costs nothing when the pointer rests.
const CursorTrail = ({ colors, onEngine }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!canvas || !ctx) return undefined;

    const trail = new Trail({ colors });
    if (onEngine) onEngine(trail);

    let width = 0;
    let height = 0;
    let frame = 0;
    let lastMove = 0;
    let pointer = null;
    let idleTimer = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const now = () => (window.performance ? window.performance.now() : Date.now());

    const loop = () => {
      const t = now();
      const left = trail.step(t);
      trail.draw(ctx, t, width, height);
      frame = left > 0 ? window.requestAnimationFrame(loop) : 0;
    };
    const run = () => {
      if (!frame) frame = window.requestAnimationFrame(loop);
    };

    const onMove = e => {
      pointer = { x: e.clientX, y: e.clientY };
      lastMove = now();
      const hand = !!(e.target && e.target.closest && e.target.closest(CLICKABLE));
      if (trail.move(e.clientX, e.clientY, lastMove, hand) > 0) run();
    };
    const onDown = e => {
      trail.click(e.clientX, e.clientY, now());
      run();
    };
    const onLeave = () => {
      pointer = null;
      trail.leave();
    };

    // resting pointer: one slow square from time to time, so it never looks dead
    idleTimer = window.setInterval(() => {
      if (pointer && now() - lastMove > 700 && document.hasFocus()) {
        trail.idle(pointer.x, pointer.y, now());
        run();
      }
    }, 900);

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mousedown', onDown, true);
    document.addEventListener('mouseleave', onLeave);
    window.addEventListener('blur', onLeave);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.clearInterval(idleTimer);
      if (frame) window.cancelAnimationFrame(frame);
      trail.clear();
      if (onEngine) onEngine(null);
    };
  }, [colors.main, colors.second, colors.hot]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10001
      }}
    />
  );
};

CursorTrail.propTypes = {
  colors: PropTypes.shape({
    main: PropTypes.string.isRequired,
    second: PropTypes.string.isRequired,
    hot: PropTypes.string.isRequired
  }).isRequired,
  onEngine: PropTypes.func
};

export { reducedMotion };
export default CursorTrail;
