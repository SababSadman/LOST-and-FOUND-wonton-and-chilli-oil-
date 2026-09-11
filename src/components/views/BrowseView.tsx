'use client';

import React from 'react';
import { usePortal } from '@/context/PortalContext';
import { Item } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

export const BrowseView: React.FC = () => {
  const {
    role,
    items,
    categories,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    tokens,
    generalizeLocation,
    openItemDetail,
    setAuthMode,
    authed,
  } = usePortal();

  const isGuest = role === 'guest';
  const isStudent = role === 'student';

  const qTokens = tokens(search);

  const filteredItemsRaw = items.filter((item) => {
    if (isGuest && (item.type !== 'found' || item.category === 'Documents')) return false;
    const hay = `${item.title} ${item.category} ${item.location} ${item.description}`.toLowerCase();
    const matchesSearch = !search || hay.includes(search.toLowerCase().trim());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  });

  const relevance = (item: Item) => {
    if (!qTokens.length) return 0;
    const t = tokens(item.title + ' ' + item.description + ' ' + item.category + ' ' + item.location);
    return qTokens.filter((w) => t.indexOf(w) !== -1).length;
  };

  const sortedItems = [...filteredItemsRaw].sort((a, b) => {
    if (sortBy === 'relevance') {
      const d = relevance(b) - relevance(a);
      if (d !== 0) return d;
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter Control Bar */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <svg className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by keyword, item title, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Sort By Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
          >
            <option value="recent">Sort by Newest</option>
            <option value="relevance">Sort by Relevance</option>
          </select>
        </div>

        {/* Filter Badges Row */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-800">
          {/* Type Filter */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs font-semibold">
            {['all', 'lost', 'found'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  typeFilter === t ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-semibold focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-semibold focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Pending Claim">Pending Claim</option>
            <option value="Resolved">Resolved</option>
          </select>

          <div className="ml-auto text-xs text-slate-400">
            Showing <strong className="text-amber-400">{sortedItems.length}</strong> items
          </div>
        </div>
      </div>

      {/* Grid of Listings */}
      {sortedItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 space-y-3">
          <div className="text-4xl">🔍</div>
          <h3 className="text-lg font-bold text-white">No listings match your search</h3>
          <p className="text-xs max-w-sm mx-auto">
            Try adjusting your search keywords or switching filters to view active campus reports.
          </p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {sortedItems.map((item) => {
              const displayLoc = isGuest ? generalizeLocation(item.location) : item.location;

              let primaryLabel = '';
              let onPrimary = () => {};

              if (item.type === 'found' && item.status !== 'Resolved') {
                if (isGuest) {
                  primaryLabel = 'Sign in to Claim';
                  onPrimary = () => {
                    setAuthMode('login');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  };
                } else if (isStudent) {
                  primaryLabel = item.status === 'Open' ? 'This is mine' : 'View claim';
                  onPrimary = () => openItemDetail(item.id, item.status === 'Open');
                }
              } else if (item.type === 'lost' && isStudent && !item.mine && item.status !== 'Resolved') {
                primaryLabel = 'I found this';
                onPrimary = () => openItemDetail(item.id, true);
              } else if (item.type === 'lost' && isStudent && item.mine) {
                primaryLabel = 'My report';
                onPrimary = () => openItemDetail(item.id, false);
              }

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                  className="group relative flex flex-col justify-between rounded-2xl bg-slate-900/90 border border-slate-800 p-5 text-white shadow-xl hover:border-amber-500/40 transition-all hover:shadow-2xl hover:-translate-y-1"
                >
                  <div className="space-y-3">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                          item.type === 'lost'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {item.type === 'lost' ? 'Lost Report' : 'Found Item'}
                      </span>

                      <span
                        className={`badge-status ${
                          item.status === 'Resolved'
                            ? 'badge-resolved'
                            : item.status === 'Open'
                            ? 'badge-open'
                            : 'badge-pending'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    {/* Title & Category */}
                    <div>
                      <h4
                        onClick={() => openItemDetail(item.id, false)}
                        className="font-bold text-base text-white group-hover:text-amber-400 transition-colors cursor-pointer"
                      >
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">{item.category} · Ref #{item.code}</p>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  {/* Footer Meta & CTAs */}
                  <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        📍 {displayLoc}
                      </span>
                      <span>{item.date}</span>
                    </div>

                    <div className="flex gap-2">
                      {primaryLabel && (
                        <button
                          onClick={onPrimary}
                          className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-xs shadow-md shadow-orange-500/20 transition-all text-center"
                        >
                          {primaryLabel}
                        </button>
                      )}
                      <button
                        onClick={() => openItemDetail(item.id, false)}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};
