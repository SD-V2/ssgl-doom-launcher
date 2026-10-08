import { AnimatePresence, motion } from 'framer-motion';
import PropTypes from 'prop-types';
import React from 'react';

import { order } from '../routes';
import { useHashLocation } from '../utils';

// How a screen comes in when you switch tabs: a short slide from the side of the tab
// you came from, with a quick fade. Short and light, so a big mod list does not feel
// heavy. With "less motion" asked by the system: only a quick fade.
export const VIEW_SLIDE = 36; // pixels
export const VIEW_DURATION = 0.22; // seconds
export const VIEW_EASE = [0.22, 1, 0.36, 1]; // fast start, soft landing

const lessMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const viewAnimation = (loc, refer) => {
  if (lessMotion()) {
    return {
      transition: { type: 'tween', ease: 'linear', duration: 0.12 },
      initial: { opacity: 0 },
      animate: { opacity: 1 }
    };
  }
  const forward = order.indexOf(loc) >= order.indexOf(refer);
  return {
    transition: { type: 'tween', ease: VIEW_EASE, duration: VIEW_DURATION },
    initial: { x: forward ? VIEW_SLIDE : -VIEW_SLIDE, opacity: 0 },
    animate: { x: 0, opacity: 1 }
  };
};

const AnimatedView = ({ children }) => {
  // eslint-disable-next-line no-unused-vars
  const [loc, nav, refer] = useHashLocation();

  return (
    <AnimatePresence>
      <motion.div key="1" className="ssgl-view" {...viewAnimation(loc, refer)}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

AnimatedView.propTypes = {
  children: PropTypes.any
};

export default AnimatedView;
