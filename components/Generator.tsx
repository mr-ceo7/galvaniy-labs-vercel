import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';
import { backendService } from '../services/backendService';
import { logService } from '../services/logService';
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
  const [manualName, setManualName] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Fetch manual metadata from backend
    const loadManualName = async () => {
      try {
        const metadata = await backendService.getManualMetadata();
        if (metadata) {
          setManualName(metadata.name);
        }
      } catch (err) {
        logService.error('Failed to load manual metadata:', err);
      }
    };
    loadManualName();

    // Calculate remaining credits from user profile
    const dailyCount = storageService.getDailyCount(user.email);
    const defaultLimit = 3;
    const userLimit = user.customLimit !== undefined ? user.customLimit : defaultLimit;
    setRemaining(userLimit - dailyCount);
  }, [user]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedCode = code.trim();

    if (!trimmedCode) {
      setError('Please enter an experiment code.');
      return;
    }

    setLoading(true);
    try {
      // Backend handles: rate limiting, manual fetching, AI generation, Firestore storage
      const report = await apiService.generateLabReport(trimmedCode);

      // Cache report locally for History sidebar
      storageService.saveReport(user.email, report);
      storageService.incrementDailyLimit(user.email);

      // Update remaining credits
      const dailyCount = storageService.getDailyCount(user.email);
      const userLimit = user.customLimit !== undefined ? user.customLimit : 3;
      setRemaining(userLimit - dailyCount);

      onReportGenerated(report);
      setCode('');
    } catch (err: any) {
      setError(err.message || 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const creditsRemaining = remaining ?? 0;

  return (
    <div className="w-full max-w-2xl mx-auto mt-4 md:mt-8 px-3 md:px-0">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-panel p-4 md:p-6 rounded-2xl"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2">
            <Zap className={theme?.accent} size={20} /> Generate Report
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs px-2 md:px-3 py-1 rounded-full ${creditsRemaining > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
              {user.role === 'admin' ? 'Unlimited Access' : `${creditsRemaining} credits left today`}
            </span>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="flex flex-col gap-3 md:gap-4">
          <div className="relative">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter Experiment Code (e.g., A-2, B-6, C-9)"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 md:p-4 text-base md:text-lg text-white focus:outline-none focus:border-blue-500 transition-colors uppercase placeholder:normal-case min-h-[48px]"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-900/20 p-3 rounded-lg text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (creditsRemaining <= 0 && user.role !== 'admin')}
            className={`w-full py-3 md:py-4 min-h-[48px] md:min-h-[56px] rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${loading || (creditsRemaining <= 0 && user.role !== 'admin') ? 'bg-slate-700 opacity-50 cursor-not-allowed' : `bg-gradient-to-r ${theme?.primary} shadow-${theme?.accent.split('-')[1]}-500/30`}`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                <div className="relative min-w-[180px]">
                  {['Fetching Manual...',
                    'Analyzing Manual...',
                    'Extracting Steps...',
                    'Thinking...',
                    'Generating Report...',
                    'Let me cook...',
                    'Assembling virtual Apparatus...',
                    'Hacking NASA data...',
                    'Assembling virtual Apparatus...',
                    'Analyzing virtual data...',
                    'Analyzing virtual data...',
                    'Finishing...',
                    'Almost there...',
                    'Finishing...',
                    'Thinking...',
                    'Wraping up...',
                    'Finishing...',
                    'Finishing...',
                    'Taking longer than expected...',
                    'Rewriting everything in Rust...',
                    '...for absolutly no reason',
                    'Finishing...'
                  ].map((text, i, arr) => {
                    const isLastMessage = i === arr.length - 1;
                    return (
                      <motion.span
                        key={text}
                        className="absolute inset-0 flex items-center justify-center whitespace-nowrap"
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: isLastMessage ? [0, 1, 1] : [0, 1, 1, 0]
                        }}
                        transition={{
                          duration: isLastMessage ? 2 : 2,
                          delay: i * 2,
                          times: isLastMessage ? [0, 0.1, 1] : [0, 0.1, 0.9, 1]
                        }}
                      >
                        {text}
                      </motion.span>
                    );
                  })}
                </div>
              </>
            ) : (
              'Generate Report'
            )}
          </button>
        </form>
        <p className="text-slate-500 text-xs text-center mt-4">
          The AI references {manualName ? (
            <b>{manualName}</b>
          ) : (
            <>the <b>Admin Uploaded Manual</b></>
          )} to generate this report.The AI can make mistakes please double check.
        </p>
      </motion.div>
    </div>
  );
};