import React, { useState, useMemo } from 'react';
import { KitRegistry } from '../engine/apparatus/KitRegistry';
import { 
  FlaskConical, Search, ChevronRight, Sparkles,
  Cog, Flame, Waves, Lightbulb, Zap, Radiation, Ruler, Beaker
} from 'lucide-react';
import { motion } from 'framer-motion';
import './VirtualLab.css';

// Import engine so kits self-register
import '../engine/index';

interface LabBrowserProps {
  onSelectExperiment: (code: string) => void;
}

const CATEGORY_META: Record<string, { icon: any; label: string }> = {
  mechanics: { icon: Cog, label: 'Mechanics' },
  heat: { icon: Flame, label: 'Heat & Thermodynamics' },
  waves: { icon: Waves, label: 'Waves & Sound' },
  optics: { icon: Lightbulb, label: 'Optics' },
  electricity: { icon: Zap, label: 'Electricity & Magnetism' },
  nuclear: { icon: Radiation, label: 'Nuclear Physics' },
  measurement: { icon: Ruler, label: 'Measurement' },
};

export const LabBrowser: React.FC<LabBrowserProps> = ({ onSelectExperiment }) => {
  const [search, setSearch] = useState('');

  const kits = useMemo(() => KitRegistry.listKits(), []);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, typeof kits>();
    for (const k of kits) {
      const cat = k.category || 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(k);
    }
    return map;
  }, [kits]);

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    const result = new Map<string, typeof kits>();
    for (const [cat, items] of grouped) {
      const matches = items.filter(
        k => k.experimentCode.toLowerCase().includes(q) ||
             k.experimentTitle.toLowerCase().includes(q) ||
             cat.toLowerCase().includes(q)
      );
      if (matches.length > 0) result.set(cat, matches);
    }
    return result;
  }, [grouped, search]);

  // Sort categories in logical order
  const catOrder = ['measurement', 'mechanics', 'heat', 'waves', 'optics', 'electricity', 'nuclear'];
  const sortedCategories = [...filtered.keys()].sort(
    (a, b) => (catOrder.indexOf(a) === -1 ? 99 : catOrder.indexOf(a)) -
              (catOrder.indexOf(b) === -1 ? 99 : catOrder.indexOf(b))
  );

  return (
    <div className="vlab-browser">
      <div className="vlab-browser-header relative overflow-hidden">
        {/* Subtle background glow for immersive vibe */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[100px] bg-cyan-500/20 blur-[60px] rounded-full pointer-events-none" />
        
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="vlab-browser-title flex items-center justify-center gap-3 relative z-10"
        >
          <Beaker className="text-cyan-400" size={28} />
          <span>Virtual Labs</span>
        </motion.h1>
        <p className="vlab-browser-subtitle relative z-10">
          {kits.length} interactive experiments — powered by the Galvaniy Physics Engine
        </p>
      </div>

      {/* Search */}
      <div className="px-6 mb-4">
        <div className="relative group">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search experiments (e.g. 'A-2', 'pendulum', 'optics')"
            className="w-full pl-12 pr-4 py-4 text-sm bg-slate-900/60 border border-slate-700/50 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all shadow-inner"
          />
          {search && (
             <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 bg-slate-800 px-2 py-1 rounded-md">
               {Array.from(filtered.values()).reduce((a, b) => a + b.length, 0)} results
             </div>
          )}
        </div>
      </div>

      {/* Kit listing */}
      <div className="px-6 pb-6 space-y-8">
        {sortedCategories.map((cat) => {
          const meta = CATEGORY_META[cat] || { icon: FlaskConical, label: cat };
          const Icon = meta.icon;
          const items = filtered.get(cat)!;
          return (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="vlab-category-section"
            >
              <h3 className="vlab-category-title flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50 shadow-sm">
                  <Icon size={16} className="text-cyan-400" />
                </div>
                <span className="text-slate-300 font-bold tracking-widest">{meta.label}</span>
                <div className="flex-1 h-px bg-gradient-to-r from-slate-800 to-transparent ml-2"></div>
                <span className="text-slate-500 text-xs font-bold px-2 py-0.5 bg-slate-800 rounded-full">{items.length}</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {items.map((kit) => (
                  <div
                    key={kit.experimentCode}
                    className="vlab-kit-card group"
                    onClick={() => onSelectExperiment(kit.experimentCode)}
                  >
                    <div className={`vlab-kit-icon ${cat}`}>
                      <Icon size={24} strokeWidth={1.5} />
                    </div>
                    <div className="vlab-kit-info">
                      <div className="vlab-kit-code">{kit.experimentCode}</div>
                      <div className="vlab-kit-name">{kit.experimentTitle}</div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-colors border border-transparent group-hover:border-cyan-500/30">
                      <ChevronRight size={18} className="vlab-kit-arrow" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}

        {sortedCategories.length === 0 && (
          <div className="vlab-empty-state py-12">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700">
              <Search size={28} className="text-slate-500" />
            </div>
            <h4 className="text-slate-300 font-bold text-lg">No experiments found</h4>
            <p className="text-slate-500 text-sm mt-1">Try adjusting your search terms</p>
          </div>
        )}
      </div>
    </div>
  );
};
