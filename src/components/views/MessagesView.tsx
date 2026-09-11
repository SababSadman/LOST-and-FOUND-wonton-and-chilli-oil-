'use client';

import React, { useState } from 'react';
import { usePortal } from '@/context/PortalContext';
import { motion } from 'framer-motion';

export const MessagesView: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    selectConversation,
    sendChat,
    confirmHandover,
    completeHandover,
    showToast,
  } = usePortal();

  const [inputVal, setInputVal] = useState('');

  const activeConv = conversations.find((c) => c.id === activeConversationId) || conversations[0];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    sendChat(inputVal);
    setInputVal('');
  };

  if (!activeConv) {
    return (
      <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
        <p>No active conversations yet.</p>
      </div>
    );
  }

  const handoverStatus = activeConv.handover ? activeConv.handover.status : '';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
      {/* Sidebar Conversations List */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl flex flex-col space-y-3 overflow-y-auto">
        <h3 className="font-bold text-sm text-slate-300 px-2">Conversations</h3>
        <div className="space-y-1.5 flex-1">
          {conversations.map((c) => {
            const isActive = c.id === activeConversationId;
            return (
              <button
                key={c.id}
                onClick={() => selectConversation(c.id)}
                className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 ${
                  isActive
                    ? 'bg-amber-500/15 border border-amber-500/30'
                    : 'hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                  {c.avatar}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white truncate">{c.name}</span>
                    <span className="text-[10px] text-slate-500">{c.time}</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{c.lastMessage}</p>
                </div>
                {c.unread && <span className="w-2 h-2 rounded-full bg-amber-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="md:col-span-2 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-xl flex flex-col justify-between overflow-hidden">
        {/* Chat Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30">
              {activeConv.avatar}
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">{activeConv.name}</h4>
              <p className="text-xs text-slate-400">Item: {activeConv.itemTitle}</p>
            </div>
          </div>
        </div>

        {/* Handover Box System */}
        {activeConv.handover && (
          <div className="my-3 p-4 rounded-2xl bg-gradient-to-r from-slate-800 to-amber-950/30 border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300">📦 Campus Handover Desk Box</span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold uppercase text-[10px]">
                {handoverStatus}
              </span>
            </div>

            {handoverStatus === 'proposed' && (
              <div className="flex items-center justify-between text-xs text-slate-300 gap-3">
                <span>{activeConv.handover.text}</span>
                <button
                  onClick={confirmHandover}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 text-white font-semibold shadow-md whitespace-nowrap"
                >
                  Confirm Handover
                </button>
              </div>
            )}

            {handoverStatus === 'confirmed' && (
              <div className="flex flex-wrap items-center justify-between text-xs gap-3">
                <div className="space-y-0.5">
                  <div className="text-slate-300">4-Digit Handover PIN Code:</div>
                  <div className="text-base font-black text-amber-400 tracking-widest">
                    {activeConv.handover.code}
                  </div>
                </div>
                <button
                  onClick={completeHandover}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md whitespace-nowrap"
                >
                  Complete Handover (Close Case)
                </button>
              </div>
            )}

            {handoverStatus === 'complete' && (
              <div className="text-xs text-emerald-400 font-semibold flex items-center gap-2">
                ✓ Handover complete. Case closed at Student Affairs Desk.
              </div>
            )}
          </div>
        )}

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto space-y-3 py-3 px-1">
          {activeConv.messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-xs md:max-w-md p-3.5 rounded-2xl text-xs leading-relaxed ${
                  m.mine
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-br-none shadow-md'
                    : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-none'
                }`}
              >
                {m.text}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 px-1">{m.time}</span>
            </div>
          ))}
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-slate-800">
          <input
            type="text"
            placeholder="Type a message to coordinate handover..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
