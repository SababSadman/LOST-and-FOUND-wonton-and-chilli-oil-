'use client';

import React, { useState } from 'react';
import { usePortal } from '@/context/PortalContext';
import { motion } from 'framer-motion';

export const ItemDetailView: React.FC = () => {
  const {
    role,
    items,
    selectedItemId,
    showClaimForm,
    setShowClaimForm,
    goTo,
    openItemDetail,
    submitClaim,
    matchesFor,
    matchTone,
    generalizeLocation,
    selectConversation,
    showToast,
  } = usePortal();

  const isGuest = role === 'guest';
  const isStudent = role === 'student';

  const item = items.find((i) => i.id === selectedItemId) || items[0];

  const [feature, setFeature] = useState('');
  const [proof, setProof] = useState('');
  const [contact, setContact] = useState('');

  if (!item) return null;

  const isFound = item.type === 'found';
  const displayLoc = isGuest ? generalizeLocation(item.location) : item.location;

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitClaim(feature, proof, contact);
  };

  const potentialMatches = isStudent && item.mine ? matchesFor(item, items) : [];

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => goTo('browse')}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-all"
      >
        ← Back to Browse Listings
      </button>

      {/* Main Item Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 md:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 text-white shadow-2xl space-y-6"
      >
        {/* Header Title & Badges */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
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

            <h2 className="text-2xl md:text-3xl font-extrabold text-white">{item.title}</h2>
            <p className="text-xs text-slate-400 mt-1">
              Category: <strong className="text-slate-200">{item.category}</strong> · Ref #{item.code}
            </p>
          </div>

          {/* Quick Action CTAs */}
          <div className="flex gap-3">
            {isStudent && !item.mine && item.status !== 'Resolved' && !showClaimForm && (
              <button
                onClick={() => setShowClaimForm(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-xs shadow-lg shadow-orange-500/25 transition-all"
              >
                {isFound ? 'This is Mine (File Claim)' : 'I Found This Item'}
              </button>
            )}

            {isStudent && !item.mine && (item.status === 'Pending Claim' || item.status === 'Match Under Review') && (
              <button
                onClick={() => {
                  selectConversation('c1');
                  goTo('messages');
                  showToast('Conversation opened with reporter.');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all"
              >
                💬 Message Reporter
              </button>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Location</span>
            <span className="font-semibold text-slate-200">📍 {displayLoc}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Date Reported</span>
            <span className="font-semibold text-slate-200">📅 {item.date}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Reporter</span>
            <span className="font-semibold text-slate-200">👤 {item.reporter}</span>
          </div>
        </div>

        {/* Description */}
        <div>
          <h4 className="text-sm font-bold text-slate-200 mb-2">Public Description</h4>
          <p className="text-sm text-slate-300 leading-relaxed bg-slate-800/30 p-4 rounded-2xl border border-slate-800/60">
            {item.description}
          </p>
        </div>

        {/* Verification Info Box */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
          <span className="font-bold">🔒 Held-Back Private Detail System:</span> Admin holds back unique private markings submitted by the reporter. Anyone filing a claim must describe these details to verify ownership.
        </div>
      </motion.div>

      {/* Claim Submission Panel */}
      {showClaimForm && (
        <motion.form
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          onSubmit={handleClaimSubmit}
          className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-amber-500/40 text-white shadow-2xl space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-white">
              {isFound ? 'Submit Ownership Claim' : 'Report Found Item'}
            </h3>
            <button
              type="button"
              onClick={() => setShowClaimForm(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-slate-400">
            {isFound
              ? 'An admin compares your answers with the detail the finder held back before put in touch.'
              : 'Tell the desk what you found. Admin compares your description with the detail the owner held back.'}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isFound ? 'Unique Identifying Feature (Scratch, serial #, sticker)' : 'Detail you can see on the item'}
              </label>
              <input
                type="text"
                required
                placeholder={isFound ? 'e.g. Small red star sticker on back' : 'e.g. Cracked glass on top left'}
                value={feature}
                onChange={(e) => setFeature(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isFound ? 'Ownership Proof & When Lost' : 'Where & when you found it'}
              </label>
              <input
                type="text"
                required
                placeholder={isFound ? 'Lost on 22 Jul near Library 3rd floor' : 'Found on 23 Jul near Study Hub A'}
                value={proof}
                onChange={(e) => setProof(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Phone Number</label>
              <input
                type="text"
                required
                placeholder="+880 1700 000000"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 text-white font-semibold text-sm shadow-lg shadow-orange-500/25 transition-all"
            >
              Submit for Admin Verification
            </button>
          </div>
        </motion.form>
      )}

      {/* Potential Matches Section for Owner */}
      {potentialMatches.length > 0 && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 text-white shadow-xl space-y-4">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            ✨ AI Smart Match Suggestions ({potentialMatches.length})
          </h3>
          <div className="space-y-3">
            {potentialMatches.map((m) => {
              const tone = matchTone(m.score);
              return (
                <div
                  key={m.other.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-sm text-slate-200">{m.other.title}</div>
                    <div className="text-slate-400">{m.other.category} · {m.other.location}</div>
                    <div className="text-amber-400">{m.reasons.join(' · ')}</div>
                  </div>
                  <div className="text-right space-y-2">
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ backgroundColor: tone.bg, color: tone.color }}
                    >
                      {m.score}% Match ({tone.label})
                    </span>
                    <div>
                      <button
                        onClick={() => openItemDetail(m.other.id, false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
