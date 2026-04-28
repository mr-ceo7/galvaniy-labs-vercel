/**
 * PhaseNavigator — Dot-style progress stepper for lab phases.
 * Replaces the tab bar with a sequential flow indicator.
 * Mobile-optimized compact design.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, FlaskConical, BarChart3, FileText } from 'lucide-react';

export type LabPhase = 'briefing' | 'experiment' | 'analysis' | 'report';

interface PhaseNavigatorProps {
  currentPhase: LabPhase;
  onPhaseChange: (phase: LabPhase) => void;
  /** Phases that have been completed. */
  completedPhases: Set<LabPhase>;
  /** Whether the briefing has a kit definition (enables briefing phase). */
  hasBriefing: boolean;
}

const PHASES: { id: LabPhase; icon: typeof ClipboardList; label: string; shortLabel: string }[] = [
  { id: 'briefing', icon: ClipboardList, label: 'Briefing', shortLabel: '📋' },
  { id: 'experiment', icon: FlaskConical, label: 'Experiment', shortLabel: '⚗️' },
  { id: 'analysis', icon: BarChart3, label: 'Analysis', shortLabel: '📊' },
  { id: 'report', icon: FileText, label: 'Report', shortLabel: '📝' },
];

export const PhaseNavigator: React.FC<PhaseNavigatorProps> = ({
  currentPhase,
  onPhaseChange,
  completedPhases,
  hasBriefing,
}) => {
  const visiblePhases = hasBriefing ? PHASES : PHASES.filter(p => p.id !== 'briefing');

  return (
    <div className="phase-nav">
      {visiblePhases.map((phase, index) => {
        const isActive = currentPhase === phase.id;
        const isCompleted = completedPhases.has(phase.id);
        const isReachable = isCompleted || isActive || 
          (index === 0) || 
          completedPhases.has(visiblePhases[index - 1]?.id);

        return (
          <React.Fragment key={phase.id}>
            {index > 0 && (
              <div className={`phase-nav-line ${isCompleted || isActive ? 'phase-nav-line-active' : ''}`} />
            )}
            <button
              onClick={() => isReachable && onPhaseChange(phase.id)}
              className={`phase-nav-dot ${isActive ? 'phase-nav-dot-active' : ''} ${isCompleted ? 'phase-nav-dot-completed' : ''} ${!isReachable ? 'phase-nav-dot-locked' : ''}`}
              title={phase.label}
              disabled={!isReachable}
            >
              {isActive && (
                <motion.div
                  layoutId="phase-indicator"
                  className="phase-nav-indicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="phase-nav-icon">
                {isCompleted ? '✓' : <phase.icon size={14} />}
              </span>
              <span className="phase-nav-label">{phase.label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};
