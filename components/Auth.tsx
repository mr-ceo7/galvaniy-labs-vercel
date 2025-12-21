import React, { useState } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';
import { Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const handleGoogleSignIn = async (isRetry = false) => {
    if (!isRetry) {
      setRetryCount(0);
    }
    
    setError('');
    setLoading(true);

    try {
      console.log('[Auth] Attempting Google Sign-In...');
      const user = await authService.signInWithGoogle();
      console.log('[Auth] Sign-in successful, logging in user');
      
      // Keep loading state while calling onLogin to ensure smooth transition
      onLogin(user);
      
      // Don't set loading to false here - let App.tsx handle it
    } catch (err: any) {
      console.error('[Auth] Sign-in error:', err);
      
      // Handle popup blocker specifically
      if (err.message.includes('popup') || err.message.includes('Popup')) {
        setError(err.message + ' Please allow popups and click the button again.');
        setLoading(false);
      } 
      // Handle user cancellation
      else if (err.message.includes('cancelled') || err.message.includes('closed')) {
        setError('Sign-in was cancelled. Please try again.');
        setLoading(false);
      }
      // Retry for other errors
      else if (retryCount < maxRetries) {
        console.log(`[Auth] Retrying... (${retryCount + 1}/${maxRetries})`);
        setRetryCount(retryCount + 1);
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return handleGoogleSignIn(true);
      } 
      // Max retries reached
      else {
        setError(err.message || 'Sign-in failed after multiple attempts. Please refresh and try again.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-6 md:p-8 rounded-2xl w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-3">
            Hello! Comrade
          </h1>
          <h2 className="text-xl font-semibold text-white mb-2">Welcome Back</h2>
          <p className="text-slate-400 text-sm">
            Sign in with your student account 
          </p>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-red-400 bg-red-900/20 p-3 rounded-lg text-sm mb-6"
            >
              <AlertCircle size={16} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google Sign In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-4 bg-white hover:bg-gray-100 text-gray-800 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed min-h-[56px] shadow-lg"
        >
          {loading ? (
            <Loader2 className="animate-spin text-blue-600" size={24} />
          ) : (
            <>
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-base">Sign in with Google</span>
            </>
          )}
        </button>

        {/* Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Your account will be created automatically on first sign-in
          </p>
        </div>
      </motion.div>
    </div>
  );
};