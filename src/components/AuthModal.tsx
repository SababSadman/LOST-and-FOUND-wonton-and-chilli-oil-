'use client';

import React, { useState, useRef } from 'react';
import { usePortal } from '@/context/PortalContext';
import { motion, AnimatePresence } from 'framer-motion';

export const AuthModal: React.FC = () => {
  const {
    authed,
    authMode,
    authRoleTab,
    setAuthRoleTab,
    setAuthMode,
    login,
    signup,
    continueAsGuest,
  } = usePortal();

  // Login form refs
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form refs
  const [signupName, setSignupName] = useState('');
  const [signupId, setSignupId] = useState('');
  const [signupDept, setSignupDept] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  if (authed) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(loginId || '011 231 042', loginPassword);
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signup(
      signupName || 'UIU Student',
      signupId || '011 231 999',
      signupDept || 'Computer Science & Engineering',
      signupPassword
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-white"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center font-bold text-lg mx-auto mb-3 shadow-lg shadow-orange-500/20">
              UIU
            </div>
            <h2 className="text-2xl font-bold tracking-tight">UIU Lost &amp; Found Portal</h2>
            <p className="text-sm text-slate-400 mt-1">Sign in with your UIU account to get started</p>
          </div>

          {/* Role Tab Toggle (Student vs Admin) */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl mb-6 border border-slate-700/50">
            <button
              type="button"
              onClick={() => setAuthRoleTab('student')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                authRoleTab === 'student'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Student Portal
            </button>
            <button
              type="button"
              onClick={() => setAuthRoleTab('admin')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                authRoleTab === 'admin'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Admin Desk
            </button>
          </div>

          {/* Login Form */}
          {authMode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {authRoleTab === 'admin' ? 'Admin ID / Email' : 'Student ID / Email'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={authRoleTab === 'admin' ? 'admin@admin.uiu.ac.bd' : '011 231 042'}
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-sm shadow-lg shadow-orange-500/25 transition-all mt-2"
              >
                Sign In to Portal
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                <span>Don&apos;t have an account?</span>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className="text-amber-400 font-medium hover:underline"
                >
                  Create Account
                </button>
              </div>
            </form>
          ) : (
            /* Signup Form */
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Tanvir Rahman"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {authRoleTab === 'admin' ? 'Admin ID' : 'Student ID'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={authRoleTab === 'admin' ? 'ADM-9021' : '011 231 042'}
                  value={signupId}
                  onChange={(e) => setSignupId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Department</label>
                <input
                  type="text"
                  required
                  placeholder="Computer Science & Engineering"
                  value={signupDept}
                  onChange={(e) => setSignupDept(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-sm shadow-lg shadow-orange-500/25 transition-all mt-2"
              >
                Complete Registration
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Already registered?</span>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-amber-400 font-medium hover:underline"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* Guest Entry Button */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={continueAsGuest}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors underline"
            >
              Continue as Guest (Browse Only)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
