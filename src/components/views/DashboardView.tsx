'use client';

import React from 'react';
import { usePortal } from '@/context/PortalContext';
import { motion } from 'framer-motion';

export const DashboardView: React.FC = () => {
  const {
    role,
    items,
    approvals,
    claimReviews,
    disputes,
    activity,
    goTo,
    openItemDetail,
    matchesFor,
  } = usePortal();

  const isAdmin = role === 'admin';
  const isStudent = role === 'student';
  const isGuest = role === 'guest';

  // Stats calculation
  const myItems = items.filter((i) => i.mine);
  const myOpenItems = myItems.filter((i) => i.status !== 'Resolved');
  const myMatchesCount = myOpenItems.reduce((acc, item) => acc + matchesFor(item, items).length, 0);

  const heroHeadline = isGuest
    ? "Browse what's been found on campus."
    : isAdmin
    ? 'Keep the community desk running smoothly.'
    : 'Lost something on campus? Start here.';

  const heroCopy = isGuest
    ? 'General found-item listings are open to everyone. Sign in with a UIU account to claim an item or message a finder.'
    : isAdmin
    ? 'Review incoming reports, verify claims against hidden details, and resolve disputes fairly.'
    : 'Report missing belongings, review verified found items, submit secure claims, and coordinate a safe handover.';

  const statCards = isAdmin
    ? [
        { label: 'Posts awaiting approval', value: approvals.length, highlight: 'warning' },
        { label: 'Claims awaiting review', value: claimReviews.filter((r) => r.status === 'pending').length, highlight: 'info' },
        { label: 'Open disputes', value: disputes.length, highlight: 'danger' },
        { label: 'Active counter listings', value: items.filter((i) => i.status !== 'Resolved').length, highlight: 'success' },
      ]
    : [
        { label: 'Active lost reports', value: items.filter((i) => i.type === 'lost' && i.status !== 'Resolved').length, highlight: 'info' },
        { label: 'Found items on counter', value: items.filter((i) => i.type === 'found' && i.status !== 'Resolved').length, highlight: 'warning' },
        { label: 'Successful returns', value: items.filter((i) => i.status === 'Resolved').length + 64, highlight: 'success' },
        { label: 'Possible matches for you', value: myMatchesCount, highlight: 'accent' },
      ];

  return (
    <div className="space-y-6">
      {/* Hero Banner Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/40 p-6 md:p-10 border border-slate-800 shadow-2xl text-white"
      >
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            UIU Student Affairs Lost &amp; Found
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight leading-tight">
            {heroHeadline}
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            {heroCopy}
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 pt-2">
            {isStudent && (
              <>
                <button
                  onClick={() => goTo('report-lost')}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-sm shadow-lg shadow-orange-500/25 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Report Lost Item
                </button>
                <button
                  onClick={() => goTo('report-found')}
                  className="px-5 py-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-white font-semibold text-sm border border-slate-700 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Hand In Found Item
                </button>
              </>
            )}
            {isAdmin && (
              <button
                onClick={() => goTo('admin')}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-sm shadow-lg shadow-orange-500/25 transition-all flex items-center gap-2"
              >
                Review Admin Queue ({approvals.length + claimReviews.filter((r) => r.status === 'pending').length})
              </button>
            )}
            <button
              onClick={() => goTo('browse')}
              className="px-5 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-200 font-medium text-sm border border-slate-700/50 transition-all"
            >
              Browse Counter Listings →
            </button>
          </div>
        </div>

        {/* Decorative Gradient Glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      </motion.div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((st, idx) => (
          <motion.div
            key={st.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.08 }}
            className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-lg space-y-2"
          >
            <div className="text-3xl font-black text-white tracking-tight">
              {st.value}
            </div>
            <div className="text-xs text-slate-400 font-medium leading-snug">
              {st.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Grid: Activity Feed & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Activity Feed */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Activity Log
            </h3>
            <span className="text-xs text-slate-400">Real-time Desk Updates</span>
          </div>

          <div className="space-y-3">
            {activity.slice(0, 5).map((act, i) => (
              <div
                key={i}
                className="flex items-start justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-800/80 text-sm transition-colors hover:bg-slate-800/70"
              >
                <div className="flex items-center gap-3">
                  <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-bold text-xs border border-amber-500/20">
                    {act.code}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">{act.title}</div>
                    <div className="text-xs text-slate-400">{act.detail}</div>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 whitespace-nowrap">{act.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Shortcuts / Info Card */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-white mb-2">Quick Actions</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Need assistance or matching an unlisted item? Access shortcuts below.
            </p>
            <div className="space-y-2.5">
              <button
                onClick={() => goTo('browse')}
                className="w-full text-left p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-xs font-medium text-slate-200 border border-slate-700/60 transition-all flex items-center justify-between"
              >
                <span>🔍 Search All Counter Listings</span>
                <span>→</span>
              </button>
              {isStudent && (
                <button
                  onClick={() => goTo('claims')}
                  className="w-full text-left p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-xs font-medium text-slate-200 border border-slate-700/60 transition-all flex items-center justify-between"
                >
                  <span>📋 Check Matches on My Reports</span>
                  <span>→</span>
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => goTo('admin')}
                  className="w-full text-left p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-xs font-medium text-slate-200 border border-slate-700/60 transition-all flex items-center justify-between"
                >
                  <span>⚙️ Open Admin Control Desk</span>
                  <span>→</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <span className="font-bold">Pro-tip:</span> Always describe unique features in private details so admins can verify ownership easily!
          </div>
        </div>
      </div>
    </div>
  );
};
