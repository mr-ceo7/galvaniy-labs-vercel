import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Atom } from 'lucide-react';

export const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const onCompleteRef = useRef(onComplete);
  
  // Keep ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    console.log('[SplashScreen] Component mounted, starting timer...');
    // Timer to complete splash screen
    const timer = setTimeout(() => {
      console.log('[SplashScreen] Timer completed, calling onComplete');
      try {
        onCompleteRef.current();
      } catch (error) {
        console.error('[SplashScreen] Error calling onComplete:', error);
      }
    }, 2000); // 2 seconds
    
    return () => {
      console.log('[SplashScreen] Cleaning up timer');
      clearTimeout(timer);
    };
  }, []); // Only run once on mount

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center z-[9999]">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          >
            <Atom size={80} className="text-blue-500" />
          </motion.div>
          <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 rounded-full"></div>
        </div>
        
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-4xl font-bold text-white mt-6 tracking-tight"
        >
          Galvaniy <span className="text-blue-400">Technologies</span>
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-slate-400 mt-2 text-sm uppercase tracking-widest"
        >
          Physics Labs
        </motion.p>
      </motion.div>
    </div>
  );
};