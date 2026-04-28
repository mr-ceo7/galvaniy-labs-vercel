/**
 * LabBriefing — "Experiment Mission Briefing" screen.
 * Pixel-matched to the Stitch HUD design: 3 frosted-glass columns over
 * a blurred lab-photo background. Full-viewport overlay — no parent chrome.
 */
import React, { useState } from 'react';
import type { KitDefinition, ApparatusItem } from '../engine/core/types';
import { ArrowRight, FlaskConical, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './HUD.css';

interface LabBriefingProps {
  definition: KitDefinition;
  onEnterLab: () => void;
}

/* ── Apparatus info popover (white card, like the Stitch mockup) ── */
const ApparatusPopover: React.FC<{
  item: ApparatusItem;
  onClose: () => void;
}> = ({ item, onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 8 }}
    className="mb-popover"
    onClick={(e) => e.stopPropagation()}
  >
    <button className="mb-popover-close" onClick={onClose}><X size={14} /></button>
    <h4 className="mb-popover-name">{item.name}</h4>

    <div className="mb-popover-field">
      <span className="mb-popover-label">What it is:</span>
      <p>{item.description}</p>
    </div>

    {item.learnMore && (
      <div className="mb-popover-field">
        <span className="mb-popover-label">Controls:</span>
        <p>{item.learnMore}</p>
      </div>
    )}

    {item.precision && (
      <div className="mb-popover-field">
        <span className="mb-popover-label">Precision:</span>
        <p>{item.precision}</p>
      </div>
    )}
  </motion.div>
);

export const LabBriefing: React.FC<LabBriefingProps> = ({ definition, onEnterLab }) => {
  const [selectedApparatus, setSelectedApparatus] = useState<string | null>(null);
  const selectedItem = definition.apparatus.find(a => a.id === selectedApparatus);

  return (
    <div className="mb-root">
      {/* ── Full-bleed lab background ── */}
      <div className="mb-bg">
        <img
          src={definition.heroImage || '/assets/lab/backgrounds/lab_room.png'}
          alt=""
          className="mb-bg-img"
        />
      </div>
      <div className="mb-bg-vignette" />

      {/* ── Title (directly on background) ── */}
      <h1 className="mb-title">Experiment Mission Briefing</h1>

      {/* ── 3-Column Glass Layout ── */}
      <div className="mb-grid">

        {/* ═══ LEFT: Objectives & Theory ═══ */}
        <div className="mb-panel mb-panel-left">
          <h2 className="mb-panel-heading">Objectives &amp; Theory</h2>

          <h3 className="mb-section-heading">Objectives</h3>
          <ul className="mb-obj-list">
            {definition.objective.split('.').filter(Boolean).map((obj, i) => (
              <li key={i}>{obj.trim()}</li>
            ))}
          </ul>

          <h3 className="mb-section-heading">Theory</h3>
          <div className="mb-theory">
            {definition.theory.split('\n\n').map((para, i) => (
              <p key={i}>
                {para.split(/(\*\*.*?\*\*)/).map((part, j) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <code key={j} className="mb-eq">{part.slice(2, -2)}</code>;
                  }
                  return <span key={j}>{part}</span>;
                })}
              </p>
            ))}
          </div>

          {definition.safetyNotes.length > 0 && (
            <>
              <h3 className="mb-section-heading mb-section-heading--warn">Safety</h3>
              <ul className="mb-safety-list">
                {definition.safetyNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* ═══ CENTER: Apparatus Catalog ═══ */}
        <div className="mb-panel mb-panel-center">
          <h2 className="mb-panel-heading mb-panel-heading--center">Apparatus Catalog</h2>

          <div className="mb-apparatus-grid">
            {definition.apparatus.map((item, i) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * i, duration: 0.25 }}
                className={`mb-apparatus-card ${selectedApparatus === item.id ? 'mb-apparatus-card--active' : ''}`}
                onClick={() => setSelectedApparatus(selectedApparatus === item.id ? null : item.id)}
              >
                <div className="mb-apparatus-thumb">
                  {item.image ? (
                    <img src={item.image} alt={item.name} />
                  ) : (
                    <span className="mb-apparatus-emoji">{item.icon}</span>
                  )}
                </div>
                <span className="mb-apparatus-label">{item.name}</span>
              </motion.button>
            ))}
          </div>

          {/* Popover */}
          <AnimatePresence>
            {selectedItem && (
              <ApparatusPopover
                item={selectedItem}
                onClose={() => setSelectedApparatus(null)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ═══ RIGHT: Proceed ═══ */}
        <div className="mb-panel mb-panel-right">
          <h2 className="mb-panel-heading mb-panel-heading--center">Proceed</h2>

          <div className="mb-proceed-body">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onEnterLab}
              className="mb-proceed-btn"
            >
              Proceed to<br />Workbench
            </motion.button>

            <button className="mb-proceed-secondary">
              Review Previous Experiments
            </button>

            {definition.commonQuestions.length > 0 && (
              <div className="mb-think">
                <p className="mb-think-heading">Before you start, think about:</p>
                <ul className="mb-think-list">
                  {definition.commonQuestions.slice(0, 3).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
