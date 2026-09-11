'use client';

import React from 'react';
import { usePortal } from '@/context/PortalContext';
import { View } from '@/types';
import { motion } from 'framer-motion';

export const Sidebar: React.FC = () => {
  const { view, role, goTo, notifications } = usePortal();

  const unreadAlerts = notifications.some((n) => n.unread);

  interface NavDef {
    key: View;
    label: string;
    icon: React.ReactNode;
    roles: ('student' | 'admin' | 'guest')[];
    hasDot?: boolean;
  }

  const navDefs: NavDef[] = [
    {
      key: 'dashboard',
      label: 'Home',
      roles: ['student', 'admin', 'guest'],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      key: 'browse',
      label: 'Browse',
      roles: ['student', 'admin', 'guest'],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      key: 'report-lost',
      label: 'Report Lost',
      roles: ['student'],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 11h10M7 15h10M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
        </svg>
      ),
    },
    {
      key: 'report-found',
      label: 'Report Found',
      roles: ['student'],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      key: 'claims',
      label: 'My Desk',
      roles: ['student'],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'messages',
      label: 'Chat',
      roles: ['student'],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      key: 'admin',
      label: 'Admin',
      roles: ['admin'],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      key: 'notifications',
      label: 'Alerts',
      roles: ['admin'],
      hasDot: unreadAlerts,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
  ];

  const visibleNav = navDefs.filter((n) => n.roles.includes(role));

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900/90 border-r border-slate-800 text-white min-h-[calc(100vh-61px)] p-4 select-none">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-3 mb-3">
          Navigation
        </div>
        <nav className="flex flex-col gap-1.5">
          {visibleNav.map((n) => {
            const isActive = view === n.key || (n.key === 'browse' && view === 'item-detail');
            return (
              <button
                key={n.key}
                onClick={() => goTo(n.key)}
                className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 w-1 h-6 bg-amber-500 rounded-r-full"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                {n.icon}
                <span>{n.label}</span>
                {n.hasDot && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info box */}
        <div className="mt-auto p-3.5 rounded-xl bg-slate-800/40 border border-slate-800/80 text-xs text-slate-400">
          <div className="font-semibold text-slate-300 mb-1">Student Affairs Desk</div>
          <p className="leading-relaxed">Need help recovering an item? Visit Room 102 or contact desk admin.</p>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-2 py-2 flex items-center justify-around">
        {visibleNav.slice(0, 5).map((n) => {
          const isActive = view === n.key || (n.key === 'browse' && view === 'item-detail');
          return (
            <button
              key={n.key}
              onClick={() => goTo(n.key)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium transition-colors ${
                isActive ? 'text-amber-400 font-bold' : 'text-slate-400'
              }`}
            >
              {n.icon}
              <span className="text-[10px]">{n.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
