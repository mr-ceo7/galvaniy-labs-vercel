import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Check if user previously dismissed
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      const dismissedDate = dismissed ? new Date(dismissed) : null;
      const daysSinceDismiss = dismissedDate 
        ? (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;
      
      // Show again after 7 days
      if (!dismissed || daysSinceDismiss > 7) {
        // Delay showing prompt by 10 seconds after page load
        setTimeout(() => setShowPrompt(true), 10000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`Install prompt outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowPrompt(false);
    
    if (outcome === 'accepted') {
      localStorage.removeItem('pwa-install-dismissed');
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-slate-800/95 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl z-50 animate-in slide-in-from-bottom">
      <div className="flex items-start gap-3">
        <div className="bg-blue-500/20 p-2 rounded-lg flex-shrink-0">
          <Download className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-white mb-1">Install Galvaniy Labs</h3>
          <p className="text-sm text-slate-400">
            Access reports offline and get a native app experience on your device
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
          aria-label="Dismiss install prompt"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleInstall}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
        >
          Install App
        </button>
        <button
          onClick={handleDismiss}
          className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
};
