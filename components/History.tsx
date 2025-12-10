import React from 'react';
import { Report, Theme } from '../types';
import { Clock, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface HistoryProps {
  reports: Report[];
  onSelect: (report: Report) => void;
  theme?: Theme;
}

export const History: React.FC<HistoryProps> = ({ reports, onSelect, theme }) => {
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
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Clock size={18} /> Recent Reports
      </h3>
      <div className="space-y-3">
        {reports.map((report, idx) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => onSelect(report)}
            className="glass-panel p-4 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group flex items-center justify-between"
          >
            <div>
              <p className={`font-bold ${theme?.accent}`}>{report.experimentCode}</p>
              <p className="text-xs text-slate-400">{new Date(report.date).toLocaleDateString()}</p>
            </div>
            <ChevronRight className="text-slate-600 group-hover:text-white transition-colors" size={16} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};