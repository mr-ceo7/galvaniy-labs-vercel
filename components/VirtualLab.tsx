/**
 * VirtualLab — Interactive lab workspace component.
 * Renders the physics engine canvas with controls, data table, and procedure steps.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { KitRegistry } from '../engine/apparatus/KitRegistry';
import type { ApparatusKit, DataPoint } from '../engine/apparatus/ApparatusKit';
import type { LabControl, ProcedureStep, DataTableConfig } from '../engine/core/types';
import {
  Play, Pause, RotateCcw, Zap, ChevronRight, Download,
  FlaskConical, Ruler, Timer, Table, BookOpen, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './VirtualLab.css';

// Import all kits so they self-register
import '../engine/index';

interface VirtualLabProps {
  experimentCode: string;
  onBack: () => void;
}

type LabTab = 'simulation' | 'data' | 'procedure';

export const VirtualLab: React.FC<VirtualLabProps> = ({ experimentCode, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const kitRef = useRef<ApparatusKit | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [controls, setControls] = useState<LabControl[]>([]);
  const [controlValues, setControlValues] = useState<Record<string, number>>({});
  const [dataTable, setDataTable] = useState<DataTableConfig | null>(null);
  const [collectedData, setCollectedData] = useState<DataPoint[]>([]);
  const [procedure, setProcedure] = useState<ProcedureStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState<LabTab>('simulation');
  const [kitName, setKitName] = useState('');
  const [kitCode, setKitCode] = useState('');
  const [autoRunning, setAutoRunning] = useState(false);
  const [error, setError] = useState('');

  // Initialize kit
  useEffect(() => {
    const kit = KitRegistry.resolve(experimentCode);
    if (!kit) {
      setError(`No virtual lab kit found for experiment "${experimentCode}"`);
      return;
    }
    kitRef.current = kit;
    setKitName(kit.name);
    setKitCode(kit.experimentCode);
    setControls(kit.getControls());
    setDataTable(kit.getDataTable());
    setProcedure(kit.getProcedure());

    // Initialize control values
    const vals: Record<string, number> = {};
    for (const c of kit.getControls()) {
      vals[c.id] = c.value;
    }
    setControlValues(vals);

    // Setup canvas
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const container = canvas.parentElement!;
      canvas.width = container.clientWidth;
      canvas.height = Math.min(400, container.clientWidth * 0.6);
      kit.setup(canvas);
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [experimentCode]);

  // Animation loop
  const startLoop = useCallback(() => {
    const kit = kitRef.current;
    if (!kit) return;

    const tick = () => {
      kit.getWorld().step();
      kit.renderFrame();
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handlePlayPause = () => {
    if (isRunning) {
      stopLoop();
    } else {
      startLoop();
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    stopLoop();
    setIsRunning(false);
    const kit = kitRef.current;
    if (kit && canvasRef.current) {
      kit.getWorld().resetTime();
      kit.renderFrame();
    }
  };

  const handleControlChange = (id: string, value: number) => {
    const kit = kitRef.current;
    if (!kit) return;
    setControlValues(prev => ({ ...prev, [id]: value }));
    kit.setControl(id, value);
    if (!isRunning) kit.renderFrame();
  };

  const handleMeasure = () => {
    const kit = kitRef.current;
    if (!kit) return;
    const point = kit.measure();
    setCollectedData(prev => [...prev, point]);
  };

  const handleAutoRun = () => {
    const kit = kitRef.current;
    if (!kit) return;
    setAutoRunning(true);
    // Run in a timeout to let the UI update
    setTimeout(() => {
      const data = kit.autoRun();
      setCollectedData(data);
      setAutoRunning(false);
      setActiveTab('data');
    }, 100);
  };

  const handleClearData = () => setCollectedData([]);

  const handleExportCSV = () => {
    if (collectedData.length === 0) return;
    const headers = Object.keys(collectedData[0]);
    const csv = [
      headers.join(','),
      ...collectedData.map(row => headers.map(h => row[h]).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kitCode}_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <FlaskConical size={48} className="text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Kit Not Found</h2>
        <p className="text-slate-400 mb-6">{error}</p>
        <button onClick={onBack} className="vlab-btn-secondary flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Labs
        </button>
      </div>
    );
  }

  return (
    <div className="vlab-container">
      {/* Header */}
      <div className="vlab-header">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="vlab-btn-icon" title="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="vlab-badge">{kitCode}</span>
              <h1 className="text-base md:text-lg font-bold text-white truncate">{kitName}</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoRun}
            disabled={autoRunning}
            className="vlab-btn-auto"
            title="Auto-run experiment"
          >
            <Zap size={14} />
            <span className="hidden md:inline">{autoRunning ? 'Running...' : 'Auto'}</span>
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="vlab-tabs">
        {([
          { id: 'simulation' as LabTab, icon: FlaskConical, label: 'Lab' },
          { id: 'data' as LabTab, icon: Table, label: 'Data' },
          { id: 'procedure' as LabTab, icon: BookOpen, label: 'Steps' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`vlab-tab ${activeTab === tab.id ? 'vlab-tab-active' : ''}`}
          >
            <tab.icon size={14} />
            <span>{tab.label}</span>
            {tab.id === 'data' && collectedData.length > 0 && (
              <span className="vlab-tab-badge">{collectedData.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="vlab-content">
        <AnimatePresence mode="wait">
          {activeTab === 'simulation' && (
            <motion.div
              key="sim"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="vlab-sim-panel"
            >
              {/* Canvas */}
              <div className="vlab-canvas-wrapper">
                <canvas ref={canvasRef} className="vlab-canvas" />
                {!isRunning && (
                  <div className="vlab-canvas-overlay" onClick={handlePlayPause}>
                    <Play size={40} className="text-white/80" />
                    <span className="text-white/60 text-sm mt-2">Click to start</span>
                  </div>
                )}
              </div>

              {/* Transport controls */}
              <div className="vlab-transport">
                <button onClick={handlePlayPause} className="vlab-btn-play">
                  {isRunning ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button onClick={handleReset} className="vlab-btn-icon" title="Reset">
                  <RotateCcw size={16} />
                </button>
                <div className="flex-1" />
                <button onClick={handleMeasure} className="vlab-btn-measure">
                  <Ruler size={14} />
                  <span>Measure</span>
                </button>
              </div>

              {/* Controls */}
              {controls.length > 0 && (
                <div className="vlab-controls">
                  <h3 className="vlab-section-title">
                    <Timer size={14} /> Controls
                  </h3>
                  <div className="vlab-controls-grid">
                    {controls.map(ctrl => (
                      <div key={ctrl.id} className="vlab-control-item">
                        <div className="vlab-control-label">
                          <span>{ctrl.label}</span>
                          <span className="vlab-control-value">
                            {controlValues[ctrl.id]?.toFixed(ctrl.step < 1 ? 1 : 0)} {ctrl.unit}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={ctrl.min}
                          max={ctrl.max}
                          step={ctrl.step}
                          value={controlValues[ctrl.id] ?? ctrl.value}
                          onChange={(e) => handleControlChange(ctrl.id, parseFloat(e.target.value))}
                          className="vlab-slider"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'data' && (
            <motion.div
              key="data"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="vlab-data-panel"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="vlab-section-title">
                  <Table size={14} /> {dataTable?.title ?? 'Collected Data'}
                </h3>
                <div className="flex gap-2">
                  {collectedData.length > 0 && (
                    <>
                      <button onClick={handleExportCSV} className="vlab-btn-sm" title="Export CSV">
                        <Download size={12} /> CSV
                      </button>
                      <button onClick={handleClearData} className="vlab-btn-sm vlab-btn-danger">
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>

              {collectedData.length === 0 ? (
                <div className="vlab-empty-state">
                  <Table size={32} className="text-slate-600 mb-2" />
                  <p className="text-slate-500 text-sm">No data yet.</p>
                  <p className="text-slate-600 text-xs mt-1">
                    Use <strong>Measure</strong> to record a point, or <strong>Auto</strong> to run the full experiment.
                  </p>
                </div>
              ) : (
                <div className="vlab-table-wrapper">
                  <table className="vlab-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        {Object.keys(collectedData[0]).map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {collectedData.map((row, i) => (
                        <tr key={i}>
                          <td className="vlab-td-num">{i + 1}</td>
                          {Object.values(row).map((v, j) => (
                            <td key={j}>{typeof v === 'number' ? v.toFixed(4) : String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'procedure' && (
            <motion.div
              key="proc"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="vlab-procedure-panel"
            >
              <h3 className="vlab-section-title mb-3">
                <BookOpen size={14} /> Procedure
              </h3>
              <div className="vlab-steps">
                {procedure.map((step, i) => (
                  <div
                    key={i}
                    className={`vlab-step ${i === currentStep ? 'vlab-step-active' : ''} ${i < currentStep ? 'vlab-step-done' : ''}`}
                    onClick={() => setCurrentStep(i)}
                  >
                    <div className="vlab-step-num">{i + 1}</div>
                    <div className="vlab-step-content">
                      <p>{step.instruction}</p>
                      {step.expectedAction && (
                        <span className={`vlab-step-action vlab-action-${step.expectedAction}`}>
                          {step.expectedAction}
                        </span>
                      )}
                    </div>
                    {i === currentStep && (
                      <ChevronRight size={16} className="text-cyan-400 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0}
                  className="vlab-btn-secondary flex-1"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentStep(Math.min(procedure.length - 1, currentStep + 1))}
                  disabled={currentStep >= procedure.length - 1}
                  className="vlab-btn-primary flex-1"
                >
                  Next Step
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
