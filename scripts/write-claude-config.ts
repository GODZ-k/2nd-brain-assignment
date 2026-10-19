import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

/*
 * Adds (or removes) this project's MCP servers in Claude Desktop's config.
 *
 *   stdio  one entry per role:   financial-graph-admin / -merchant / -customer
 *          Desktop launches src/index.ts itself, with --role and --caller.
 *
 *   http   ONE entry:            financial-graph-http
 *          A small "mcp-remote" bridge to your running `npm run start:http` server
 *          (Desktop can't use a local HTTP URL directly). It authenticates with the single
 *          token MCP_TOKEN from .env. The server decides who the caller is from MCP_ROLE and
 *          MCP_CALLER_ID in .env, so to switch role you edit those two values and restart
 *          `npm run start:http`. The Claude config does not change.
 *
 *   npm run claude:config                          stdio (all roles) + the one http entry
 *   npm run claude:config -- --transport=stdio     only stdio entries
 *   npm run claude:config -- --transport=http      only the http entry
 *   npm run claude:config -- --roles=customer      only some stdio roles (ignored for http)
 *   npm run claude:config -- --check               check existing entries only (writes nothing)
 *   npm run claude:config -- --remove              remove the entries this script added
 *   npm run claude:config -- --dry-run             show what would be written, change nothing
 *
 * Other flags:
 *   --port=3000               port of the HTTP server (default: PORT env or 3000)
 *   --merchant-id=            caller ID for the merchant stdio entry
 *   --customer-id=            caller ID for the customer stdio entry
 *   --config=<path>           use a specific config file (skips auto-detection)
 *   --embed-env               stdio: copy DATABASE_URL into the config instead of pointing at .env
 *
 * The http entry is skipped (with a warning) if MCP_TOKEN is not set in .env.
 * Old per-role http entries (financial-graph-http-admin/-merchant/-customer) from earlier
 * versions of this script are removed automatically.
 *
 * Only entries named "financial-graph-..." are touched; everything else in the file is kept.
 */

type Role = 'admin' | 'merchant' | 'customer';
type Transport = 'stdio' | 'http';

const ALL_ROLES: Role[] = ['admin', 'merchant', 'customer'];
const ALL_TRANSPORTS: Transport[] = ['stdio', 'http'];

interface ServerEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface Options {
  roles: Role[];
  transports: Transport[];
  port: number;
  merchantId: string;
  customerId: string;
  configPath?: string;
  remove: boolean;
  dryRun: boolean;
  check: boolean;
  embedEnv: boolean;
}

interface Planned {
  name: string;
  transport: Transport;
  entry: ServerEntry;
  role?: Role; // stdio only
  url?: string; // http only
  token?: string; // http only
}

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');

const HTTP_ENTRY_NAME = 'financial-graph-http';
const stdioName = (role: Role) => `financial-graph-${role}`;
// Entries written by older versions of this script (one http server per role).
const LEGACY_HTTP_NAMES = ALL_ROLES.map((role) => `financial-graph-http-${role}`);

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseOptions(): Options {
  const opts: Options = {
    roles: [...ALL_ROLES],
    transports: [...ALL_TRANSPORTS],
    port: Number(process.env.PORT ?? 3000),
    merchantId: 'merch_001',
    customerId: 'cust_001',
    remove: false,
    dryRun: false,
    check: false,
    embedEnv: false,
  };

  for (const arg of process.argv.slice(2)) {
    const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : '';

    if (arg.startsWith('--roles=')) {
      const roles = value.split(',').map((r) => r.trim()).filter(Boolean) as Role[];
      if (roles.length === 0 || roles.some((r) => !ALL_ROLES.includes(r))) {
        throw new Error(`Invalid --roles "${value}". Use any of: ${ALL_ROLES.join(', ')}`);
      }
      opts.roles = roles;
    } else if (arg.startsWith('--transport=')) {
      const list =
        value === 'both' ? ALL_TRANSPORTS : (value.split(',').map((t) => t.trim()) as Transport[]);
      if (list.length === 0 || list.some((t) => !ALL_TRANSPORTS.includes(t))) {
        throw new Error(`Invalid --transport "${value}". Use stdio, http, or both`);
      }
      opts.transports = list;
    } else if (arg.startsWith('--port=')) {
      opts.port = Number(value);
    } else if (arg.startsWith('--merchant-id=')) {
      opts.merchantId = value;
    } else if (arg.startsWith('--customer-id=')) {
      opts.customerId = value;
    } else if (arg.startsWith('--config=')) {
      opts.configPath = path.resolve(value);
    } else if (arg === '--remove') {
      opts.remove = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--check') {
      opts.check = true;
    } else if (arg === '--embed-env') {
      opts.embedEnv = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    throw new Error(`Invalid port "${opts.port}"`);
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Config file location + IO
// ---------------------------------------------------------------------------

function claudeConfigPath(): string {
  if (process.platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library/Application Support/Claude/claude_desktop_config.json',
    );
  }

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    const regularPath = appData
      ? path.join(appData, 'Claude', 'claude_desktop_config.json')
      : null;

    // Microsoft Store Claude sandboxes Roaming under Packages\...\LocalCache\Roaming\Claude
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const packages = path.join(localAppData, 'Packages');
      if (fs.existsSync(packages)) {
        const storeClaude = fs.readdirSync(packages).find((n) => n.startsWith('Claude_'));
        if (storeClaude) {
          const storePath = path.join(
            packages,
            storeClaude,
            'LocalCache',
            'Roaming',
            'Claude',
            'claude_desktop_config.json',
          );
          // Only use the Store path if that install actually has a Claude folder.
          if (fs.existsSync(path.dirname(storePath))) return storePath;
        }
      }
    }

    if (!regularPath) throw new Error('APPDATA is not set');
    return regularPath;
  }

  return path.join(os.homedir(), '.config/Claude/claude_desktop_config.json');
}

function readJsonFile(filePath: string): Record<string, unknown> {
  // PowerShell Set-Content -Encoding utf8 writes a BOM; strip it before parse.
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function writeJsonAtomic(filePath: string, data: unknown) {
  // Write to a temp file then rename, so a crash can't leave a half-written config.
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8' });
  fs.renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// stdio entries
// ---------------------------------------------------------------------------

function buildStdioEntry(role: Role, callerId: string, opts: Options): ServerEntry {
  const tsxCli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const tsconfig = path.join(ROOT, 'tsconfig.json');
  const entry = path.join(ROOT, 'src', 'index.ts');

  for (const [label, p] of [
    ['tsx CLI (run npm install)', tsxCli],
    ['tsconfig.json', tsconfig],
    ['entry file', entry],
  ] as const) {
    if (!fs.existsSync(p)) throw new Error(`Missing ${label}: ${p}`);
  }

  const env: Record<string, string> = {
    MCP_ROLE: role,
    MCP_CALLER_ID: callerId,
    // stdout is reserved for the MCP protocol; stop dotenv from printing to it.
    DOTENV_CONFIG_QUIET: 'true',
  };

  if (opts.embedEnv) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing in .env');
    env.DATABASE_URL = process.env.DATABASE_URL;
  } else {
    // Keep the database password out of the Claude config: point dotenv at the project's .env.
    if (!fs.existsSync(ENV_FILE)) throw new Error(`Missing ${ENV_FILE} (or rerun with --embed-env)`);
    env.DOTENV_CONFIG_PATH = ENV_FILE;
  }

  return {
    // Absolute path to the Node binary running this script. Claude Desktop does not
    // inherit your shell PATH, so plain "node" often fails (especially with nvm/fnm).
    command: process.execPath,
    args: [
      tsxCli,
      // Claude Desktop starts the process from its own folder, so tsx cannot find
      // tsconfig.json on its own and the "@/..." path aliases would fail to resolve.
      '--tsconfig',
      tsconfig,
      entry,
      `--role=${role}`,
      ...(role === 'admin' ? [] : [`--caller=${callerId}`]),
    ],
    env,
  };
}

const callerFor = (role: Role, opts: Options) =>
  role === 'admin' ? 'admin' : role === 'merchant' ? opts.merchantId : opts.customerId;

// ---------------------------------------------------------------------------
// http entry (one bridge, one token)
// ---------------------------------------------------------------------------

function npxPath(): string {
  // Desktop doesn't inherit your shell PATH, so use the npx that sits next to this Node.
  const candidate = path.join(
    path.dirname(process.execPath),
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
  );
  return fs.existsSync(candidate) ? candidate : 'npx';
}

function buildHttpEntry(url: string, token: string): ServerEntry {
  return {
    command: npxPath(),
    args: [
      '-y',
      'mcp-remote',
      url,
      // The bridge refuses plain http:// URLs without this (this one is localhost only).
      '--allow-http',
      '--header',
      // ${AUTH} is filled in by mcp-remote from env below. Keeping the token out of args
      // avoids Windows mangling the space in "Bearer <token>".
      'Authorization:${AUTH}',
    ],
    env: { AUTH: `Bearer ${token}` },
  };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

interface CheckResult {
  ok: boolean;
  warn?: boolean;
  detail: string;
}

const INITIALIZE_REQUEST = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'config-check', version: '1.0.0' },
  },
};

// stdio: start the server like Claude Desktop would and send `initialize`
function smokeTestStdio(entry: ServerEntry, timeoutMs = 25000): Promise<CheckResult> {
  return new Promise((resolve) => {
    const child = spawn(entry.command, entry.args, {
      cwd: os.tmpdir(), // not the project folder, same as Claude Desktop
      env: { ...process.env, ...(entry.env ?? {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buffer = '';
    let stderr = '';
    let done = false;

    const tail = () => stderr.trim().split('\n').slice(-6).join('\n');
    const finish = (ok: boolean, detail: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill();
      resolve({ ok, detail });
    };

    const timer = setTimeout(
      () => finish(false, `no response within ${timeoutMs / 1000}s\n${tail()}`),
      timeoutMs,
    );

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === 1 && msg.result) {
            finish(
              true,
              `${msg.result.serverInfo?.name ?? 'server'} ${msg.result.serverInfo?.version ?? ''}`.trim(),
            );
          } else if (msg.id === 1 && msg.error) {
            finish(false, `initialize error: ${msg.error.message}`);
          }
        } catch {
          finish(false, `non-JSON on stdout (this breaks the protocol): ${line.slice(0, 120)}`);
        }
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => finish(false, err.message));
    child.on('exit', (code) => finish(false, `exited early (code ${code})\n${tail()}`));

    child.stdin.write(JSON.stringify(INITIALIZE_REQUEST) + '\n');
  });
}

// http: POST `initialize` to the running server with the same bearer token the bridge will send
async function checkHttp(url: string, token: string): Promise<CheckResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(INITIALIZE_REQUEST),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) return { ok: true, detail: `HTTP ${res.status}` };

    if (res.status === 401) {
      return {
        ok: false,
        detail:
          'HTTP 401: MCP_TOKEN does not match the running server. Restart `npm run start:http` so it reads the current .env.',
      };
    }

    return { ok: false, detail: `HTTP ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      warn: true,
      detail:
        `server not reachable (${(err as Error).message}). ` +
        'Start it with `npm run start:http`, then rerun --check.',
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const maskSecrets = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value)
      .replace(/("DATABASE_URL":")[^"]*/g, '$1***')
      .replace(/("AUTH":"Bearer )[^"]*/g, '$1***'),
  );

const printSkipped = (skipped: string[]) => {
  if (skipped.length) console.log(`Skipped:\n${skipped.map((s) => `  ${s}`).join('\n')}`);
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseOptions();
  const configPath = opts.configPath ?? claudeConfigPath();

  const wantStdio = opts.transports.includes('stdio');
  const wantHttp = opts.transports.includes('http');

  let existing: Record<string, unknown> = {};
  const fileExists = fs.existsSync(configPath);

  // -------------------------------------------------------------------------
  // Read existing config
  // -------------------------------------------------------------------------

  if (fileExists) {
    try {
      existing = readJsonFile(configPath);
    } catch (err: unknown) {
      throw new Error(
        `Existing config is not valid JSON, refusing to overwrite it:\n  ${configPath}\n${(err as Error).message}`,
        { cause: err },
      );
    }
  }

  const existingServers = { ...((existing.mcpServers as Record<string, unknown>) ?? {}) };

  // -------------------------------------------------------------------------
  // Build the entries we are interested in
  // -------------------------------------------------------------------------

  const planned: Planned[] = [];
  const skipped: string[] = [];

  if (wantStdio) {
    for (const role of opts.roles) {
      planned.push({
        name: stdioName(role),
        transport: 'stdio',
        role,
        entry: buildStdioEntry(role, callerFor(role, opts), opts),
      });
    }
  }

  // The http server uses ONE token and ONE identity (MCP_ROLE / MCP_CALLER_ID in .env),
  // so there is exactly one http entry, whatever --roles says.
  if (wantHttp && !opts.remove) {
    const token = process.env.MCP_TOKEN;
    if (!token) {
      skipped.push(`${HTTP_ENTRY_NAME} (MCP_TOKEN is not set in .env)`);
    } else {
      const url = `http://127.0.0.1:${opts.port}/mcp`;
      planned.push({
        name: HTTP_ENTRY_NAME,
        transport: 'http',
        entry: buildHttpEntry(url, token),
        url,
        token,
      });
    }
  }

  console.log(`Config file: ${configPath}`);

  // -------------------------------------------------------------------------
  // CHECK MODE: nothing below this block runs, so nothing is written
  // -------------------------------------------------------------------------

  if (opts.check) {
    if (!fileExists) {
      console.log('\nClaude Desktop config file does not exist.\n\nNothing to check.');
      process.exitCode = 1;
      return;
    }

    printSkipped(skipped);
    console.log('\nChecking existing server configuration...');

    let failed = false;

    for (const p of planned) {
      // Test the entry that is actually in the Claude config, not a freshly built one.
      const existingEntry = existingServers[p.name] as ServerEntry | undefined;

      if (!existingEntry) {
        console.log(`  FAIL ${p.name}: server is not configured`);
        failed = true;
        continue;
      }

      const result =
        p.transport === 'stdio'
          ? await smokeTestStdio(existingEntry)
          : await checkHttp(p.url!, p.token!);

      const label = result.ok ? 'OK  ' : result.warn ? 'WARN' : 'FAIL';
      console.log(`  ${label} ${p.name}: ${result.detail}`);

      if (!result.ok && !result.warn) failed = true;
    }

    if (failed) {
      console.log('\nSome servers failed the check.');
      process.exitCode = 1;
    } else {
      console.log('\nAll configured servers passed the check.');
    }
    return;
  }

  // -------------------------------------------------------------------------
  // REMOVE MODE
  // -------------------------------------------------------------------------

  if (opts.remove) {
    const servers = { ...existingServers };
    const removed: string[] = [];

    const drop = (name: string) => {
      if (name in servers) {
        delete servers[name];
        removed.push(name);
      }
    };

    if (wantStdio) for (const role of opts.roles) drop(stdioName(role));
    if (wantHttp) for (const name of [HTTP_ENTRY_NAME, ...LEGACY_HTTP_NAMES]) drop(name);

    const next = { ...existing, mcpServers: servers };

    if (opts.dryRun) {
      console.log(
        'Dry run, nothing written. mcpServers would be:\n' +
          JSON.stringify(maskSecrets(servers), null, 2),
      );
      return;
    }

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    if (fileExists) fs.copyFileSync(configPath, `${configPath}.bak`);
    writeJsonAtomic(configPath, next);
    readJsonFile(configPath); // confirm what we wrote is valid JSON

    console.log(removed.length ? `Removed: ${removed.join(', ')}` : 'Nothing to remove.');
    return;
  }

  // -------------------------------------------------------------------------
  // ADD / UPDATE MODE
  // -------------------------------------------------------------------------

  const servers = { ...existingServers };

  // Clean up per-role http entries from older versions of this script.
  const legacyRemoved: string[] = [];
  if (wantHttp) {
    for (const name of LEGACY_HTTP_NAMES) {
      if (name in servers) {
        delete servers[name];
        legacyRemoved.push(name);
      }
    }
  }

  for (const p of planned) servers[p.name] = p.entry;

  const next = { ...existing, mcpServers: servers };

  printSkipped(skipped);

  if (opts.dryRun) {
    console.log(
      'Dry run, nothing written. mcpServers would be:\n' +
        JSON.stringify(maskSecrets(servers), null, 2),
    );
    return;
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  if (fileExists) fs.copyFileSync(configPath, `${configPath}.bak`); // backup before changing
  writeJsonAtomic(configPath, next);
  readJsonFile(configPath); // re-read to confirm what we wrote is valid JSON

  console.log(`Added/updated:\n${planned.map((p) => `  ${p.name}`).join('\n')}`);

  if (legacyRemoved.length) {
    console.log(`\nRemoved old per-role http entries: ${legacyRemoved.join(', ')}`);
  }

  if (planned.some((p) => p.transport === 'http')) {
    const role = process.env.MCP_ROLE ?? '(not set)';
    const caller = process.env.MCP_CALLER_ID ?? '(not set)';
    console.log(
      `\nThe http server runs as role=${role}, caller=${caller} (from MCP_ROLE / MCP_CALLER_ID in .env).`,
    );
    console.log(
      `To switch role, edit those two values and restart \`npm run start:http\` (port ${opts.port}).`,
    );
    console.log('The Claude config does not need to change.');
  }

  console.log('\nFully quit Claude Desktop (including the tray icon) and reopen it.');
  console.log('Tip: rerun with --check to verify the entries before opening Claude Desktop.');
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});