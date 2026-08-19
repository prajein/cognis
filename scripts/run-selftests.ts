/**
 * Self-test Runner
 *
 * What & why: the repo has 30+ `*.selftest.ts` files (Definition of Done:
 * every module ships a tiny self-test), but until now nothing actually ran
 * them as a set — `npm test` only validates schemas and builds brain-map
 * assets. Each selftest file already documents its own manual invocation
 * (`tsc --module commonjs ... && node ...`) and, when run, auto-executes its
 * checks and exits with code 0 (pass) or 1 (fail). This script does the same
 * thing generically for every file, via `npx tsx <file>` (the pattern already
 * used by `generate:brain-maps`/`verify:brain-maps`), without depending on
 * any file's internal export names — it just runs each file as its own
 * script and reads the process exit code, exactly as the header comments in
 * each file instruct a human to do by hand.
 *
 * Run: npx tsx scripts/run-selftests.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const SRC_ROOT = path.join(__dirname, '..', 'src');
const PER_FILE_TIMEOUT_MS = 30_000;
const TAIL_LINES_ON_FAILURE = 20;

function findSelfTestFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findSelfTestFiles(fullPath, out);
    } else if (entry.endsWith('.selftest.ts')) {
      out.push(fullPath);
    }
  }
  return out;
}

interface RunResult {
  readonly file: string;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly output: string;
}

function runOne(file: string): RunResult {
  const start = Date.now();
  try {
    const output = execFileSync('npx', ['tsx', file], {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: PER_FILE_TIMEOUT_MS,
    });
    return { file, passed: true, durationMs: Date.now() - start, output };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = `${e.stdout ?? ''}${e.stderr ?? ''}` || e.message || String(err);
    return { file, passed: false, durationMs: Date.now() - start, output };
  }
}

function relative(file: string): string {
  return path.relative(path.join(__dirname, '..'), file);
}

function main(): void {
  const files = findSelfTestFiles(SRC_ROOT).sort();
  console.log(`[run-selftests] Discovered ${files.length} selftest file(s).\n`);

  const results: RunResult[] = [];
  for (const file of files) {
    process.stdout.write(`  ${relative(file)} ... `);
    const result = runOne(file);
    results.push(result);
    console.log(`${result.passed ? 'PASS' : 'FAIL'} (${result.durationMs}ms)`);
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n[run-selftests] ${results.length - failed.length}/${results.length} selftest files passed.`);

  if (failed.length > 0) {
    console.error(`\n[run-selftests] ${failed.length} file(s) failed:\n`);
    for (const f of failed) {
      console.error(`--- ${relative(f.file)} ---`);
      const tail = f.output.trim().split('\n').slice(-TAIL_LINES_ON_FAILURE).join('\n');
      console.error(tail || '(no output captured)');
      console.error('');
    }
    process.exit(1);
  }
}

main();
