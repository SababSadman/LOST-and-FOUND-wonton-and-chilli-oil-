'use client';

import React from 'react';
import { PortalProvider, usePortal } from '@/context/PortalContext';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { AuthModal } from '@/components/AuthModal';
import { Toast } from '@/components/Toast';

import { DashboardView } from '@/components/views/DashboardView';
import { BrowseView } from '@/components/views/BrowseView';
import { ItemDetailView } from '@/components/views/ItemDetailView';
import { ReportLostView } from '@/components/views/ReportLostView';
import { ReportFoundView } from '@/components/views/ReportFoundView';
import { MyDeskView } from '@/components/views/MyDeskView';
import { MessagesView } from '@/components/views/MessagesView';
import { NotificationsView } from '@/components/views/NotificationsView';
import { ProfileView } from '@/components/views/ProfileView';
import { AdminView } from '@/components/views/AdminView';

import { motion, AnimatePresence } from 'framer-motion';

function PortalContent() {
  const { view } = usePortal();

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <DashboardView />;
      case 'browse':
        return <BrowseView />;
      case 'item-detail':
        return <ItemDetailView />;
      case 'report-lost':
        return <ReportLostView />;
      case 'report-found':
        return <ReportFoundView />;
      case 'claims':
        return <MyDeskView />;
      case 'messages':
        return <MessagesView />;
      case 'notifications':
        return <NotificationsView />;
      case 'profile':
        return <ProfileView />;
      case 'admin':
        return <AdminView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AuthModal />
      <Toast />
    </div>
  );
}

export function NativePortal() {
  return (
    <PortalProvider>
      <PortalContent />
    </PortalProvider>
  );
}
