'use client';

import React, { useState } from 'react';
import { usePortal } from '@/context/PortalContext';
import { motion } from 'framer-motion';

export const ReportFoundView: React.FC = () => {
  const { categories, submitFoundForm, goTo } = usePortal();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || 'Electronics');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [hiddenDetail, setHiddenDetail] = useState('');
  const [photo, setPhoto] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitFoundForm(title, category, location, date, description, hiddenDetail, photo);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 text-white shadow-2xl space-y-6"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">Report Found Item</h2>
          <p className="text-xs text-slate-400 mt-1">Hand in an item you found on campus for admin approval &amp; owner verification.</p>
        </div>
        <button
          type="button"
          onClick={() => goTo('browse')}
          className="text-xs text-slate-400 hover:text-white"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Item Title *</label>
          <input
            type="text"
            required
            placeholder="e.g. Wireless Earbuds in White Case"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
            >
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Date Found *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Exact Spot Found *</label>
          <input
            type="text"
            required
            placeholder="e.g. UIU Cafeteria table near window"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-300">Public Description *</label>
            <span className="text-[11px] text-slate-500">{description.length}/300</span>
          </div>
          <textarea
            required
            maxLength={300}
            rows={3}
            placeholder="General visible description for everyone on the counter..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-amber-400">
              Private Held-Back Detail (Verification Feature) *
            </label>
            <span className="text-[11px] text-slate-500">{hiddenDetail.length}/200</span>
          </div>
          <textarea
            required
            maxLength={200}
            rows={2}
            placeholder="A mark, scratch, engraving, or content only the true owner would know..."
            value={hiddenDetail}
            onChange={(e) => setHiddenDetail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-amber-500/50 text-white text-sm focus:outline-none focus:border-amber-500"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Keep this detail secret. Only admins verify claims against this exact information.
          </p>
        </div>

        {/* Photo Upload Dropzone */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Upload Photo (Optional)</label>
          <div className="relative border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-800/40">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {photo ? (
              <div className="flex items-center justify-center gap-3">
                <img src={photo} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                <span className="text-xs text-emerald-400 font-medium">Photo attached successfully</span>
              </div>
            ) : (
              <div className="text-xs text-slate-400 space-y-1">
                <div className="text-xl">📷</div>
                <div>Click or drag an image here to upload</div>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 text-white font-semibold text-sm shadow-lg shadow-orange-500/25 transition-all mt-4"
        >
          Send to Admin Queue for Approval
        </button>
      </form>
    </motion.div>
  );
};
