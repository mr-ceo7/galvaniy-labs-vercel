import type { RendererType } from '../core/types.ts';

export const selectRenderer = (_experimentCode: string, preferWebGL = false): RendererType => {
  return preferWebGL ? 'webgl' : 'canvas2d';
};
