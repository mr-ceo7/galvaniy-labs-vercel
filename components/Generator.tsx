import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';
import { User, Report, Theme } from '../types';
import { Zap, Loader2, AlertCircle, Network } from 'lucide-react';
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
  const [currentProvider, setCurrentProvider] = useState<'gemini' | 'custom'>('gemini');

  useEffect(() => {
    setCurrentProvider(apiService.getProvider());
    // Listen for storage changes (when admin switches API)
    const handleStorageChange = () => {
      setCurrentProvider(apiService.getProvider());
    };
    window.addEventListener('storage', handleStorageChange);
    // Also check periodically in case of same-tab changes
    const interval = setInterval(() => {
      setCurrentProvider(apiService.getProvider());
    }, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

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

    if (!storageService.checkDailyLimit(user.email)) {
      setError('You have reached your daily limit of 3 reports.');
      return;
    }

    setLoading(true);
    try {
      const content = await apiService.generateLabReport(trimmedCode);
      
      try {
        JSON.parse(content);
      } catch (jsonErr) {
        throw new Error("AI generated invalid data structure. Please try again.");
      }

      const newReport: Report = {
        id: Date.now().toString(),
        experimentCode: trimmedCode.toUpperCase(),
        date: new Date().toISOString(),
        content
      };

      storageService.saveReport(user.email, newReport);
      storageService.incrementDailyLimit(user.email);
      onReportGenerated(newReport);
      setCode('');
    } catch (err: any) {
      setError(err.message || 'Generation failed.');
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
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
              currentProvider === 'gemini' 
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
            }`}>
              <Network size={12} />
              {currentProvider === 'gemini' ? 'Gemini' : 'Custom API'}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full ${remaining > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
              {user.role === 'admin' ? 'Unlimited Access' : `${remaining} credits left today`}
            </span>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="flex flex-col gap-4">
          <div className="relative">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter Experiment Code (e.g., A-2, CHEM-101)"
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
              <><Loader2 className="animate-spin" /> Analyzing Manual & Diagrams...</>
            ) : (
              'Generate Report'
            )}
          </button>
        </form>
        <p className="text-slate-500 text-xs text-center mt-4">
          The AI references the <b>Admin Uploaded Manual</b> (text & images) to generate this report.
        </p>
      </motion.div>
    </div>
  );
};