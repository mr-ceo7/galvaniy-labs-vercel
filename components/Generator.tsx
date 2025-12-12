import React, { useState } from 'react';
import { generateLabReport } from '../services/geminiService';
import { storageService } from '../services/storageService';
import { User, Report, Theme } from '../types';
import { Zap, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface GeneratorProps {
  user: User;
  onReportGenerated: (report: Report) => void;
  theme?: Theme;
}

export const Generator: React.FC<GeneratorProps> = ({ user, onReportGenerated, theme }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dailyCount = storageService.getDailyCount(user.email);
  const remaining = 3 - dailyCount;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedCode = code.trim();

    if (!trimmedCode) {
      setError('Please enter an experiment code.');
      return;
    }

    // Validate format: Letter(s)-Number(s) e.g., A-2, B-7, C-12
    const codeRegex = /^[a-zA-Z]+-\d+$/;
    if (!codeRegex.test(trimmedCode)) {
      setError('Invalid format. Please use format like "A-2", "B-7" or "C-12".');
      return;
    }

    if (!storageService.checkDailyLimit(user.email)) {
      setError('You have reached your daily limit of 3 reports.');
      return;
    }

    setLoading(true);
    try {
      const content = await generateLabReport(trimmedCode);

      // Validate JSON
      try {
        JSON.parse(content);
      } catch (jsonErr) {
        throw new Error("AI generated invalid data structure. Please try again.");
      }

      const newReport: Report = {
        id: Date.now().toString(),
        experimentCode: trimmedCode.toUpperCase(),
        date: new Date().toISOString(),
        content // Now stores JSON string
      };

      storageService.saveReport(user.email, newReport);
      storageService.incrementDailyLimit(user.email);
      onReportGenerated(newReport);
      setCode('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Generation failed.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-panel p-6 rounded-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className={theme?.accent} /> Generate Report
          </h2>
          <span className={`text-xs px-3 py-1 rounded-full ${remaining > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
            {user.role === 'admin' ? 'Unlimited Access' : `${remaining} credits left today`}
          </span>
        </div>

        <form onSubmit={handleGenerate} className="flex flex-col gap-4">
          <div className="relative">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter your experiment code to instantly generate a comprehensive report."
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-lg text-white focus:outline-none focus:border-blue-500 transition-colors uppercase placeholder:normal-case"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-900/20 p-3 rounded-lg text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (remaining <= 0 && user.role !== 'admin')}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${loading || (remaining <= 0 && user.role !== 'admin') ? 'bg-slate-700 opacity-50 cursor-not-allowed' : `bg-gradient-to-r ${theme?.primary} shadow-${theme?.accent.split('-')[1]}-500/30`}`}
          >
            {loading ? (
              <><Loader2 className="animate-spin" /> Generating Interactive Report...</>
            ) : (
              'Generate Report'
            )}
          </button>
        </form>

        <p className="text-slate-500 text-xs text-center mt-4">
          The AI references the 2025 Edition Manual. Now generates <b>Interactive HTML</b> with editable data & simulations.
        </p>
      </motion.div>
    </div>
  );
};