import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';
import { firestoreService } from '../services/firestoreService';
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
  const [manualName, setManualName] = useState<string | null>(null);

  useEffect(() => {
    setCurrentProvider(apiService.getProvider());

    // Fetch manual name from Firestore
    const loadManualName = async () => {
      try {
        const metadata = await firestoreService.getManualMetadata();
        if (metadata) {
          setManualName(metadata.name);
        }
      } catch (err) {
        console.error('Failed to load manual metadata:', err);
      }
    };
    loadManualName();

    // Subscribe to manual updates
    const unsubscribe = firestoreService.subscribeToManual((metadata) => {
      if (metadata) {
        setManualName(metadata.name);
      }
    });

    // Listen for storage changes (when admin switches API)
    const handleStorageChange = () => {
      setCurrentProvider(apiService.getProvider());
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically in case of same-tab changes
    const interval = setInterval(() => {
      setCurrentProvider(apiService.getProvider());
    }, 3000); // Check every 3 seconds instead of 1
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const dailyCount = storageService.getDailyCount(user.email);
  const defaultLimit = 3;
  const userLimit = user.customLimit !== undefined ? user.customLimit : defaultLimit;
  const remaining = userLimit - dailyCount;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedCode = code.trim();

    if (!trimmedCode) {
      setError('Please enter an experiment code.');
      return;
    }

    if (!storageService.checkDailyLimit(user.email)) {
      setError('You have reached your daily limit please try again later.');
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
      
      // Increment report count in Firestore
      if (user.uid) {
        await firestoreService.incrementReportCount(user.uid);
      }
      
      onReportGenerated(newReport);
      setCode('');
    } catch (err: any) {
      setError(err.message || 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

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
            <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${currentProvider === 'gemini'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              }`}>
              <Network size={12} />
              {currentProvider === 'gemini' ? 'Gemini' : 'Custom API'}
            </span>
            <span className={`text-xs px-2 md:px-3 py-1 rounded-full ${remaining > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
              {user.role === 'admin' ? 'Unlimited Access' : `${remaining} credits left today`}
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
            disabled={loading || (remaining <= 0 && user.role !== 'admin')}
            className={`w-full py-3 md:py-4 min-h-[48px] md:min-h-[56px] rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${loading || (remaining <= 0 && user.role !== 'admin') ? 'bg-slate-700 opacity-50 cursor-not-allowed' : `bg-gradient-to-r ${theme?.primary} shadow-${theme?.accent.split('-')[1]}-500/30`}`}
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