import React, { useState } from 'react';
import { generateLabReport } from '../services/geminiService';
import { storageService } from '../services/storageService';
import { User, Report, Theme } from '../types';
import { Zap, Loader2, AlertCircle, Image as ImageIcon, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface GeneratorProps {
  user: User;
  onReportGenerated: (report: Report) => void;
  theme?: Theme;
}

export const Generator: React.FC<GeneratorProps> = ({ user, onReportGenerated, theme }) => {
  const [code, setCode] = useState('');
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dailyCount = storageService.getDailyCount(user.email);
  const remaining = 3 - dailyCount;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedCode = code.trim();

    if (!trimmedCode) {
      setError('Please enter an experiment code.');
      return;
    }

    const codeRegex = /^[a-zA-Z0-9-]+$/;
    if (!codeRegex.test(trimmedCode)) {
      setError('Invalid format. Use alphanumeric codes e.g. "A-2" or "CHEM-101".');
      return;
    }

    if (!storageService.checkDailyLimit(user.email)) {
      setError('You have reached your daily limit of 3 reports.');
      return;
    }

    setLoading(true);
    try {
      // Pass imageFile (base64) to the service
      const content = await generateLabReport(trimmedCode, imageFile || undefined);
      
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
      setImageFile(null);
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
              placeholder="Enter Experiment Code (e.g., A-2, CHEM-101)"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-lg text-white focus:outline-none focus:border-blue-500 transition-colors uppercase placeholder:normal-case"
            />
          </div>

          {/* Image Upload Area */}
          <div className="flex flex-col gap-2">
             <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider ml-1">
                Optional: Upload Diagram
             </label>
             {!imageFile ? (
               <label className="w-full border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-xl p-4 flex items-center justify-center gap-3 cursor-pointer transition-colors bg-slate-900/30 hover:bg-slate-900/50">
                 <ImageIcon className="text-slate-500" />
                 <span className="text-sm text-slate-400">Click to upload diagram/photo of experiment</span>
                 <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
               </label>
             ) : (
               <div className="relative w-full h-32 bg-slate-900/50 rounded-xl overflow-hidden border border-blue-500/30">
                 <img src={imageFile} alt="Preview" className="w-full h-full object-contain opacity-80" />
                 <button 
                    type="button" 
                    onClick={clearImage}
                    className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-red-500/80 rounded-full text-white transition-colors"
                 >
                   <X size={16} />
                 </button>
                 <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white flex items-center gap-1">
                   <ImageIcon size={12} /> Image Attached
                 </div>
               </div>
             )}
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
              <><Loader2 className="animate-spin" /> Analyzing Text & Diagrams...</>
            ) : (
              'Generate Report'
            )}
          </button>
        </form>

        <p className="text-slate-500 text-xs text-center mt-4">
          <b>Note:</b> If the experiment relies on a specific circuit diagram, please upload a photo of it above for best results.
        </p>
      </motion.div>
    </div>
  );
};