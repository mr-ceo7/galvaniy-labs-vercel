import React from 'react';
import type { LabControl } from '../engine/core/types';
import { Timer } from 'lucide-react';

interface InstrumentPanelProps {
  controls: LabControl[];
  values: Record<string, number>;
  onChange: (id: string, value: number) => void;
}

export const InstrumentPanel: React.FC<InstrumentPanelProps> = ({ controls, values, onChange }) => {
  if (controls.length === 0) {
    return null;
  }

  return (
    <div className="vlab-controls">
      <h3 className="vlab-section-title">
        <Timer size={14} /> Controls
      </h3>
      <div className="vlab-controls-grid">
        {controls.map((ctrl) => (
          <div key={ctrl.id} className="vlab-control-item">
            <div className="vlab-control-label">
              <span>{ctrl.label}</span>
              <span className="vlab-control-value">
                {values[ctrl.id]?.toFixed(ctrl.step && ctrl.step < 1 ? 1 : 0)} {ctrl.unit}
              </span>
            </div>
            <input
              type="range"
              min={ctrl.min}
              max={ctrl.max}
              step={ctrl.step}
              value={values[ctrl.id] ?? ctrl.value}
              onChange={(e) => onChange(ctrl.id, parseFloat(e.target.value))}
              className="vlab-slider"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
