'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePortal } from '@/context/PortalContext';

export const Toast: React.FC = () => {
  const { toast } = usePortal();

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900/95 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-slate-700/60 backdrop-blur-md text-sm font-medium"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
          <span>{toast}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
