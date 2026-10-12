// Shared framer-motion presets so motion feels the same everywhere.
// Rules (docs/design-system.md): enter with ease-out, exit faster with ease-in,
// 150–300ms, transform/opacity only, at most one or two animated things per view.
// <MotionConfig reducedMotion="user"> in App.jsx turns these into fades for
// people who ask their OS for reduced motion.

export const EASE_OUT = [0.22, 1, 0.36, 1];
export const EASE_IN = [0.4, 0, 1, 1];

export const DURATION = {
  fast: 0.15,
  base: 0.22,
  slow: 0.3,
};

/** Route content: a short fade and rise. */
export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ease: EASE_IN } },
};

/** Container that reveals its children one after another (keep lists short). */
export const staggerContainer = (stagger = 0.04) => ({
  initial: {},
  animate: { transition: { staggerChildren: stagger } },
});

export const fadeUpItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** Inline feedback such as form errors. */
export const reveal = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto', transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, height: 0, transition: { duration: DURATION.fast, ease: EASE_IN } },
};
