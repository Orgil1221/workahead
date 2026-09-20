#!/usr/bin/env node
// Auto-append to .opencode/memory/CHANGELOG.md and MEMORY.md on post-commit
// Usage: node .opencode/scripts/log-change.mjs  (called by git hook and opencode)
// FOR AI ONLY — keeps changelog hands-off as requested
import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const CHANGELOG = join(ROOT, '.opencode', 'memory', 'CHANGELOG.md');
const MEMORY = join(ROOT, '.opencode', 'memory', 'MEMORY.md');

function sh(cmd) {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; }
}

const hash = sh('git log -1 --pretty=format:%h');
if (!hash) process.exit(0);
const subject = sh('git log -1 --pretty=format:%s');
const date = sh('git log -1 --pretty=format:%ad --date=iso-strict');
const files = sh('git diff --name-only HEAD~1 HEAD || git show --pretty="" --name-only HEAD').replace(/\n/g, ', ').slice(0, 180);
const shortDate = date ? date.slice(0, 16).replace('T', ' ') + ' UTC' : new Date().toISOString().slice(0,16) + ' UTC';

// Append to CHANGELOG.md
if (existsSync(CHANGELOG)) {
  const line = `- \`${shortDate} | ${hash} | ${files} | ${subject}\`\n`;
  // avoid duplicate if already logged
  const cur = readFileSync(CHANGELOG, 'utf8');
  if (!cur.includes(hash)) {
    appendFileSync(CHANGELOG, line);
    console.log(`[log-change] appended ${hash} to CHANGELOG.md`);
  }
}

// Update MEMORY.md Last 5 (optional: keep in sync)
// For now just ensure MEMORY.md exists; opencode will rewrite Last 5 on next analyze via reading git log, no auto-edit needed here
