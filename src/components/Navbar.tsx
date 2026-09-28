'use client';

import React from 'react';
import { usePortal } from '@/context/PortalContext';

export const Navbar: React.FC = () => {
  const {
    view,
    role,
    notifications,
    goTo,
    currentProfile,
    logout,
    setAuthMode,
    setAuthed,
  } = usePortal();

  const profile = currentProfile();
  const unreadCount = notifications.filter((n) => n.unread).length;

  const getPageMeta = (v: string): [string, string] => {
    switch (v) {
      case 'dashboard':
        return ['Dashboard', 'Manage lost & found activity across UIU campus.'];
      case 'browse':
        return ['Browse Listings', 'Search approved lost & found reports on campus.'];
      case 'item-detail':
        return ['Listing Details', 'Review full report info and claim verification.'];
      case 'report-lost':
        return ['Report Lost Item', 'Create a secure lost item report for admin review.'];
      case 'report-found':
        return ['Report Found Item', 'Hand in a found item for admin verification.'];
      case 'claims':
        return ['My Desk', 'Your active claims, reports, and AI matches.'];
      case 'messages':
        return ['Messages & Chat', 'Coordinate approved handovers securely with codes.'];
      case 'notifications':
        return ['Notifications', 'Stay updated on claim and message status.'];
      case 'profile':
        return ['Profile & Account', 'Manage your account info and preferences.'];
      case 'admin':
        return ['Admin Center', 'Review approvals, claims, disputes, and statistics.'];
      default:
        return ['UIU Lost & Found', 'United International University Campus Portal'];
    }
  };

  const [title, subtitle] = getPageMeta(view);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 text-white px-4 md:px-8 py-3.5 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-4">
        {/* Mobile menu trigger / Brand Icon */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center font-bold text-white shadow-md shadow-orange-500/20">
            UIU
          </div>
          <div className="hidden sm:block">
            <h1 className="font-semibold text-base leading-tight text-white flex items-center gap-2">
              {title}
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                {role}
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-normal">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center gap-3">
        {/* Notifications Icon Button */}
        {role !== 'guest' && (
          <button
            onClick={() => goTo('notifications')}
            className="relative p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition-colors border border-slate-700/50"
            title="Notifications"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-slate-900 animate-pulse" />
            )}
          </button>
        )}

        {/* Profile / Auth Button */}
        {role === 'guest' ? (
          <button
            onClick={() => {
              setAuthMode('login');
              setAuthed(false);
              goTo('dashboard');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium text-sm shadow-md shadow-orange-500/20 transition-all"
          >
            Sign In
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => goTo('profile')}
              className="flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white border border-slate-700/50 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                {profile.initials}
              </div>
              <span className="text-xs font-medium text-slate-200 hidden md:inline">{profile.name}</span>
            </button>

            <button
              onClick={logout}
              className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700/50 transition-colors"
              title="Sign Out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
