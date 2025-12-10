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
      <div className="flex-grow w-full max-w-6xl mx-auto p-4 md:p-6 flex flex-col">
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            // Pass theme prop to children
            return React.cloneElement(child, { theme } as any);
          }
          return child;
        })}
      </div>

      {/* Floating Support Button */}
      <a
        href="https://www.instagram.com/it.exper7"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 p-3.5 bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 rounded-full shadow-lg shadow-purple-500/30 hover:scale-110 hover:shadow-purple-500/50 transition-all duration-300 group"
        title="Contact Support"
      >
        <Instagram className="text-white w-6 h-6 group-hover:rotate-12 transition-transform" />
      </a>
      
      <footer className="w-full p-4 text-center text-white/40 text-sm border-t border-white/5 backdrop-blur-md">
        <p>&copy; {new Date().getFullYear()} Galvaniy Technologies. All rights reserved.</p>
        <p className="text-xs mt-1">University of Nairobi Physics Lab Companion</p>
      </footer>
    </div>
  );
};