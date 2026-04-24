import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , entryArg, ...forwardedArgs] = process.argv;

if (!entryArg) {
  console.error('Usage: node scripts/run-ts-entry.mjs <entry.ts> [...args]');
  process.exit(1);
}

const projectRoot = process.cwd();
const entryFile = path.resolve(projectRoot, entryArg);
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'galvaniy-ts-run-'));
const outFile = path.join(tempDir, 'entry.mjs');

const originalArgv = process.argv;

try {
  await build({
    entryPoints: [entryFile],
    outfile: outFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: ['node18'],
    sourcemap: 'inline',
    absWorkingDir: projectRoot,
    logLevel: 'silent',
  });

  process.argv = [process.execPath, entryFile, ...forwardedArgs];
  await import(pathToFileURL(outFile).href);
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
} finally {
  process.argv = originalArgv;
  await rm(tempDir, { recursive: true, force: true });
}
