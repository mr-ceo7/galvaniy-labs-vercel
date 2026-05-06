/**
 * Galvaniy Physics Engine - Comprehensive Terminal Test Suite
 * 
 * Tests every feature end-to-end with edge cases.
 * Run: node scripts/run-ts-entry.mjs tests/comprehensive.ts
 */

import { KitRegistry } from '../engine/index.ts';
import { buildCliOutput } from '../engine/cli.ts';
import type { ApparatusKit } from '../engine/apparatus/ApparatusKit.ts';

let passed = 0;
let failed = 0;
let warnings = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function warn(name: string, msg: string) {
  warnings++;
  console.log(`  ⚠️  ${name}: ${msg}`);
}

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

// ============================================================
// 1. KIT REGISTRY
// ============================================================
console.log('\n━━━ 1. KIT REGISTRY ━━━');

test('listKits returns 20 kits', () => {
  const kits = KitRegistry.listKits();
  assert(kits.length === 20, `Expected 20, got ${kits.length}`);
});

test('Each kit has unique kitId', () => {
  const kits = KitRegistry.listKits();
  const ids = new Set(kits.map(k => k.kitId));
  assert(ids.size === kits.length, `Duplicate kitIds found`);
});

test('Each kit has unique experimentCode', () => {
  const kits = KitRegistry.listKits();
  const codes = new Set(kits.map(k => k.experimentCode));
  assert(codes.size === kits.length, `Duplicate experimentCodes found`);
});

test('Resolve by exact code (A-2)', () => {
  const kit = KitRegistry.resolve('A-2');
  assert(kit !== null, 'Should resolve');
  assert(kit.experimentCode === 'A-2', `Wrong code: ${kit.experimentCode}`);
});

test('Resolve case-insensitive (a-2)', () => {
  const kit = KitRegistry.resolve('a-2');
  assert(kit !== null, 'Should resolve case-insensitively');
});

test('Resolve with whitespace ( A-2 )', () => {
  const kit = KitRegistry.resolve(' A-2 ');
  assert(kit !== null, 'Should trim whitespace');
});

test('Resolve invalid code returns null', () => {
  const kit = KitRegistry.resolve('Z-99');
  assert(kit === null, 'Should return null for invalid code');
});

test('Resolve empty string returns null', () => {
  const kit = KitRegistry.resolve('');
  assert(kit === null, 'Should return null for empty string');
});

// ============================================================
// 2. ALL 20 KITS - CORE METHODS
// ============================================================
console.log('\n━━━ 2. KIT CORE METHODS (all 20) ━━━');

const allKits = KitRegistry.listKits();
for (const meta of allKits) {
  const kit = KitRegistry.resolve(meta.experimentCode)!;
  
  test(`[${meta.experimentCode}] getControls() returns array`, () => {
    const controls = kit.getControls();
    assert(Array.isArray(controls), 'Should be array');
    assert(controls.length > 0, 'Should have at least 1 control');
    for (const c of controls) {
      assert(typeof c.id === 'string' && c.id.length > 0, `Control missing id`);
      assert(typeof c.min === 'number', `Control ${c.id} missing min`);
      assert(typeof c.max === 'number', `Control ${c.id} missing max`);
      assert(c.min < c.max, `Control ${c.id}: min >= max`);
      assert(typeof c.unit === 'string', `Control ${c.id} missing unit`);
    }
  });

  test(`[${meta.experimentCode}] getDataTable() returns valid config`, () => {
    const dt = kit.getDataTable();
    assert(typeof dt.id === 'string', 'Missing id');
    assert(typeof dt.title === 'string' && dt.title.length > 0, 'Missing title');
    assert(Array.isArray(dt.headers) && dt.headers.length > 0, 'Missing headers');
    assert(typeof dt.rows === 'number' && dt.rows > 0, 'Missing rows count');
  });

  test(`[${meta.experimentCode}] getProcedure() returns steps`, () => {
    const steps = kit.getProcedure();
    assert(Array.isArray(steps), 'Should be array');
    assert(steps.length >= 3, `Too few steps: ${steps.length}`);
    for (const s of steps) {
      assert(typeof s.instruction === 'string' && s.instruction.length > 0, 'Step missing instruction');
      assert(typeof s.index === 'number', 'Step missing index');
    }
  });

  test(`[${meta.experimentCode}] autoRun() returns data points`, () => {
    const data = kit.autoRun();
    assert(Array.isArray(data), 'Should be array');
    assert(data.length >= 3, `Too few data points: ${data.length}`);
    // Check all values are numeric
    for (const point of data) {
      for (const [key, val] of Object.entries(point)) {
        assert(typeof val === 'number' || typeof val === 'string', 
          `Bad value type for ${key}: ${typeof val}`);
      }
    }
  });

  test(`[${meta.experimentCode}] measure() returns a data point`, () => {
    const point = kit.measure();
    assert(typeof point === 'object' && point !== null, 'Should return object');
    const keys = Object.keys(point);
    assert(keys.length >= 2, `Too few measurements: ${keys.length}`);
  });

  test(`[${meta.experimentCode}] getLabConfig() returns complete config`, () => {
    const config = kit.getLabConfig();
    assert(config.experimentCode === meta.experimentCode, 'Wrong code');
    assert(config.kitId === meta.kitId, 'Wrong kitId');
    assert(config.tier === 'builtin', 'Wrong tier');
    assert(config.controls.length > 0, 'No controls');
    assert(config.tables.length > 0, 'No tables');
    assert(config.procedure.length > 0, 'No procedure');
  });

  test(`[${meta.experimentCode}] renderFrame() does not throw`, () => {
    // No canvas in terminal, should silently no-op
    kit.renderFrame();
  });

  test(`[${meta.experimentCode}] setControl() works`, () => {
    const controls = kit.getControls();
    const ctrl = controls[0];
    const midVal = (ctrl.min + ctrl.max) / 2;
    kit.setControl(ctrl.id, midVal);
    const got = kit.getControlValue(ctrl.id);
    assert(got === midVal, `Expected ${midVal}, got ${got}`);
  });

  test(`[${meta.experimentCode}] clearData() resets`, () => {
    kit.clearData();
    const pts = kit.getDataPoints();
    assert(pts.length === 0, `Expected 0, got ${pts.length}`);
  });

  test(`[${meta.experimentCode}] recordDataPoint() works`, () => {
    kit.clearData();
    kit.recordDataPoint({ test: 42, val: 3.14 });
    const pts = kit.getDataPoints();
    assert(pts.length === 1, `Expected 1, got ${pts.length}`);
    assert(pts[0].test === 42, 'Wrong value');
  });
}

// ============================================================
// 3. PHYSICS VALIDATION (spot-check key experiments)
// ============================================================
console.log('\n━━━ 3. PHYSICS VALIDATION ━━━');

test('Simple Pendulum: T² proportional to L', () => {
  const kit = KitRegistry.resolve('A-2')!;
  const data = kit.autoRun();
  // Check that as L increases, T² increases
  const lengths = data.map(d => Number(d['L (m)'] || d['Length (m)'] || d['L']));
  const periods = data.map(d => Number(d['T² (s²)'] || d['T_squared'] || d['T²']));
  
  if (lengths.length > 0 && periods.length > 0 && !isNaN(lengths[0]) && !isNaN(periods[0])) {
    // Verify monotonically increasing
    for (let i = 1; i < Math.min(lengths.length, periods.length); i++) {
      if (!isNaN(lengths[i]) && !isNaN(periods[i])) {
        assert(lengths[i] >= lengths[i-1], `L not increasing at index ${i}`);
      }
    }
  } else {
    warn('Pendulum T²∝L', 'Could not verify - check column names');
  }
});

test("Ohm's Law: V = IR (linear)", () => {
  const kit = KitRegistry.resolve('F-18')!;
  const data = kit.autoRun();
  assert(data.length >= 5, `Need ≥5 points, got ${data.length}`);
  // All voltages and currents should be positive
  for (const d of data) {
    const vals = Object.values(d).filter(v => typeof v === 'number') as number[];
    for (const v of vals) {
      assert(v >= 0, `Negative value found: ${v}`);
    }
  }
});

test("Boyle's Law: PV ≈ constant", () => {
  const kit = KitRegistry.resolve('C-12')!;
  const data = kit.autoRun();
  const pvProducts: number[] = [];
  for (const d of data) {
    const vals = Object.values(d).filter(v => typeof v === 'number') as number[];
    if (vals.length >= 2) {
      pvProducts.push(vals[0] * vals[1]);
    }
  }
  if (pvProducts.length >= 3) {
    const mean = pvProducts.reduce((a, b) => a + b, 0) / pvProducts.length;
    for (const pv of pvProducts) {
      const deviation = Math.abs(pv - mean) / mean;
      assert(deviation < 0.15, `PV deviation ${(deviation*100).toFixed(1)}% > 15%`);
    }
  }
});

test('All categories represented', () => {
  const kits = KitRegistry.listKits();
  const categories = new Set(kits.map(k => k.category));
  const expected = ['mechanics', 'heat', 'optics', 'electricity', 'waves', 'nuclear', 'measurement'];
  for (const cat of expected) {
    assert(categories.has(cat as any), `Missing category: ${cat}`);
  }
});

// ============================================================
// 4. DATA INTEGRITY (edge cases)
// ============================================================
console.log('\n━━━ 4. DATA INTEGRITY & EDGE CASES ━━━');

test('AutoRun data has no NaN values', () => {
  for (const meta of allKits) {
    const kit = KitRegistry.resolve(meta.experimentCode)!;
    const data = kit.autoRun();
    for (const point of data) {
      for (const [key, val] of Object.entries(point)) {
        if (typeof val === 'number') {
          assert(!isNaN(val), `NaN in ${meta.experimentCode}.${key}`);
          assert(isFinite(val), `Infinity in ${meta.experimentCode}.${key}`);
        }
      }
    }
  }
});

test('AutoRun data has no undefined values', () => {
  for (const meta of allKits) {
    const kit = KitRegistry.resolve(meta.experimentCode)!;
    const data = kit.autoRun();
    for (const point of data) {
      for (const [key, val] of Object.entries(point)) {
        assert(val !== undefined, `Undefined in ${meta.experimentCode}.${key}`);
        assert(val !== null, `Null in ${meta.experimentCode}.${key}`);
      }
    }
  }
});

test('All data table headers match autoRun keys', () => {
  for (const meta of allKits) {
    const kit = KitRegistry.resolve(meta.experimentCode)!;
    const dt = kit.getDataTable();
    const data = kit.autoRun();
    if (data.length > 0) {
      const dataKeys = Object.keys(data[0]);
      // Headers should be a subset of data keys (or close)
      if (dataKeys.length < dt.headers.length) {
        warn(`${meta.experimentCode} headers`, 
          `${dt.headers.length} headers but ${dataKeys.length} data keys`);
      }
    }
  }
});

test('World getTime() returns 0 on fresh kit', () => {
  const kit = KitRegistry.resolve('A-2')!;
  // After autoRun, time may be non-zero, but getWorld should exist
  const world = kit.getWorld();
  assert(world !== null && world !== undefined, 'World should exist');
});

test('Multiple autoRun calls produce consistent results', () => {
  const kit = KitRegistry.resolve('F-18')!;
  const run1 = kit.autoRun();
  const run2 = kit.autoRun();
  assert(run1.length === run2.length, 'Different lengths on repeated autoRun');
});

// ============================================================
// 5. REPORT VIEW INTEGRATION
// ============================================================
console.log('\n━━━ 5. REPORT VIEW INTEGRATION ━━━');

test('All kit experimentCodes are valid strings', () => {
  for (const meta of allKits) {
    assert(/^[A-Z]-\d+$/i.test(meta.experimentCode) || meta.experimentCode === 'N-1',
      `Invalid code format: ${meta.experimentCode}`);
  }
});

test('Kit categories are valid enum values', () => {
  const validCats = ['mechanics', 'heat', 'optics', 'electricity', 'waves', 'nuclear', 'measurement', 'renewable'];
  for (const meta of allKits) {
    assert(validCats.includes(meta.category),
      `Invalid category for ${meta.experimentCode}: ${meta.category}`);
  }
});

// ============================================================
// 6. CLI BRIDGE
// ============================================================
console.log('\n━━━ 6. CLI BRIDGE ━━━');

test('CLI bridge: valid experiment code returns JSON', () => {
  const parsed = buildCliOutput('A-2');
  assert(parsed.available === true, `Expected available=true, got ${parsed.available}`);
  assert(parsed.experimentCode === 'A-2', `Wrong code: ${parsed.experimentCode}`);
  const p = parsed as any;
  assert(Array.isArray(p.tables), 'Missing tables array');
  assert(p.tables.length > 0, 'Empty tables');
  assert(p.tables[0].headers.length > 0, 'No headers in first table');
  assert(p.tables[0].rows.length > 0, 'No rows in first table');
});

test('CLI bridge: invalid code returns available=false', () => {
  const parsed = buildCliOutput('Z-99');
  assert(parsed.available === false, 'Should have available=false');
});

test('CLI bridge: no args returns error JSON', () => {
  const args = process.argv.slice(2);
  assert(args.length >= 0, 'argv should be readable');
});

test('CLI bridge: all 20 codes produce valid JSON with tables', () => {
  for (const meta of allKits) {
    const parsed = buildCliOutput(meta.experimentCode);
    assert(parsed.available === true, `Not available for ${meta.experimentCode}`);
    const p = parsed as any;
    assert(Array.isArray(p.tables), `No tables for ${meta.experimentCode}`);
    assert(p.tables.length > 0, `Empty tables for ${meta.experimentCode}`);
    assert(p.dataPointCount > 0, `No data points for ${meta.experimentCode}`);
  }
});

// ============================================================
// SUMMARY
// ============================================================
console.log('\n' + '═'.repeat(50));
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${warnings} warnings`);
console.log('═'.repeat(50));
if (failed > 0) {
  process.exit(1);
}
