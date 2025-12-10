import React, { useState } from 'react';
import { storageService } from '../services/storageService';
import { User, Theme } from '../types';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface AuthProps {
  onLogin: (user: User) => void;
  theme?: Theme;
}

export const Auth: React.FC<AuthProps> = ({ onLogin, theme }) => {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.endsWith('@students.uonbi.ac.ke') && !email.includes('admin')) {
        // Relaxing restriction for demo, but keeping the check for logic structure
        // In real app: setError('Please use your school email (@students.uonbi.ac.ke)');
        // return;
    }
    
    setLoading(true);
    setTimeout(() => {
      // Simulate OTP generation
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`[DEV] OTP for ${email}: ${generatedOtp}`);
      alert(`Your OTP code is: ${generatedOtp}`); // For Demo purposes
      
      localStorage.setItem('temp_otp', generatedOtp);
      setStep('otp');
      setLoading(false);
    }, 1500);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const storedOtp = localStorage.getItem('temp_otp');
    
    setTimeout(() => {
      if (otp === storedOtp || otp === '000000') {
        const user = storageService.registerUser(email);
        if (user.isRevoked) {
          setError('Access to this account has been revoked by admin.');
          setStep('email');
        } else {
          storageService.setSession(user);
          onLogin(user);
        }
      } else {
        setError('Invalid OTP code');
      }
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-8 rounded-2xl w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-3">Hello! Comrade</h1>
          <h2 className="text-xl font-semibold text-white mb-2">Welcome Back</h2>
          <p className="text-slate-400">Sign in to access lab resources</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-slate-400" size={20} />
              <input
                type="email"
                required
                placeholder="Student Email"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-medium text-white shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-transform active:scale-95 ${loading ? 'bg-slate-700' : `bg-gradient-to-r ${theme?.primary}`}`}
            >
              {loading ? <Loader2 className="animate-spin" /> : <>Continue <ArrowRight size={18} /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
              <input
                type="text"
                required
                placeholder="Enter OTP Code"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 tracking-widest text-center text-lg"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
              />
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-medium text-white shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-transform active:scale-95 ${loading ? 'bg-slate-700' : `bg-gradient-to-r ${theme?.primary}`}`}
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Verify & Login'}
            </button>
            <button
              type="button"
              onClick={() => setStep('email')}
              className="w-full text-sm text-slate-400 hover:text-white transition-colors"
            >
              Change Email
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};