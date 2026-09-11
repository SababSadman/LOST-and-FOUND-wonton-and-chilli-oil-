"use client";

/**
 * MotionProvider
 * Wrap any component/page with this to enable Framer Motion animations.
 * Already included in RootLayout so the entire app is covered.
 *
 * Usage:
 *   import { motion } from "framer-motion";
 *   <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }} />
 */
import { LazyMotion, domAnimation } from "framer-motion";
import type { ReactNode } from "react";

export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      {children}
    </LazyMotion>
  );
}
