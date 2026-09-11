'use client';

import { motion, useReducedMotion } from 'framer-motion';

export function PortalExperience() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <main className="portal-shell">
      <motion.div
        className="portal-frame-wrap"
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 1.008 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <iframe
          className="portal-frame"
          src="/portal-runtime"
          title="UIU Lost and Found Portal"
        />
      </motion.div>
    </main>
  );
}
