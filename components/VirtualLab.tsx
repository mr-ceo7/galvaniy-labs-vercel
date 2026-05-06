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
import { Vector2 } from '../engine/core/Vector2';
import { LabAssistant, LabAssistantHandle } from './LabAssistant';
import './VirtualLab.css';
import './Workbench.css';

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
  const assistantRef = useRef<LabAssistantHandle>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [controls, setControls] = useState<LabControl[]>([]);
  const [controlValues, setControlValues] = useState<Record<string, number>>({});
  const [dataTable, setDataTable] = useState<DataTableConfig | null>(null);
  const [collectedData, setCollectedData] = useState<DataPoint[]>([]);
  const [procedure, setProcedure] = useState<ProcedureStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState<LabTab>('simulation');
  const [drawerTab, setDrawerTab] = useState<LabTab | null>(null);
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
        const dpr2 = window.devicePixelRatio || 1;
        const cw2 = container.clientWidth || window.innerWidth;
        const ch2 = container.clientHeight || Math.round(window.innerHeight * 0.75);
        canvas.width = cw2 * dpr2;
        canvas.height = ch2 * dpr2;
        canvas.style.width = `${cw2}px`;
        canvas.style.height = `${ch2}px`;
        const ctx2 = canvas.getContext('2d');
        if (ctx2) ctx2.scale(dpr2, dpr2);
        kit.setup(canvas);
        kit.renderFrame();
        setupKitIdRef.current = kit.kitId;
      }
    };

    const handleResize = () => {
      if (canvasRef.current && kitRef.current) {
        const canvas = canvasRef.current;
        const container = canvas.parentElement!;
        const dpr3 = window.devicePixelRatio || 1;
        const cw3 = container.clientWidth || window.innerWidth;
        const ch3 = container.clientHeight || Math.round(window.innerHeight * 0.75);
        canvas.width = cw3 * dpr3;
        canvas.height = ch3 * dpr3;
        canvas.style.width = `${cw3}px`;
        canvas.style.height = `${ch3}px`;
        const ctx3 = canvas.getContext('2d');
        if (ctx3) ctx3.scale(dpr3, dpr3);
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
      // Full-viewport canvas — fill the container (bottom 75% of viewport)
      const dpr = window.devicePixelRatio || 1;
      const cw = container.clientWidth || window.innerWidth;
      const ch = container.clientHeight || Math.round(window.innerHeight * 0.75);
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);

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

      {/* ═══ IMMERSIVE WORKBENCH SCENE ═══ */}
      {currentPhase !== 'briefing' && (
        <div className="wb-scene">
          {/* Single full-viewport lab environment background */}
          <div className="wb-bg-env">
            <img src="/assets/lab/backgrounds/lab_environment.png" alt="" />
          </div>

          {/* Vignette overlay */}
          <div className="wb-vignette" />

          {/* Layer 2: Physics canvas (transparent, full scene) */}
          <div 
            className="wb-canvas"
            onDragOver={(e) => {
              e.preventDefault(); // Allow drop
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const componentId = e.dataTransfer.getData('text/plain');
              if (!componentId || !kitRef.current || !canvasRef.current) return;
              
              // Get canvas relative coordinates
              const rect = canvasRef.current.getBoundingClientRect();
              const scaleX = canvasRef.current.width / rect.width;
              const scaleY = canvasRef.current.height / rect.height;
              
              // Calculate logical pixel coordinates on canvas
              const canvasX = (e.clientX - rect.left) * scaleX;
              const canvasY = (e.clientY - rect.top) * scaleY;
              
              // Convert to world coordinates
              const world = kitRef.current.getWorld();
              const ppm = world.pixelsPerMeter;
              
              // CanvasRenderer worldToCanvas is: x = world.x * ppm, y = canvasHeight - (world.y * ppm)
              // So canvasToWorld is: world.x = canvasX / ppm, world.y = (canvasHeight - canvasY) / ppm
              const dpr = window.devicePixelRatio || 1;
              const worldX = canvasX / ppm;
              const worldY = (canvasRef.current.height - canvasY) / ppm;
              
              const success = kitRef.current.addApparatusComponent(componentId, new Vector2(worldX, worldY));
              if (success) {
                // Force a re-render
                kitRef.current.renderFrame();
              }
            }}
          >
            <canvas
              ref={handleCanvasRef}
              onMouseDown={handleCanvasPointerDown}
              onMouseMove={handleCanvasPointerMove}
              onMouseUp={handleCanvasPointerUp}
              onMouseLeave={handleCanvasPointerUp}
              onTouchStart={handleCanvasPointerDown}
              onTouchMove={handleCanvasPointerMove}
              onTouchEnd={handleCanvasPointerUp}
              style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
            />
          </div>

          {/* Layer 3: Top navigation bar */}
          <div className="wb-topbar">
            <div className="wb-topbar-left">
              <button onClick={onBack} className="wb-back-btn" title="Back">
                <ArrowLeft size={16} />
              </button>
              <span className="wb-title-code">{kitCode}</span>
              <span className="wb-title">{kitName}</span>
            </div>
            <div className="wb-topbar-right">
              <button
                onClick={handleSaveSession}
                disabled={saving || collectedData.length === 0}
                className="wb-icon-btn"
              >
                <Save size={13} /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={handleAutoRun} disabled={autoRunning} className="wb-icon-btn">
                <Zap size={13} /> {autoRunning ? 'Running...' : 'Auto'}
              </button>
            </div>
          </div>

          {/* Layer 4: Floating HUD panels */}
          <div className="wb-hud-layer">
            {/* ── Controls Panel (top-left) ── */}
            <div className="wb-hud-controls">
              <h4 className="wb-hud-title">Simulation Controls</h4>
              <div className="wb-transport">
                <button
                  onClick={handlePlayPause}
                  className={`wb-transport-btn ${!isRunning ? 'wb-transport-btn--primary' : ''}`}
                >
                  {isRunning ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Run</>}
                </button>
                <button onClick={handleReset} className="wb-transport-btn">
                  <RotateCcw size={13} /> Reset
                </button>
                <button onClick={handleMeasure} className="wb-transport-btn wb-transport-btn--record">
                  <Ruler size={13} /> Record
                </button>
              </div>

              {/* Sliders from controls */}
              {controls.map((control) => (
                <div key={control.id} className="wb-slider-group">
                  <div className="wb-slider-header">
                    <span className="wb-slider-label">{control.label}</span>
                    <span className="wb-slider-value">
                      {(controlValues[control.id] ?? control.value).toFixed((control.step ?? 1) < 1 ? 2 : 0)}
                      {control.unit ? ` ${control.unit}` : ''}
                    </span>
                  </div>
                  <input
                    type="range"
                    className="wb-slider"
                    min={control.min}
                    max={control.max}
                    step={control.step ?? 1}
                    value={controlValues[control.id] ?? control.value}
                    onChange={(e) => handleControlChange(control.id, parseFloat(e.target.value))}
                  />
                </div>
              ))}
            </div>

            {/* ── Live Data Panel (top-right) ── */}
            <div className="wb-hud-data">
              <h4 className="wb-hud-title">Live Data</h4>
              <div className="wb-hud-row">
                <span className="wb-hud-label">Time</span>
                <span className="wb-hud-value wb-hud-value--large">
                  {(() => {
                    const kit = kitRef.current;
                    if (!kit) return '0.00';
                    const sw = kit.getInstrument('stopwatch');
                    return sw ? Math.max(0, (sw as any).getElapsed?.() ?? 0).toFixed(2) : '0.00';
                  })()}
                  <span className="wb-hud-unit">s</span>
                </span>
              </div>
              <div className="wb-hud-row">
                <span className="wb-hud-label">Data Points</span>
                <span className="wb-hud-value">{collectedData.length}</span>
              </div>
              {collectedData.length > 0 && Object.entries(collectedData[collectedData.length - 1]).slice(0, 3).map(([key, val]) => (
                <div key={key} className="wb-hud-row">
                  <span className="wb-hud-label">{key}</span>
                  <span className="wb-hud-value">
                    {typeof val === 'number' ? val.toFixed(4) : String(val)}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Component Tray (Equipment Inventory, bottom-center) ── */}
            {kitDefinition?.apparatus && kitDefinition.apparatus.length > 0 && (
              <div className="wb-hud-tray">
                {kitDefinition.apparatus.map((item: any) => (
                  <div 
                    key={item.id} 
                    className="wb-tray-item" 
                    title={`Drag to bench · Click to ask Dr. Vance about ${item.name}`}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => assistantRef.current?.askAbout(item.name)}
                  >
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="wb-tray-icon" draggable={false} />
                    ) : (
                      <span style={{ fontSize: 24 }}>{item.icon}</span>
                    )}
                    <span className="wb-tray-label">{item.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Layer 5: Drawer tabs (right edge) */}
          <div className="wb-drawer-tabs">
            {([
              { id: 'data' as LabTab, icon: Table, label: 'Data' },
              { id: 'graph' as LabTab, icon: BarChart3, label: 'Graph' },
              { id: 'procedure' as LabTab, icon: BookOpen, label: 'Steps' },
              { id: 'sessions' as LabTab, icon: HistoryIcon, label: 'History' },
            ]).map((tab) => (
              <button
                key={tab.id}
                className={`wb-drawer-tab ${drawerTab === tab.id ? 'wb-drawer-tab--active' : ''}`}
                onClick={() => setDrawerTab(drawerTab === tab.id ? null : tab.id)}
                title={tab.label}
              >
                <tab.icon size={14} />
              </button>
            ))}
          </div>

          {/* Layer 6: Slide-out drawer */}
          {drawerTab && (
            <div className="wb-drawer">
              {drawerTab === 'data' && (
                <>
                  <h3 className="wb-drawer-title">{dataTable?.title ?? 'Collected Data'}</h3>
                  {collectedData.length === 0 ? (
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                      No data yet. Use <strong>Record</strong> to capture a measurement.
                    </p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button onClick={handleExportCSV} className="wb-icon-btn"><Download size={12} /> CSV</button>
                        <button onClick={handleClearData} className="wb-icon-btn" style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>Clear</button>
                      </div>
                      <div className="vlab-table-wrapper">
                        <table className="vlab-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              {Object.keys(collectedData[0]).map((h) => <th key={h}>{h}</th>)}
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
                    </>
                  )}
                </>
              )}

              {drawerTab === 'graph' && (
                <>
                  <h3 className="wb-drawer-title">Live Graph</h3>
                  {collectedData.length === 0 ? (
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No data to plot.</p>
                  ) : (
                    <>
                      {(() => {
                        const numKeys = Object.keys(collectedData[0]).filter(k => typeof collectedData[0][k] === 'number');
                        return (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                            <select value={graphXKey} onChange={(e) => setGraphXKey(e.target.value)} className="vlab-select">{numKeys.map(k => <option key={k} value={k}>{k}</option>)}</select>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>vs</span>
                            <select value={graphYKey} onChange={(e) => setGraphYKey(e.target.value)} className="vlab-select">{numKeys.map(k => <option key={k} value={k}>{k}</option>)}</select>
                          </div>
                        );
                      })()}
                      <div style={{ aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden' }}>
                        <canvas ref={chartCanvasRef} width={400} height={225} style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.3)' }} />
                      </div>
                    </>
                  )}
                </>
              )}

              {drawerTab === 'procedure' && (
                <>
                  <h3 className="wb-drawer-title">Procedure</h3>
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
                            <span className={`vlab-step-action vlab-action-${step.expectedAction}`}>{step.expectedAction}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {drawerTab === 'sessions' && (
                <>
                  <h3 className="wb-drawer-title">Session History</h3>
                  {sessionMessage && <p style={{ color: '#10b981', fontSize: 12, marginBottom: 8 }}>{sessionMessage}</p>}
                  <button onClick={loadSavedSessions} disabled={loadingSessions} className="wb-icon-btn" style={{ marginBottom: 12 }}>
                    {loadingSessions ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />} Refresh
                  </button>
                  {visibleSessions.length === 0 ? (
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No saved sessions.</p>
                  ) : (
                    <div className="vlab-sessions-list">
                      {visibleSessions.map((session) => (
                        <div key={session.id} className="vlab-session-card">
                          <div className="vlab-session-header">
                            <span className="vlab-badge" style={{ fontSize: 10 }}>{session.experimentCode}</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                              {new Date(session.startedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '4px 0' }}>
                            {session.dataPointCount ?? 0} data points
                          </div>
                          <div className="vlab-session-actions">
                            <button onClick={() => handleLoadSession(session.id)} className="vlab-btn-sm">
                              <HistoryIcon size={12} /> Load
                            </button>
                            <button onClick={() => handleReplaySession(session.id)} className="vlab-btn-sm" disabled={replayingSessionId === session.id}>
                              {replayingSessionId === session.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                              {replayingSessionId === session.id ? 'Replaying...' : 'Replay'}
                            </button>
                            <button onClick={() => handleGenerateReportFromSession(session.id)} className="vlab-btn-sm" disabled={generatingSessionId === session.id}>
                              {generatingSessionId === session.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                              {generatingSessionId === session.id ? 'Generating...' : 'Report'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
      {currentPhase !== 'briefing' && (
        <LabAssistant ref={assistantRef} experimentCode={kitCode} procedure={procedure} />
      )}
    </div>
  );
};
