'use client';

import React, { useState } from 'react';
import { usePortal } from '@/context/PortalContext';
import { motion } from 'framer-motion';

export const ProfileView: React.FC = () => {
  const { currentProfile, saveProfile, role, setAuthRoleTab, setAuthMode, setAuthed } = usePortal();
  const profile = currentProfile();

  const [name, setName] = useState(profile.name);
  const [dept, setDept] = useState(profile.dept);
  const [phone, setPhone] = useState(profile.phone);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveProfile(name, dept, phone);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 text-white shadow-2xl space-y-6"
    >
      <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
          {profile.initials}
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{profile.name}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{profile.dept} · ID: {profile.id}</p>
          <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-bold border border-amber-500/20 uppercase">
            {role === 'admin' ? 'Administrator Account' : 'Student Account'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
          <input
            type="text"
            required
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
          <input
            type="text"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 text-white font-semibold text-sm shadow-lg shadow-orange-500/25 transition-all mt-4"
        >
          Save Profile Changes
        </button>
      </form>

      {/* Switch role for testing */}
      <div className="pt-6 border-t border-slate-800 text-center">
        <button
          onClick={() => {
            setAuthRoleTab(role === 'admin' ? 'student' : 'admin');
            setAuthMode('login');
            setAuthed(false);
          }}
          className="text-xs text-amber-400 hover:underline"
        >
          Switch to {role === 'admin' ? 'Student' : 'Admin'} Role
        </button>
      </div>
    </motion.div>
  );
};
