/**
 * Deploy the `api` edge function to Supabase.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/deploy-edge-function.mjs
 *
 * Get a token from Supabase -> Account Preferences -> Access Tokens.
 *
 * WHY IT BUNDLES FIRST
 * --------------------
 * The Management API accepts only a single `body` module for this endpoint; a
 * `files` array in the payload is silently ignored, and the multipart zip
 * endpoint returns "Entrypoint path does not exist" because the uploaded
 * archive is never extracted. So we bundle the whole function into one ESM file
 * with esbuild and send that as the body. Deno-native specifiers (npm:..., node:...)
 * are marked external and resolved by the runtime, so no import map is needed.
 *
 * DO NOT use `npx supabase functions deploy` for this project. It uploads assets
 * as `supabase/functions/api/<path>`, which bundles to a layout that registers
 * only some mounts and 404s the rest of the API.
 *
 * NOTE: the deployed artifact is a build output. Edit the TypeScript sources in
 * supabase/functions/api/ and re-run this script; never edit the bundle.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'covfkgjpufbsbcxagkgm';
const FUNCTION_NAME = 'api';
const API = 'https://api.supabase.com/v1';

// Deno resolves these natively; esbuild must not try to inline them.
const EXTERNAL = [
  'node:process',
  'node:crypto',
  'npm:pg@8.13.1',
  'npm:bcryptjs@2.4.3',
  'npm:jsonwebtoken@9.0.2',
];

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', 'supabase', 'functions', FUNCTION_NAME);

function bundle(entry) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'edge-')), 'bundle.mjs');
  const args = [
    '--yes', 'esbuild', entry,
    '--bundle', '--format=esm', '--platform=neutral',
    `--outfile=${out}`,
    ...EXTERNAL.map((s) => `--external:${s}`),
  ];
  // npx is a .cmd shim on Windows, which Node refuses to spawn without a shell.
  const quote = (s) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
  execFileSync(['npx', ...args.map(quote)].join(' '), {
    shell: true,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  return fs.readFileSync(out, 'utf8');
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error('Missing SUPABASE_ACCESS_TOKEN.');
    console.error('  SUPABASE_ACCESS_TOKEN=sbp_... node scripts/deploy-edge-function.mjs');
    process.exit(1);
  }
  if (!fs.existsSync(ROOT)) {
    console.error(`Function directory not found: ${ROOT}`);
    process.exit(1);
  }

  const body = bundle(path.join(ROOT, 'index.ts'));
  console.log(`Bundled ${ROOT} -> ${body.length} bytes`);

  const res = await fetch(`${API}/projects/${PROJECT_REF}/functions/${FUNCTION_NAME}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      entrypoint_path: 'index.js',
      // The app issues its own JWT (signed with JWT_SECRET), which is not a
      // Supabase JWT. The gateway would reject it with UNAUTHORIZED_LEGACY_JWT,
      // so auth is enforced by verifyToken inside the function instead.
      verify_jwt: false,
      body,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Deploy failed: HTTP ${res.status}`);
    console.error(text);
    process.exit(1);
  }
  console.log(`Deploy accepted: ${text.slice(0, 200)}`);

  const headers = { Authorization: `Bearer ${token}` };
  for (let attempt = 1; attempt <= 40; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(`${API}/projects/${PROJECT_REF}/functions/${FUNCTION_NAME}`, { headers });
    const status = await statusRes.json().catch(() => ({}));
    const state = status.status ?? 'UNKNOWN';
    console.log(`  [${attempt}] status: ${state}`);
    if (state === 'ACTIVE') {
      const health = await fetch(
        `https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_NAME}/health`,
      );
      console.log(`  /health -> ${health.status} ${await health.text()}`);
      return;
    }
    if (state === 'FAILED') {
      console.error('Build failed — check the function Logs tab.');
      process.exit(1);
    }
  }
  console.error('Timed out waiting for ACTIVE.');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});