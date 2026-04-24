import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, FlaskConical, ExternalLink } from 'lucide-react';
import { KitRegistry } from '../engine/apparatus/KitRegistry';
import type { ApparatusKit } from '../engine/apparatus/ApparatusKit';
import type { LabControl, ProcedureStep } from '../engine/core/types';
import '../engine/index';

interface SimulationPanelProps {
  experimentCode: string;
  engineKit?: string;
  engineCategory?: string;
  onOpenLab?: (experimentCode: string) => void;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  experimentCode,
  engineKit,
  engineCategory,
  onOpenLab,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const kitRef = useRef<ApparatusKit | null>(null);

  const [error, setError] = useState('');
  const [kitName, setKitName] = useState(engineKit || '');
  const [controls, setControls] = useState<LabControl[]>([]);
  const [controlValues, setControlValues] = useState<Record<string, number>>({});
  const [procedure, setProcedure] = useState<ProcedureStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
  }, []);

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

  useEffect(() => {
    const kit = KitRegistry.resolveBestAvailable(experimentCode);
    if (!kit) {
      setError(`No simulation kit found for ${experimentCode}.`);
      return;
    }

    kitRef.current = kit;
    setKitName(kit.name);
    setControls(kit.getControls());
    setProcedure(kit.getProcedure());

    const initialValues: Record<string, number> = {};
    for (const control of kit.getControls()) {
      initialValues[control.id] = control.value;
    }
    setControlValues(initialValues);

    const setupCanvas = () => {
      if (!canvasRef.current || !kitRef.current) return;
      const canvas = canvasRef.current;
      const container = canvas.parentElement;
      if (!container) return;
      canvas.width = Math.min(720, container.clientWidth);
      canvas.height = Math.min(320, Math.max(240, canvas.width * 0.5));
      kitRef.current.setup(canvas);
      kitRef.current.renderFrame();
    };

    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    return () => {
      stopLoop();
      window.removeEventListener('resize', setupCanvas);
    };
  }, [experimentCode, stopLoop]);

  useEffect(() => () => stopLoop(), [stopLoop]);

  const handlePlayPause = () => {
    if (isRunning) {
      stopLoop();
    } else {
      startLoop();
    }
    setIsRunning((current) => !current);
  };

  const handleReset = () => {
    stopLoop();
    setIsRunning(false);
    const kit = kitRef.current;
    if (!kit) return;
    kit.getWorld().resetTime();
    kit.renderFrame();
  };

  const handleControlChange = (id: string, value: number) => {
    const kit = kitRef.current;
    if (!kit) return;
    setControlValues((current) => ({ ...current, [id]: value }));
    kit.setControl(id, value);
    if (!isRunning) {
      kit.renderFrame();
    }
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full rounded-2xl border border-cyan-500/20 bg-slate-950/80 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-300/80">
              <FlaskConical size={14} />
              Physics Engine Preview
            </div>
            <h4 className="mt-2 text-lg font-semibold text-white">{kitName || engineKit || experimentCode}</h4>
            <p className="mt-1 text-sm text-slate-400">
              Live apparatus preview for the report&apos;s built-in experiment kit.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
              {engineCategory || 'physics'}
            </span>
            {onOpenLab && (
              <button
                onClick={() => onOpenLab(experimentCode)}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-medium text-cyan-100 transition-colors hover:bg-cyan-500/25"
              >
                <ExternalLink size={14} />
                Open Full Lab
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <canvas ref={canvasRef} className="block h-auto w-full" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-cyan-400"
          >
            {isRunning ? <Pause size={15} /> : <Play size={15} />}
            {isRunning ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors hover:bg-white/10"
          >
            <RotateCcw size={15} />
            Reset
          </button>
        </div>

        {controls.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Controls</div>
            <div className="space-y-3">
              {controls.slice(0, 3).map((control) => (
                <label key={control.id} className="block">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-200">{control.label}</span>
                    <span className="text-slate-400">
                      {(controlValues[control.id] ?? control.value).toFixed(control.step && control.step < 1 ? 2 : 0)} {control.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={controlValues[control.id] ?? control.value}
                    onChange={(event) => handleControlChange(control.id, parseFloat(event.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {procedure.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-400">Procedure Snapshot</div>
            <div className="space-y-2">
              {procedure.slice(0, 3).map((step) => (
                <div key={step.index} className="rounded-xl bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
                  <span className="mr-2 font-medium text-cyan-300">{step.index + 1}.</span>
                  {step.instruction}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
