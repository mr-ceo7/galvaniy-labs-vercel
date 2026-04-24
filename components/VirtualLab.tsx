/**
 * VirtualLab — Interactive lab workspace component.
 * Renders the physics engine canvas with controls, data table, and procedure steps.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { KitRegistry } from '../engine/apparatus/KitRegistry';
import type { ApparatusKit, DataPoint } from '../engine/apparatus/ApparatusKit';
import type { LabControl, ProcedureStep, DataTableConfig } from '../engine/core/types';
import {
  Play, Pause, RotateCcw, Zap, ChevronRight, Download, Save,
  FlaskConical, Ruler, Timer, Table, BookOpen, ArrowLeft, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logService } from '../services/logService';
import './VirtualLab.css';

// Import all kits so they self-register
import '../engine/index';

interface VirtualLabProps {
  experimentCode: string;
  onBack: () => void;
}

type LabTab = 'simulation' | 'data' | 'procedure' | 'graph';

export const VirtualLab: React.FC<VirtualLabProps> = ({ experimentCode, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const kitRef = useRef<ApparatusKit | null>(null);
  const sessionStartRef = useRef<string>(new Date().toISOString());

  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
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
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [graphXKey, setGraphXKey] = useState('');
  const [graphYKey, setGraphYKey] = useState('');

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
      canvas.width = Math.min(800, container.clientWidth);
      canvas.height = Math.min(400, canvas.width * 0.55);
      kit.setup(canvas);
      // Draw initial frame so canvas isn't blank
      kit.renderFrame();
    }

    // Handle resize
    const handleResize = () => {
      if (canvasRef.current && kitRef.current) {
        const canvas = canvasRef.current;
        const container = canvas.parentElement!;
        canvas.width = Math.min(800, container.clientWidth);
        canvas.height = Math.min(400, canvas.width * 0.55);
        kitRef.current.renderFrame();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
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
      if (!hasStarted) setHasStarted(true);
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

  // ========== Canvas Touch/Drag Interaction ==========
  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleCanvasPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    if (!hasStarted) {
      handlePlayPause();
      return;
    }
    const pos = getCanvasPos(e);
    const kit = kitRef.current;
    if (kit && (kit as any).onPointerDown) {
      (kit as any).onPointerDown(pos.x, pos.y);
    }
  };

  const handleCanvasPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const pos = getCanvasPos(e);
    const kit = kitRef.current;
    if (kit && (kit as any).onPointerMove) {
      (kit as any).onPointerMove(pos.x, pos.y);
      if (!isRunning) kit.renderFrame();
    }
  };

  const handleCanvasPointerUp = () => {
    setIsDragging(false);
    const kit = kitRef.current;
    if (kit && (kit as any).onPointerUp) {
      (kit as any).onPointerUp();
    }
  };

  // ========== Session Save ==========
  const handleSaveSession = async () => {
    if (collectedData.length === 0) return;
    setSaving(true);
    try {
      const { backendService } = await import('../services/backendService');
      await backendService.saveLabSession({
        experiment_code: kitCode,
        mode: autoRunning ? 'auto' : 'manual',
        started_at: sessionStartRef.current,
        completed_at: new Date().toISOString(),
        data_points: collectedData,
        control_values: controlValues,
      });
      logService.log('[VirtualLab] Session saved successfully');
    } catch (err) {
      logService.error('[VirtualLab] Failed to save session:', err);
    } finally {
      setSaving(false);
    }
  };

  // ========== Graph Rendering ==========
  useEffect(() => {
    if (activeTab !== 'graph' || collectedData.length === 0) return;
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const keys = Object.keys(collectedData[0]).filter(
      k => typeof collectedData[0][k] === 'number'
    );
    const xKey = graphXKey || keys[0] || '';
    const yKey = graphYKey || keys[1] || keys[0] || '';
    if (!graphXKey && xKey) setGraphXKey(xKey);
    if (!graphYKey && yKey) setGraphYKey(yKey);

    const xVals = collectedData.map(d => Number(d[xKey]) || 0);
    const yVals = collectedData.map(d => Number(d[yKey]) || 0);

    const w = canvas.width;
    const h = canvas.height;
    const pad = { top: 30, right: 20, bottom: 45, left: 55 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const xMin = Math.min(...xVals);
    const xMax = Math.max(...xVals);
    const yMin = Math.min(...yVals, 0);
    const yMax = Math.max(...yVals) * 1.1 || 1;

    const toX = (v: number) => pad.left + ((v - xMin) / (xMax - xMin || 1)) * plotW;
    const toY = (v: number) => pad.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

    // Clear
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (plotH / 5) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, h - pad.bottom);
    ctx.lineTo(w - pad.right, h - pad.bottom);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xKey, pad.left + plotW / 2, h - 8);
    ctx.save();
    ctx.translate(14, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yKey, 0, 0);
    ctx.restore();

    // Tick labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const v = xMin + ((xMax - xMin) / 5) * i;
      ctx.fillText(v.toPrecision(3), toX(v), h - pad.bottom + 15);
    }
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const v = yMin + ((yMax - yMin) / 5) * i;
      ctx.fillText(v.toPrecision(3), pad.left - 8, toY(v) + 3);
    }

    // Data points + line
    if (xVals.length > 1) {
      // Line
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toX(xVals[0]), toY(yVals[0]));
      for (let i = 1; i < xVals.length; i++) {
        ctx.lineTo(toX(xVals[i]), toY(yVals[i]));
      }
      ctx.stroke();

      // Area fill
      ctx.fillStyle = 'rgba(34, 211, 238, 0.08)';
      ctx.beginPath();
      ctx.moveTo(toX(xVals[0]), toY(yMin));
      for (let i = 0; i < xVals.length; i++) {
        ctx.lineTo(toX(xVals[i]), toY(yVals[i]));
      }
      ctx.lineTo(toX(xVals[xVals.length - 1]), toY(yMin));
      ctx.closePath();
      ctx.fill();
    }

    // Points
    for (let i = 0; i < xVals.length; i++) {
      const px = toX(xVals[i]);
      const py = toY(yVals[i]);
      // Glow
      const grad = ctx.createRadialGradient(px, py, 0, px, py, 8);
      grad.addColorStop(0, 'rgba(34, 211, 238, 0.4)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
      // Dot
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [activeTab, collectedData, graphXKey, graphYKey]);

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
            onClick={handleSaveSession}
            disabled={saving || collectedData.length === 0}
            className="vlab-btn-auto"
            title="Save session to cloud"
            style={{ opacity: collectedData.length === 0 ? 0.4 : 1 }}
          >
            <Save size={14} />
            <span className="hidden md:inline">{saving ? 'Saving...' : 'Save'}</span>
          </button>
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
          { id: 'graph' as LabTab, icon: BarChart3, label: 'Graph' },
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
                <canvas
                  ref={canvasRef}
                  className="vlab-canvas"
                  onMouseDown={handleCanvasPointerDown}
                  onMouseMove={handleCanvasPointerMove}
                  onMouseUp={handleCanvasPointerUp}
                  onMouseLeave={handleCanvasPointerUp}
                  onTouchStart={handleCanvasPointerDown}
                  onTouchMove={handleCanvasPointerMove}
                  onTouchEnd={handleCanvasPointerUp}
                  style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
                />
                {!isRunning && !hasStarted && (
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

          {activeTab === 'graph' && (
            <motion.div
              key="graph"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="vlab-data-panel"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="vlab-section-title">
                  <BarChart3 size={14} /> Live Graph
                </h3>
                {collectedData.length > 0 && (() => {
                  const numKeys = Object.keys(collectedData[0]).filter(
                    k => typeof collectedData[0][k] === 'number'
                  );
                  return (
                    <div className="flex gap-2 items-center">
                      <select
                        value={graphXKey}
                        onChange={e => setGraphXKey(e.target.value)}
                        className="vlab-select"
                      >
                        {numKeys.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <span className="text-slate-500 text-xs">vs</span>
                      <select
                        value={graphYKey}
                        onChange={e => setGraphYKey(e.target.value)}
                        className="vlab-select"
                      >
                        {numKeys.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                  );
                })()}
              </div>

              {collectedData.length === 0 ? (
                <div className="vlab-empty-state">
                  <BarChart3 size={32} className="text-slate-600 mb-2" />
                  <p className="text-slate-500 text-sm">No data to plot.</p>
                  <p className="text-slate-600 text-xs mt-1">
                    Collect data first using <strong>Measure</strong> or <strong>Auto</strong>.
                  </p>
                </div>
              ) : (
                <div className="vlab-canvas-wrapper" style={{ aspectRatio: '16/9' }}>
                  <canvas
                    ref={chartCanvasRef}
                    width={600}
                    height={340}
                    className="vlab-canvas"
                    style={{ cursor: 'default' }}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
