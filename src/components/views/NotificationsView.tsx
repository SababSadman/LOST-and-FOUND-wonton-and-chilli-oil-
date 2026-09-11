'use client';

import React from 'react';
import { usePortal } from '@/context/PortalContext';
import { motion } from 'framer-motion';

export const NotificationsView: React.FC = () => {
  const { notifications, markAllRead, openNotification } = usePortal();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between p-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-white">Notifications</h2>
          <p className="text-xs text-slate-400 mt-0.5">Stay updated on your claims, reports, and messages.</p>
        </div>
        <button
          onClick={markAllRead}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
        >
          Mark All Read
        </button>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
            <p>No notifications yet.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => openNotification(n)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                n.unread
                  ? 'bg-amber-500/10 border-amber-500/30 text-white'
                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {n.unread && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                    <h4 className="font-bold text-sm text-white">{n.title}</h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{n.body}</p>
                </div>
                <span className="text-[11px] text-slate-500 whitespace-nowrap">{n.time}</span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
