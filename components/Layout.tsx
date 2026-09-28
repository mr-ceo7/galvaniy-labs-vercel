import React, { useEffect, useState } from 'react';
import { THEMES } from '../constants';
import { Instagram } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [theme, setTheme] = useState(THEMES[0]);

  useEffect(() => {
    // Pick a random theme on mount
    const randomTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
    setTheme(randomTheme);
  }, []);

  return (
    <div className={`min-h-screen w-full ${theme.gradient} transition-all duration-1000 flex flex-col relative`}>
      <main className="flex-grow w-full max-w-6xl mx-auto p-4 md:p-6 flex flex-col">
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            // Pass theme prop to children
            return React.cloneElement(child, { theme } as any);
          }
          return child;
        })}
      </main>

      <footer className="w-full p-4 border-t border-white/5 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-white/50 text-xs">
          <div>
            <p className="font-medium text-slate-300">&copy; {new Date().getFullYear()} Galvaniy Technologies. All rights reserved.</p>
            <p className="text-slate-500 mt-0.5">University of Nairobi Physics Lab Companion</p>
          </div>
          <a
            href="https://www.instagram.com/it.exper7"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/10"
            title="Contact Support"
          >
            <Instagram size={14} className="text-rose-400" />
            <span className="font-mono text-[11px] tracking-wide">SUPPORT @IT.EXPER7</span>
          </a>
        </div>
      </footer>
    </div>
  );
};