/**
 * VirtualLab - Interactive lab workspace component.
 * Renders the physics engine canvas with controls, data table, and procedure steps.
 */
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { KitRegistry } from '../engine/apparatus/KitRegistry';
import type { ApparatusKit, DataPoint } from '../engine/apparatus/ApparatusKit';
import type { LabControl, ProcedureStep, DataTableConfig, LabConfig, KitDefinition } from '../engine/core/types';
import {
  Play, Pause, RotateCcw, Zap, ChevronRight, Download, Save,
  FlaskConical, Ruler, Table, BookOpen, ArrowLeft, BarChart3,
  History as HistoryIcon, FileText, Loader2, RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logService } from '../services/logService';
import { labSessionService } from '../services/labSessionService';
import { backendService } from '../services/backendService';
import type { LabSession, Report } from '../types';
import { InstrumentPanel } from './InstrumentPanel';
import { LabBriefing } from './LabBriefing';
import './LabBriefing.css';
import { PhaseNavigator } from './PhaseNavigator';
import type { LabPhase } from './PhaseNavigator';
import { getKitDefinition } from '../engine/apparatus/definitions';
import './VirtualLab.css';

// Import all kits so they self-register
import '../engine/index';

interface VirtualLabProps {
  experimentCode: string;
  onBack: () => void;
  onReportGenerated?: (report: Report) => void;
}

type LabTab = 'simulation' | 'data' | 'procedure' | 'graph' | 'sessions';
type SessionMode = 'manual' | 'auto' | 'report_only';

export const VirtualLab: React.FC<VirtualLabProps> = ({ experimentCode, onBack, onReportGenerated }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const replayTimerRef = useRef<number | null>(null);
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
  const [sessionMode, setSessionMode] = useState<SessionMode>('manual');
  const [sessionEvents, setSessionEvents] = useState<LabSession['sessionEvents']>([]);
  const [savedSessions, setSavedSessions] = useState<LabSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [replayingSessionId, setReplayingSessionId] = useState<string | null>(null);
  const [generatingSessionId, setGeneratingSessionId] = useState<string | null>(null);
  const [lastSavedSessionId, setLastSavedSessionId] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState('');
  const [loadingLabSetup, setLoadingLabSetup] = useState(true);

  // Phase navigation state
  const kitDefinition = useMemo(() => getKitDefinition(experimentCode), [experimentCode]);
  const [currentPhase, setCurrentPhase] = useState<LabPhase>(
    () => kitDefinition ? 'briefing' : 'experiment'
  );
  const [completedPhases, setCompletedPhases] = useState<Set<LabPhase>>(new Set());

  /** Transition to a new phase and mark the previous as completed. */
  const goToPhase = useCallback((phase: LabPhase) => {
    setCurrentPhase((prev) => {
      setCompletedPhases((completed) => {
        const next = new Set(completed);
        next.add(prev);
        return next;
      });
      return phase;
    });
  }, []);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const stopReplay = useCallback(() => {
    if (replayTimerRef.current !== null) {
      window.clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setReplayingSessionId(null);
  }, []);

  const recordSessionEvent = useCallback((type: string, data: Record<string, unknown> = {}) => {
    const elapsed = Math.max(0, (Date.now() - new Date(sessionStartRef.current).getTime()) / 1000);
    setSessionEvents((prev) => [
      ...prev,
      {
        time: Number(elapsed.toFixed(3)),
        type,
        data,
      },
    ]);
  }, []);

  const loadSavedSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const sessions = await labSessionService.listSessions();
      setSavedSessions(sessions);
    } catch (err) {
      logService.error('[VirtualLab] Failed to load sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const applySessionToLab = useCallback((session: LabSession) => {
    const kit = kitRef.current;
    if (!kit) return;

    stopReplay();
    setSessionMode(session.mode);
    setSessionEvents(session.sessionEvents || []);
    setCollectedData((session.dataPoints || []) as DataPoint[]);
    setControlValues(session.controlValues || {});
    setGraphXKey('');
    setGraphYKey('');
    setActiveTab('data');
    sessionStartRef.current = session.startedAt || new Date().toISOString();

    Object.entries(session.controlValues || {}).forEach(([id, value]) => {
      kit.setControl(id, value);
    });

    if (!isRunning) {
      kit.renderFrame();
    }
  }, [isRunning, stopReplay]);

  const setupKitIdRef = useRef<string | null>(null);

  // Initialize kit
  useEffect(() => {
    let cancelled = false;
    setError('');
    setLoadingLabSetup(true);
    setSavedSessions([]);
    setSessionEvents([]);
    setSessionMode('manual');
    setSessionMessage('');
    setLastSavedSessionId(null);
    sessionStartRef.current = new Date().toISOString();

    const applyKit = (kit: ApparatusKit) => {
      if (cancelled) return;
      kitRef.current = kit;
      setKitName(kit.name);
      setKitCode(kit.experimentCode);
      setControls(kit.getControls());
      setDataTable(kit.getDataTable());
      setProcedure(kit.getProcedure());
      setCollectedData([]);
      setCurrentStep(0);
      setActiveTab('simulation');
      
      // Reset setup tracking so it runs again when canvas mounts
      setupKitIdRef.current = null;

      const vals: Record<string, number> = {};
      for (const control of kit.getControls()) {
        vals[control.id] = control.value;
      }
      setControlValues(vals);

      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const container = canvas.parentElement!;
        canvas.width = Math.min(800, container.clientWidth);
        canvas.height = Math.min(400, canvas.width * 0.55);
        kit.setup(canvas);
        kit.renderFrame();
        setupKitIdRef.current = kit.kitId;
      }
    };

    const handleResize = () => {
      if (canvasRef.current && kitRef.current) {
        const canvas = canvasRef.current;
        const container = canvas.parentElement!;
        canvas.width = Math.min(800, container.clientWidth);
        canvas.height = Math.min(400, canvas.width * 0.55);
        kitRef.current.renderFrame();
      }
    };

    const loadKit = async () => {
      try {
        const setup = await backendService.getLabSetup(experimentCode);
        const rawConfig = (setup.lab_config || {}) as Partial<LabConfig> & { category?: string };
        let kit: ApparatusKit | null = null;

        if (setup.mode === 'builtin') {
          kit = KitRegistry.resolve(experimentCode);
        } else {
          kit = KitRegistry.fromLabConfig(rawConfig);
        }

        if (!kit) {
          kit = KitRegistry.resolveBestAvailable(experimentCode);
        }

        if (!kit) {
          setError(`No virtual lab kit found for experiment "${experimentCode}"`);
          return;
        }

        applyKit(kit);
      } catch (err) {
        logService.warn('[VirtualLab] Failed to load backend lab setup, using local fallback:', err);
        const fallbackKit = KitRegistry.resolveBestAvailable(experimentCode);
        if (!fallbackKit) {
          setError(`No virtual lab kit found for experiment "${experimentCode}"`);
          return;
        }
        applyKit(fallbackKit);
      } finally {
        if (!cancelled) {
          setLoadingLabSetup(false);
        }
      }
    };

    void loadKit();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      if (replayTimerRef.current !== null) {
        window.clearTimeout(replayTimerRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [experimentCode]);

  // Ensure kit is set up when canvas mounts (after AnimatePresence delays)
  const handleCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    
    if (node && kitRef.current && activeTab === 'simulation') {
      const kit = kitRef.current;
      const canvas = node;
      const container = canvas.parentElement!;
      
      // We must check if the container has width yet. If it's animating in, it might be 0.
      // But typically it has width if it's block display.
      canvas.width = Math.min(800, container.clientWidth || 800);
      canvas.height = Math.min(400, canvas.width * 0.55);

      if (setupKitIdRef.current !== kit.kitId) {
        // Initial setup for this kit
        kit.setup(canvas);
        kit.renderFrame();
        setupKitIdRef.current = kit.kitId;
      } else {
        // Kit is already running, just rebind the new canvas DOM element!
        kit.rebindCanvas(canvas);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    loadSavedSessions();
    return () => stopReplay();
  }, [loadSavedSessions, stopReplay]);

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

  const handlePlayPause = () => {
    if (isRunning) {
      stopLoop();
      recordSessionEvent('pause');
    } else {
      startLoop();
      if (!hasStarted) setHasStarted(true);
      recordSessionEvent('play');
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    stopLoop();
    stopReplay();
    setIsRunning(false);
    const kit = kitRef.current;
    if (kit && canvasRef.current) {
      kit.getWorld().resetTime();
      kit.renderFrame();
    }
    recordSessionEvent('reset');
  };

  const handleControlChange = (id: string, value: number) => {
    const kit = kitRef.current;
    if (!kit) return;

    setSessionMode('manual');
    setControlValues((prev) => ({ ...prev, [id]: value }));
    kit.setControl(id, value);
    recordSessionEvent('control_change', { id, value });
    if (!isRunning) kit.renderFrame();
  };

  const handleMeasure = () => {
    const kit = kitRef.current;
    if (!kit) return;

    setSessionMode('manual');
    const point = kit.measure();
    setCollectedData((prev) => [...prev, point]);
    recordSessionEvent('measurement', { point });
  };

  const handleAutoRun = () => {
    const kit = kitRef.current;
    if (!kit) return;

    stopReplay();
    setAutoRunning(true);
    setSessionMode('auto');
    recordSessionEvent('autorun_started', { experimentCode: kitCode });

    setTimeout(() => {
      const data = kit.autoRun();
      setCollectedData(data);
      recordSessionEvent('autorun_completed', { points: data.length });
      setAutoRunning(false);
      setActiveTab('data');
    }, 100);
  };

  const handleClearData = () => {
    stopReplay();
    setCollectedData([]);
    recordSessionEvent('clear_data');
  };

  const handleExportCSV = () => {
    if (collectedData.length === 0) return;
    const headers = Object.keys(collectedData[0]);
    const csv = [
      headers.join(','),
      ...collectedData.map((row) => headers.map((header) => row[header]).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${kitCode}_data.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const selectProcedureStep = (stepIndex: number) => {
    setCurrentStep(stepIndex);
    recordSessionEvent('step_complete', { stepIndex });
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
      recordSessionEvent('pointer_down', pos);
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
      recordSessionEvent('pointer_up');
    }
  };

  // ========== Session Handling ==========
  const handleSaveSession = async () => {
    if (collectedData.length === 0) return;

    setSaving(true);
    try {
      const sessionId = await labSessionService.saveSession({
        experiment_code: kitCode,
        mode: sessionMode,
        started_at: sessionStartRef.current,
        completed_at: new Date().toISOString(),
        data_points: collectedData,
        control_values: controlValues,
        session_events: sessionEvents,
      });
      setLastSavedSessionId(sessionId);
      setSessionMessage(`Session saved to cloud as ${sessionId}.`);
      await loadSavedSessions();
      logService.log('[VirtualLab] Session saved successfully');
    } catch (err) {
      logService.error('[VirtualLab] Failed to save session:', err);
      setSessionMessage('Failed to save session. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSession = async (sessionId: string) => {
    try {
      const session = await labSessionService.getSession(sessionId);
      applySessionToLab(session);
      setSessionMessage(`Loaded session ${session.id} with ${session.dataPointCount} recorded points.`);
    } catch (err) {
      logService.error('[VirtualLab] Failed to load session:', err);
      setSessionMessage('Failed to load that session.');
    }
  };

  const handleReplaySession = async (sessionId: string) => {
    try {
      const session = await labSessionService.getSession(sessionId);
      stopReplay();
      setReplayingSessionId(session.id);
      setSessionMode(session.mode);
      setSessionEvents(session.sessionEvents || []);
      setControlValues(session.controlValues || {});
      setCollectedData([]);
      setGraphXKey('');
      setGraphYKey('');
      setActiveTab('data');
      sessionStartRef.current = session.startedAt || new Date().toISOString();

      const kit = kitRef.current;
      if (kit) {
        Object.entries(session.controlValues || {}).forEach(([id, value]) => {
          kit.setControl(id, value);
        });
        if (!isRunning) kit.renderFrame();
      }

      const points = (session.dataPoints || []) as DataPoint[];
      if (points.length === 0) {
        setReplayingSessionId(null);
        setSessionMessage(`Session ${session.id} has no recorded data points.`);
        return;
      }

      let index = 0;
      const step = () => {
        index += 1;
        setCollectedData(points.slice(0, index));
        if (index < points.length) {
          replayTimerRef.current = window.setTimeout(step, 250);
        } else {
          replayTimerRef.current = null;
          setReplayingSessionId(null);
          setSessionMessage(`Replay complete for session ${session.id}.`);
        }
      };

      setSessionMessage(`Replaying session ${session.id}...`);
      step();
    } catch (err) {
      logService.error('[VirtualLab] Failed to replay session:', err);
      setSessionMessage('Failed to replay that session.');
      stopReplay();
    }
  };

  const handleGenerateReportFromSession = async (sessionId: string) => {
    try {
      setGeneratingSessionId(sessionId);
      const report = await labSessionService.generateReportFromSession(sessionId);
      onReportGenerated?.(report);
      setSessionMessage(`Generated report from session ${sessionId}.`);
    } catch (err) {
      logService.error('[VirtualLab] Failed to generate report from session:', err);
      setSessionMessage('Failed to generate a report from that session.');
    } finally {
      setGeneratingSessionId(null);
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
      (key) => typeof collectedData[0][key] === 'number'
    );
    const xKey = graphXKey || keys[0] || '';
    const yKey = graphYKey || keys[1] || keys[0] || '';
    if (!graphXKey && xKey) setGraphXKey(xKey);
    if (!graphYKey && yKey) setGraphYKey(yKey);

    const xVals = collectedData.map((d) => Number(d[xKey]) || 0);
    const yVals = collectedData.map((d) => Number(d[yKey]) || 0);

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

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (plotH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, h - pad.bottom);
    ctx.lineTo(w - pad.right, h - pad.bottom);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xKey, pad.left + plotW / 2, h - 8);
    ctx.save();
    ctx.translate(14, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yKey, 0, 0);
    ctx.restore();

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

    if (xVals.length > 1) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toX(xVals[0]), toY(yVals[0]));
      for (let i = 1; i < xVals.length; i++) {
        ctx.lineTo(toX(xVals[i]), toY(yVals[i]));
      }
      ctx.stroke();

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

    for (let i = 0; i < xVals.length; i++) {
      const px = toX(xVals[i]);
      const py = toY(yVals[i]);
      const grad = ctx.createRadialGradient(px, py, 0, px, py, 8);
      grad.addColorStop(0, 'rgba(34, 211, 238, 0.4)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
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

  if (loadingLabSetup) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Loader2 size={36} className="text-cyan-300 mb-4 animate-spin" />
        <h2 className="text-lg font-bold text-white mb-2">Preparing Virtual Lab</h2>
        <p className="text-slate-400">Loading the best available lab configuration for {experimentCode}.</p>
      </div>
    );
  }

  const visibleSessions = [
    ...savedSessions.filter((session) => session.experimentCode === kitCode),
    ...savedSessions.filter((session) => session.experimentCode !== kitCode),
  ];

  return (
    <div className="vlab-container">
      {/* Briefing Phase — full-viewport overlay, rendered outside normal flow */}
      {currentPhase === 'briefing' && kitDefinition && (
        <LabBriefing
          definition={kitDefinition}
          onEnterLab={() => goToPhase('experiment')}
        />
      )}

      {currentPhase !== 'briefing' && (
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
      )}

      {/* Phase Navigator — hidden during briefing */}
      {currentPhase !== 'briefing' && (
        <PhaseNavigator
          currentPhase={currentPhase}
          onPhaseChange={(phase) => setCurrentPhase(phase)}
          completedPhases={completedPhases}
          hasBriefing={!!kitDefinition}
        />
      )}

      {/* Experiment Phase (existing tabs + content) */}
      {currentPhase !== 'briefing' && (
      <>
      <div className="vlab-tabs">
        {([
          { id: 'simulation' as LabTab, icon: FlaskConical, label: 'Lab' },
          { id: 'data' as LabTab, icon: Table, label: 'Data' },
          { id: 'graph' as LabTab, icon: BarChart3, label: 'Graph' },
          { id: 'procedure' as LabTab, icon: BookOpen, label: 'Steps' },
          { id: 'sessions' as LabTab, icon: HistoryIcon, label: 'Sessions' },
        ]).map((tab) => (
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
            {tab.id === 'sessions' && savedSessions.length > 0 && (
              <span className="vlab-tab-badge">{savedSessions.length}</span>
            )}
          </button>
        ))}
      </div>

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
              <div className="vlab-canvas-wrapper">
                <canvas
                  ref={handleCanvasRef}
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

              <InstrumentPanel
                controls={controls}
                values={controlValues}
                onChange={handleControlChange}
              />
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
                        {Object.keys(collectedData[0]).map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {collectedData.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          <td className="vlab-td-num">{rowIndex + 1}</td>
                          {Object.values(row).map((value, cellIndex) => (
                            <td key={cellIndex}>{typeof value === 'number' ? value.toFixed(4) : String(value)}</td>
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
                {procedure.map((step, index) => (
                  <div
                    key={index}
                    className={`vlab-step ${index === currentStep ? 'vlab-step-active' : ''} ${index < currentStep ? 'vlab-step-done' : ''}`}
                    onClick={() => selectProcedureStep(index)}
                  >
                    <div className="vlab-step-num">{index + 1}</div>
                    <div className="vlab-step-content">
                      <p>{step.instruction}</p>
                      {step.expectedAction && (
                        <span className={`vlab-step-action vlab-action-${step.expectedAction}`}>
                          {step.expectedAction}
                        </span>
                      )}
                    </div>
                    {index === currentStep && (
                      <ChevronRight size={16} className="text-cyan-400 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => selectProcedureStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0}
                  className="vlab-btn-secondary flex-1"
                >
                  Previous
                </button>
                <button
                  onClick={() => selectProcedureStep(Math.min(procedure.length - 1, currentStep + 1))}
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
                    (key) => typeof collectedData[0][key] === 'number'
                  );
                  return (
                    <div className="flex gap-2 items-center">
                      <select
                        value={graphXKey}
                        onChange={(e) => setGraphXKey(e.target.value)}
                        className="vlab-select"
                      >
                        {numKeys.map((key) => <option key={key} value={key}>{key}</option>)}
                      </select>
                      <span className="text-slate-500 text-xs">vs</span>
                      <select
                        value={graphYKey}
                        onChange={(e) => setGraphYKey(e.target.value)}
                        className="vlab-select"
                      >
                        {numKeys.map((key) => <option key={key} value={key}>{key}</option>)}
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

          {activeTab === 'sessions' && (
            <motion.div
              key="sessions"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="vlab-data-panel"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="vlab-section-title">
                    <HistoryIcon size={14} /> Session History
                  </h3>
                  <p className="text-slate-500 text-xs mt-1">
                    Replay saved runs, reload captured data, or generate a report from a past session.
                  </p>
                </div>
                <button onClick={loadSavedSessions} className="vlab-btn-sm">
                  <RefreshCcw size={12} /> Refresh
                </button>
              </div>

              {sessionMessage && (
                <div className="vlab-session-message">{sessionMessage}</div>
              )}

              {loadingSessions ? (
                <div className="vlab-empty-state">
                  <Loader2 size={28} className="text-slate-500 mb-2 animate-spin" />
                  <p className="text-slate-400 text-sm">Loading saved sessions...</p>
                </div>
              ) : visibleSessions.length === 0 ? (
                <div className="vlab-empty-state">
                  <HistoryIcon size={32} className="text-slate-600 mb-2" />
                  <p className="text-slate-500 text-sm">No saved sessions yet.</p>
                  <p className="text-slate-600 text-xs mt-1">
                    Save your current run to enable replay and report generation from session data.
                  </p>
                </div>
              ) : (
                <div className="vlab-session-list">
                  {visibleSessions.map((session) => (
                    <div
                      key={session.id}
                      className={`vlab-session-card ${session.id === lastSavedSessionId ? 'vlab-session-card-active' : ''}`}
                    >
                      <div className="vlab-session-head">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="vlab-badge">{session.experimentCode}</span>
                            <span className="text-sm font-semibold text-white">
                              {session.mode === 'auto' ? 'Auto Run' : 'Manual Run'}
                            </span>
                          </div>
                          <div className="vlab-session-meta">
                            <span>{new Date(session.savedAt || session.completedAt || session.startedAt).toLocaleString()}</span>
                            <span>{session.dataPointCount} points</span>
                            <span>{session.eventCount} events</span>
                          </div>
                        </div>
                        {session.experimentCode === kitCode && (
                          <span className="vlab-session-pill">Current Lab</span>
                        )}
                      </div>

                      <div className="vlab-session-actions">
                        <button onClick={() => handleLoadSession(session.id)} className="vlab-btn-sm">
                          <HistoryIcon size={12} /> Load
                        </button>
                        <button
                          onClick={() => handleReplaySession(session.id)}
                          className="vlab-btn-sm"
                          disabled={replayingSessionId === session.id}
                        >
                          {replayingSessionId === session.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                          {replayingSessionId === session.id ? 'Replaying...' : 'Replay'}
                        </button>
                        <button
                          onClick={() => handleGenerateReportFromSession(session.id)}
                          className="vlab-btn-sm"
                          disabled={generatingSessionId === session.id}
                        >
                          {generatingSessionId === session.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                          {generatingSessionId === session.id ? 'Generating...' : 'Generate Report'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </>
      )}
    </div>
  );
};
