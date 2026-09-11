'use client';

import React from 'react';
import { usePortal } from '@/context/PortalContext';
import { DeskTab } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

export const MyDeskView: React.FC = () => {
  const {
    deskTab,
    setDeskTab,
    claims,
    approvals,
    items,
    claimReviews,
    matchesFor,
    matchTone,
    openItemDetail,
    goTo,
  } = usePortal();

  const myItems = items.filter((i) => i.mine);
  const myOpenItems = myItems.filter((i) => i.status !== 'Resolved');

  // Matches collection
  const myMatches: {
    key: string;
    mineTitle: string;
    mineCode: string;
    otherTitle: string;
    otherCode: string;
    otherLocation: string;
    otherDate: string;
    score: number;
    reasons: string;
    otherId: number;
  }[] = [];

  myOpenItems.forEach((item) => {
    matchesFor(item, items).forEach((m) => {
      myMatches.push({
        key: `${item.id}-${m.other.id}`,
        mineTitle: item.title,
        mineCode: item.code,
        otherTitle: m.other.title,
        otherCode: m.other.code,
        otherLocation: m.other.location,
        otherDate: m.other.date,
        score: m.score,
        reasons: m.reasons.join(' · '),
        otherId: m.other.id,
      });
    });
  });
  myMatches.sort((a, b) => b.score - a.score);

  // My reports list
  const myReports = [
    ...approvals
      .filter((a) => a.mine)
      .map((a) => ({
        key: 'a' + a.id,
        title: a.title,
        code: a.code,
        type: a.type,
        meta: `${a.category} · ${a.location} · ${a.date}`,
        status: 'Awaiting approval',
        statusBg: 'var(--warning-soft)',
        statusColor: 'var(--warning)',
        matchNote: 'Matching starts once the desk approves this report.',
        showOpen: false,
        onOpen: () => {},
      })),
    ...myItems.map((i) => {
      const n = i.status === 'Resolved' ? 0 : matchesFor(i, items).length;
      return {
        key: 'i' + i.id,
        title: i.title,
        code: i.code,
        type: i.type,
        meta: `${i.category} · ${i.location} · ${i.date}`,
        status: i.status,
        statusBg:
          i.status === 'Resolved'
            ? 'var(--success-soft)'
            : i.status === 'Open'
            ? 'var(--warning-soft)'
            : 'var(--info-soft)',
        statusColor:
          i.status === 'Resolved'
            ? 'var(--success)'
            : i.status === 'Open'
            ? 'var(--warning)'
            : 'var(--info)',
        matchNote:
          i.status === 'Resolved'
            ? 'Case closed.'
            : n
            ? `${n} possible match(es) waiting in Matches.`
            : 'No matches yet — the desk keeps checking.',
        showOpen: true,
        onOpen: () => openItemDetail(i.id, false),
      };
    }),
  ];

  // Incoming claims by others
  const myItemIds = myItems.map((i) => i.id);
  const myIncoming = claimReviews
    .filter((r) => myItemIds.indexOf(r.itemId) !== -1)
    .map((r) => {
      const it = items.find((i) => i.id === r.itemId);
      const decided = r.status !== 'pending';
      return {
        key: 'in' + r.id,
        title: r.item,
        code: it ? it.code : 'CLM',
        claimant: r.claimant,
        kindLabel: r.kind === 'recovery' ? 'Someone says they found this' : 'Someone says this is theirs',
        meta: it ? `${it.category} · ${it.location} · ${it.date}` : '',
        statusLabel: decided ? (r.status === 'approved' ? 'Approved' : 'Not approved') : 'Awaiting admin review',
        statusBg: decided
          ? r.status === 'approved'
            ? 'var(--success-soft)'
            : 'var(--danger-soft)'
          : 'var(--warning-soft)',
        statusColor: decided
          ? r.status === 'approved'
            ? 'var(--success)'
            : 'var(--danger)'
          : 'var(--warning)',
        note: decided
          ? r.status === 'approved'
            ? 'The desk verified this claim. Agree a handover time in Chat.'
            : 'The desk could not verify this claim. Listing is open again.'
          : 'The desk is checking their answer against your held-back detail.',
        showOpen: !!it,
        onOpen: () => (it ? openItemDetail(it.id, false) : {}),
      };
    });

  const deskTabDefs: { key: DeskTab; label: string }[] = [
    { key: 'claims', label: `My Claims (${claims.length})` },
    { key: 'reports', label: `My Reports (${myReports.length})` },
    { key: 'incoming', label: `Incoming (${myIncoming.length})` },
    { key: 'matches', label: `Matches (${myMatches.length})` },
  ];

  return (
    <div className="space-y-6">
      {/* Desk Tab Switcher */}
      <div className="flex flex-wrap bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold gap-1">
        {deskTabDefs.map((t) => (
          <button
            key={t.key}
            onClick={() => setDeskTab(t.key)}
            className={`flex-1 py-2.5 px-4 rounded-xl transition-all text-center whitespace-nowrap ${
              deskTab === t.key
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
        {/* CLAIMS TAB */}
        {deskTab === 'claims' && (
          <motion.div
            key="claims"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {claims.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
                <p>No active claims submitted yet.</p>
              </div>
            ) : (
              claims.map((c) => {
                let progressPct = '33%';
                let progressColor = 'bg-blue-500';
                if (c.verification === 'Approved') {
                  progressPct = '75%';
                  progressColor = 'bg-emerald-500';
                }
                if (c.verification === 'Returned') {
                  progressPct = '100%';
                  progressColor = 'bg-emerald-500';
                }
                if (c.verification === 'Rejected') {
                  progressPct = '100%';
                  progressColor = 'bg-red-500';
                }

                return (
                  <div
                    key={c.id}
                    className="p-5 md:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-base text-white">{c.itemTitle}</h4>
                        <p className="text-xs text-slate-400">{c.itemMeta}</p>
                      </div>
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {c.verification}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Verification Progress</span>
                        <span className="font-bold text-slate-200">{progressPct}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: progressPct }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className={`h-full rounded-full ${progressColor}`}
                        />
                      </div>
                    </div>

                    {/* Handover Code Display */}
                    {c.handoverCode && (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                        <div className="text-xs text-amber-300">
                          <span className="font-bold">4-Digit Handover PIN:</span> Present at Student Affairs Desk
                        </div>
                        <div className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-sm tracking-widest">
                          {c.handoverCode}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      {c.verification === 'Approved' ? (
                        <button
                          onClick={() => goTo('messages')}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 text-white font-semibold text-xs shadow-md"
                        >
                          Open Chat &amp; Coordinate Handover
                        </button>
                      ) : (
                        <button
                          onClick={() => openItemDetail(c.itemId, false)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700"
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        {/* REPORTS TAB */}
        {deskTab === 'reports' && (
          <motion.div
            key="reports"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {myReports.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
                <p>You haven&apos;t filed any lost or found reports yet.</p>
              </div>
            ) : (
              myReports.map((r) => (
                <div
                  key={r.key}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white">{r.title}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        #{r.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{r.meta}</p>
                    <p className="text-xs text-amber-400">{r.matchNote}</p>
                  </div>

                  {r.showOpen && (
                    <button
                      onClick={r.onOpen}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 whitespace-nowrap"
                    >
                      View
                    </button>
                  )}
                </div>
              ))
            )}
          </motion.div>
        )}

        {/* INCOMING TAB */}
        {deskTab === 'incoming' && (
          <motion.div
            key="incoming"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {myIncoming.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
                <p>No claims filed by others against your listings yet.</p>
              </div>
            ) : (
              myIncoming.map((inc) => (
                <div
                  key={inc.key}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white">{inc.title}</h4>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                      {inc.statusLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Claimant: {inc.claimant} · {inc.kindLabel}</p>
                  <p className="text-xs text-slate-300 bg-slate-800/30 p-3 rounded-xl border border-slate-800">{inc.note}</p>
                </div>
              ))
            )}
          </motion.div>
        )}

        {/* MATCHES TAB */}
        {deskTab === 'matches' && (
          <motion.div
            key="matches"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {myMatches.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
                <p>No high-confidence matches found for your reports yet.</p>
              </div>
            ) : (
              myMatches.map((m) => {
                const tone = matchTone(m.score);
                return (
                  <div
                    key={m.key}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-400">Your report: <strong className="text-white">{m.mineTitle}</strong></div>
                        <div className="font-bold text-base text-amber-400 mt-0.5">Matched with: {m.otherTitle}</div>
                      </div>
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold"
                        style={{ backgroundColor: tone.bg, color: tone.color }}
                      >
                        {m.score}% ({tone.label})
                      </span>
                    </div>

                    <div className="text-xs text-slate-300">📍 {m.otherLocation} · 📅 {m.otherDate}</div>
                    <div className="text-xs text-slate-400 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                      Match Reasons: {m.reasons}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => openItemDetail(m.otherId, false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700"
                      >
                        Inspect Matched Item
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
