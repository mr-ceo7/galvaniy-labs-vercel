/**
 * LabBrowser — Experiment catalog showing all available virtual lab kits.
 * Groups by category with search/filter.
 */
import React, { useState, useMemo } from 'react';
import { KitRegistry } from '../engine/apparatus/KitRegistry';
import { FlaskConical, Search, ChevronRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import './VirtualLab.css';

// Import engine so kits self-register
import '../engine/index';

interface LabBrowserProps {
  onSelectExperiment: (code: string) => void;
}

const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  mechanics: { icon: '⚙️', label: 'Mechanics' },
  heat: { icon: '🔥', label: 'Heat & Thermodynamics' },
  waves: { icon: '🌊', label: 'Waves & Sound' },
  optics: { icon: '🔦', label: 'Optics' },
  electricity: { icon: '⚡', label: 'Electricity & Magnetism' },
  nuclear: { icon: '☢️', label: 'Nuclear Physics' },
  measurement: { icon: '📏', label: 'Measurement' },
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
      <div className="vlab-browser-header">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="vlab-browser-title"
        >
          <Sparkles className="inline-block mr-2 mb-1" size={24} />
          Virtual Labs
        </motion.h1>
        <p className="vlab-browser-subtitle">
          {kits.length} interactive experiments — powered by the Galvaniy Physics Engine
        </p>
      </div>

      {/* Search */}
      <div className="px-4 mb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search experiments (e.g. 'A-2', 'pendulum', 'optics')"
            className="w-full pl-10 pr-4 py-3 text-sm bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Kit listing */}
      <div className="px-4 pb-4">
        {sortedCategories.map((cat) => {
          const meta = CATEGORY_META[cat] || { icon: '🧪', label: cat };
          const items = filtered.get(cat)!;
          return (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="vlab-category-section"
            >
              <h3 className="vlab-category-title">
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                <span className="text-slate-600 font-normal">({items.length})</span>
              </h3>
              {items.map((kit) => (
                <div
                  key={kit.experimentCode}
                  className="vlab-kit-card"
                  onClick={() => onSelectExperiment(kit.experimentCode)}
                >
                  <div className={`vlab-kit-icon ${cat}`}>
                    <FlaskConical size={20} />
                  </div>
                  <div className="vlab-kit-info">
                    <div className="vlab-kit-code">{kit.experimentCode}</div>
                    <div className="vlab-kit-name">{kit.experimentTitle}</div>
                  </div>
                  <ChevronRight size={18} className="vlab-kit-arrow" />
                </div>
              ))}
            </motion.div>
          );
        })}

        {sortedCategories.length === 0 && (
          <div className="vlab-empty-state">
            <Search size={32} className="text-slate-600 mb-2" />
            <p className="text-slate-500 text-sm">No experiments match "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
};
