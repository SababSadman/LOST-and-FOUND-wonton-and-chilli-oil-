'use client';

import React, { useState } from 'react';
import { usePortal } from '@/context/PortalContext';
import { AdminTab } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminView: React.FC = () => {
  const {
    adminTab,
    setAdminTab,
    approvals,
    claimReviews,
    disputes,
    categories,
    items,
    approveApproval,
    rejectApproval,
    approveClaimReview,
    rejectClaimReview,
    awardDispute,
    escalateDispute,
    addCategory,
    removeCategory,
    exportReport,
    verifyMatch,
  } = usePortal();

  const [newCatName, setNewCatName] = useState('');

  const handleAddCat = (e: React.FormEvent) => {
    e.preventDefault();
    addCategory(newCatName);
    setNewCatName('');
  };

  const adminTabDefs: { key: AdminTab; label: string }[] = [
    { key: 'approvals', label: `Post Approvals (${approvals.length})` },
    { key: 'claim-review', label: `Claim Review (${claimReviews.filter((r) => r.status === 'pending').length})` },
    { key: 'disputes', label: `Disputes (${disputes.length})` },
    { key: 'categories', label: `Categories (${categories.length})` },
    { key: 'reports', label: 'Statistics & Export' },
  ];

  return (
    <div className="space-y-6">
      {/* Admin Stat Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-600/30 to-amber-950/40 border border-amber-500/30 text-white">
          <div className="text-2xl font-black">{approvals.length}</div>
          <div className="text-xs text-amber-200">Posts awaiting approval</div>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600/30 to-blue-950/40 border border-blue-500/30 text-white">
          <div className="text-2xl font-black">{claimReviews.filter((r) => r.status === 'pending').length}</div>
          <div className="text-xs text-blue-200">Claims awaiting review</div>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-red-600/30 to-red-950/40 border border-red-500/30 text-white">
          <div className="text-2xl font-black">{disputes.length}</div>
          <div className="text-xs text-red-200">Open disputes</div>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600/30 to-emerald-950/40 border border-emerald-500/30 text-white">
          <div className="text-2xl font-black">{items.filter((i) => i.status === 'Resolved').length}</div>
          <div className="text-xs text-emerald-200">Items returned</div>
        </div>
      </div>

      {/* Admin Tab Switcher */}
      <div className="flex flex-wrap bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold gap-1">
        {adminTabDefs.map((t) => (
          <button
            key={t.key}
            onClick={() => setAdminTab(t.key)}
            className={`flex-1 py-2.5 px-4 rounded-xl transition-all text-center whitespace-nowrap ${
              adminTab === t.key
                ? 'bg-amber-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        {/* POST APPROVALS TAB */}
        {adminTab === 'approvals' && (
          <motion.div
            key="approvals"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {approvals.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
                <p>No posts waiting in the approval queue.</p>
              </div>
            ) : (
              approvals.map((a) => (
                <div
                  key={a.id}
                  className="p-5 md:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          a.type === 'lost' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {a.type === 'lost' ? 'Lost Report' : 'Found Item'}
                      </span>
                      <h4 className="font-bold text-base text-white">{a.title}</h4>
                    </div>
                    <span className="text-xs text-slate-400">By: {a.submittedBy}</span>
                  </div>

                  <p className="text-xs text-slate-300">{a.description}</p>
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                    <strong className="block mb-0.5">Private Verification Detail:</strong> {a.hiddenDetail}
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => rejectApproval(a.id)}
                      className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-xs border border-red-500/30"
                    >
                      Reject Submission
                    </button>
                    <button
                      onClick={() => approveApproval(a.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md"
                    >
                      Approve &amp; Publish to Counter
                    </button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}

        {/* CLAIM REVIEW TAB */}
        {adminTab === 'claim-review' && (
          <motion.div
            key="claim-review"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {claimReviews.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
                <p>No claims waiting for verification review.</p>
              </div>
            ) : (
              claimReviews.map((r) => {
                const vm = verifyMatch(r.claimantAnswer, r.hiddenDetail);
                const decided = r.status !== 'pending';

                return (
                  <div
                    key={r.id}
                    className="p-5 md:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-base text-white">Claim for: {r.item}</h4>
                        <p className="text-xs text-slate-400">Claimant: {r.claimant} ({r.contact})</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          decided
                            ? r.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {decided ? r.status.toUpperCase() : vm.label}
                      </span>
                    </div>

                    {/* Verification Match Progress Meter */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Detail Match Accuracy</span>
                        <span className="font-bold text-amber-400">{vm.pct}% Match</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${vm.pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                        <span className="text-slate-400 block mb-1">Claimant Answer:</span>
                        <span className="font-semibold text-white">{r.claimantAnswer}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <span className="text-amber-400 block mb-1">Held-Back Private Detail:</span>
                        <span className="font-semibold text-amber-200">{r.hiddenDetail}</span>
                      </div>
                    </div>

                    {!decided && (
                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          onClick={() => rejectClaimReview(r.id)}
                          className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-xs border border-red-500/30"
                        >
                          Reject Claim
                        </button>
                        <button
                          onClick={() => approveClaimReview(r.id)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md"
                        >
                          Approve Claim &amp; Issue PIN Code
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        {/* DISPUTES TAB */}
        {adminTab === 'disputes' && (
          <motion.div
            key="disputes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {disputes.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
                <p>No active conflicting claims or disputes.</p>
              </div>
            ) : (
              disputes.map((d) => (
                <div
                  key={d.id}
                  className="p-5 md:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-base text-white">Dispute: {d.itemTitle}</h4>
                    <span className="text-xs text-amber-400 font-semibold">{d.claimants.length} Claimants</span>
                  </div>

                  <div className="space-y-2">
                    {d.claimants.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700 text-xs"
                      >
                        <div>
                          <span className="font-bold text-white">{c.name}</span>
                          <p className="text-slate-400 mt-0.5">Answer: &quot;{c.answer}&quot;</p>
                        </div>
                        <button
                          onClick={() => awardDispute(d.id, c.name)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow"
                        >
                          Award Item
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => escalateDispute(d.id)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700"
                    >
                      Escalate to Student Affairs
                    </button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}

        {/* CATEGORIES TAB */}
        {adminTab === 'categories' && (
          <motion.div
            key="categories"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Add Category Form */}
            <form onSubmit={handleAddCat} className="flex gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
              <input
                type="text"
                required
                placeholder="New Category Name (e.g. Books, Sports)..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md whitespace-nowrap"
              >
                Add Category
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {categories.map((c) => {
                const inCat = items.filter((i) => i.category === c.name);
                const open = inCat.filter((i) => i.status !== 'Resolved').length;
                return (
                  <div
                    key={c.name}
                    className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-md flex items-center justify-between"
                  >
                    <div>
                      <h5 className="font-bold text-sm text-white">{c.name}</h5>
                      <p className="text-xs text-slate-400">{inCat.length} items · {open} open</p>
                    </div>
                    {open === 0 ? (
                      <button
                        onClick={() => removeCategory(c.name)}
                        className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                        In Use
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* REPORTS / STATISTICS TAB */}
        {adminTab === 'reports' && (
          <motion.div
            key="reports"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 md:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 text-white shadow-xl space-y-6"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-lg text-white">Campus Statistics &amp; Export</h3>
                <p className="text-xs text-slate-400 mt-0.5">Download official CSV report of lost &amp; found activities.</p>
              </div>
              <button
                onClick={exportReport}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 text-white font-semibold text-xs shadow-lg shadow-orange-500/25 transition-all flex items-center gap-2"
              >
                📥 Export CSV Report
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm text-slate-200">Category Breakdown</h4>
              {categories.map((c) => {
                const inCat = items.filter((i) => i.category === c.name).length;
                const pct = Math.round((inCat / (items.length || 1)) * 100);
                return (
                  <div key={c.name} className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>{c.name}</span>
                      <span>{inCat} items ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
