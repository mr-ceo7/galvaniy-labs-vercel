import React, { useState } from 'react';
import { Report, Theme } from '../types';
import { Clock, ChevronRight, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logService } from '../services/logService';

interface HistoryProps {
  reports: Report[];
  onSelect: (report: Report) => void;
  onDelete?: (reportId: string) => void;
  onClearAll?: () => void;
  theme?: Theme;
}

export const History: React.FC<HistoryProps> = ({ reports, onSelect, onDelete, onClearAll, theme }) => {
  const [confirmClear, setConfirmClear] = useState(false);

  if (reports.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Clock className="mx-auto mb-2 opacity-50" size={32} />
        <p>No history yet</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock size={18} /> Recent Reports
          <span className="text-xs text-slate-500 font-normal">({reports.length})</span>
        </h3>
        {onClearAll && (
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {confirmClear && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-xs text-red-400">Delete all?</span>
                  <button
                    onClick={() => { onClearAll(); setConfirmClear(false); }}
                    className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-400 hover:bg-slate-700 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            {!confirmClear && (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-1"
                title="Clear all reports"
              >
                <Trash2 size={12} /> Clear All
              </button>
            )}
          </div>
        )}
      </div>
      <div className="space-y-3">
        {reports.map((report, idx) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="glass-panel p-4 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group flex items-center justify-between"
          >
            <div className="flex-1 min-w-0" onClick={() => onSelect(report)}>
              <p className={`font-bold ${theme?.accent}`}>{report.experimentCode}</p>
              <p className="text-xs text-slate-400">{new Date(report.date).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(report.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Delete report"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <ChevronRight
                className="text-slate-600 group-hover:text-white transition-colors"
                size={16}
                onClick={() => onSelect(report)}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};