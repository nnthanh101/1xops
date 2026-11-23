// The 1xops commands: doctor, install, config, env, profiles, setup. Same behaviour as the Python
// package (packages/python/src/one_xops/cli.py and setup.py). Nothing changes unless --yes is given.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, constants, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path, { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { styleText } from 'node:util';
import * as cf from './config-file.mjs';
import * as s from './settings.mjs';

const color = (style, text) => styleText(style, text, { stream: process.stdout });

export function which(cmd) {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    const file = path.join(dir, cmd);
    try {
      accessSync(file, constants.X_OK);
      return file;
    } catch {
      // not here
    }
  }
  return null;
}

export class OutOfTime extends Error {}
let deadline = null; // set only while a session-start check runs

export function run(cmd, args, timeout = 20000) {
  let limit = timeout;
  if (deadline !== null) { // each call gets only the time that is left
    const left = deadline - Date.now();
    if (left <= 0) throw new OutOfTime();
    limit = Math.min(timeout, left);
  }
  const p = spawnSync(cmd, args, { encoding: 'utf8', timeout: limit });
  if (p.error?.code === 'ETIMEDOUT' && limit < timeout) throw new OutOfTime();
  if (p.error) return { code: 1, out: String(p.error.message) };
  return { code: p.status ?? 1, out: (p.stdout || p.stderr || '').trim() };
}

export const mask = (account) => (account.length >= 4 ? `****${account.slice(-4)}` : '****');
// An AWS account ID (exactly 12 digits, not part of a longer number or a decimal) and an Azure ID, masked:
// doctor output is pasted onto issues as evidence.
const GUID = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;
const ACCOUNT_ID = /(?<!\d)(?<!\d\.)\d{12}(?!\d|\.\d)/g;
export const scrub = (text) => String(text).replace(GUID, (d) => mask(d)).replace(ACCOUNT_ID, (d) => mask(d));
// read: the role cannot change anything; write: it can; unknown: cannot tell from the name.
export function accessFromRole(arn = '') {
  const role = arn.match(/:assumed-role\/([^/]+)\//)?.[1] ?? arn.match(/:(user|root)\b/)?.[1] ?? '';
  if (/readonly|viewonly|securityaudit|readaccess|viewer/i.test(role)) return 'read';
  if (/admin|poweruser|fullaccess|root/i.test(role)) return 'write';
  return 'unknown';
}
const ACCESS = { read: 'read-only', write: 'can change things: use a read-only role', unknown: 'access unknown: use a read-only role' };

// The same look as the Python CLI's rich table: a heavy header, light rows, colour on a terminal. No dependency.
// On a terminal the table fits the window: the widest columns shrink and their cells wrap, as rich does.
// Piped (the assistant, evidence) it sizes to its content, so both CLIs print the same bytes.
const visible = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '').length;
function wrap(text, w) {
  if (visible(text) <= w) return [String(text)];
  // A coloured cell wraps on its plain text; each line then gets the colour again, so no code is cut or bleeds.
  const styled = String(text).match(/^(\x1b\[[0-9;]*m)(.*?)(\x1b\[[0-9;]*m)$/s);
  if (styled) return wrap(styled[2], w).map((l) => styled[1] + l + styled[3]);
  const lines = [];
  let line = '';
  for (const word of String(text).split(' ')) {
    for (let piece = word; piece.length; ) {
      const room = line ? w - line.length - 1 : w;
      if (piece.length <= room) { line = line ? `${line} ${piece}` : piece; piece = ''; }
      else if (line) { lines.push(line); line = ''; }
      else { lines.push(piece.slice(0, w)); piece = piece.slice(w); }
    }
  }
  if (line) lines.push(line);
  return lines;
}
function table(title, columns, rows) {
  const width = columns.map((c, i) => Math.max(c.length, ...rows.map((r) => visible(r[i]))));
  const limit = process.stdout.isTTY ? (process.stdout.columns || 80) - (3 * width.length + 1) : Infinity;
  while (width.reduce((a, w) => a + w, 0) > limit) {
    const i = width.indexOf(Math.max(...width));
    if (width[i] <= 8) break;
    width[i] -= 1;
  }
  const pad = (c, i) => String(c) + ' '.repeat(Math.max(0, width[i] - visible(c)));
  const cells = (r, bar) => {
    const parts = r.map((c, i) => wrap(c, width[i]));
    const height = Math.max(...parts.map((p) => p.length));
    return Array.from({ length: height }, (_, k) => `${bar} ${parts.map((p, i) => pad(p[k] ?? '', i)).join(` ${bar} `)} ${bar}`).join('\n');
  };
  const rule = (l, m, r, h) => l + width.map((w) => h.repeat(w + 2)).join(m) + r;
  const total = width.reduce((a, w) => a + w + 3, 1);
  const left = Math.max(0, Math.floor((total - title.length) / 2));
  console.log(' '.repeat(left) + color('bold', title) + ' '.repeat(Math.max(0, total - left - title.length)));
  console.log(rule('┏', '┳', '┓', '━'));
  console.log(cells(columns.map((c) => color('bold', c)), '┃'));
  console.log(rule('┡', '╇', '┩', '━'));
  for (const r of rows) console.log(cells(r, '│'));
  console.log(rule('└', '┴', '┘', '─'));
}

// ── container ───────────────────────────────────────────────────────────────

// In the 1xops image (it sets ONEXOPS_CONTAINER=1), sign-ins are made on the host and mounted in; nothing signs
// in inside. A marker, not /.dockerenv: CI runners and other containers keep the behaviour of a person's machine.
export const CONTAINER = process.env.ONEXOPS_CONTAINER === '1';
const ON_HOST = CONTAINER ? ' on the host' : '';
const HOST_ONLY = [s.HOST, 'uv', 'npx', 'docker']; // the person's own machine: in a container, shown only when there
const ENV_FILE = /^\.env(\..+)?$/;
const ENV_KEEP = /^\.env\.1xops$|\.(example|sample|template)$/;

const tilde = (p) => {
  const home = homedir();
  return p === home || p.startsWith(`${home}/`) ? `~${p.slice(home.length)}` : p;
};

// Mount point: its options, from the kernel's own list (/proc/self/mountinfo). Empty outside Linux.
function mounts() {
  let text;
  try { text = readFileSync('/proc/self/mountinfo', 'utf8'); } catch { return {}; }
  const out = {};
  for (const line of text.split('\n')) {
    const f = line.split(' ');
    if (f.length > 5) out[f[4].replaceAll('\\040', ' ')] = f[5].split(',');
  }
  return out;
}

// `.env` files under root (names only, never read), `depth` folders down.
function envFiles(root, depth) {
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)); } catch { return []; }
  const found = [];
  for (const e of entries) {
    if (e.isFile() && ENV_FILE.test(e.name) && !ENV_KEEP.test(e.name)) found.push(join(root, e.name));
    else if (depth && e.isDirectory() && !['.git', 'node_modules'].includes(e.name)) found.push(...envFiles(join(root, e.name), depth - 1));
  }
  return found;
}

const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

// [status, detail] of what the container can reach besides the read-only sign-in.
// Reads file names, environment names and mount options only; no file content.
export function checkIsolation() {
  const home = homedir();
  const m = mounts();
  const config = process.env.AWS_CONFIG_FILE || '';
  const aws = Object.keys(m).filter((p) => p.startsWith(`${home}/.aws`) || (config && p === config));
  const fixes = aws.filter((p) => !m[p].includes('ro')).map((p) => `${tilde(p)} is writable: mount it with :ro`);
  const ssh = join(home, '.ssh');
  if (isDir(ssh) && readdirSync(ssh).length) fixes.push('SSH keys in ~/.ssh: remove that mount');
  if (process.env.SSH_AUTH_SOCK) fixes.push('an SSH agent is passed in: remove SSH_AUTH_SOCK and its socket mount');
  for (const f of new Set([process.env.AWS_SHARED_CREDENTIALS_FILE, `${home}/.aws/credentials`].filter(Boolean))) {
    if (isFile(f)) fixes.push(`static AWS credentials file ${tilde(f)}: remove that mount`);
  }
  if (process.env.AWS_ACCESS_KEY_ID) fixes.push('static AWS key in AWS_ACCESS_KEY_ID: remove that -e');
  if (isDir(join(home, '.azure'))) fixes.push("default Azure login in ~/.azure: remove that mount, mount the Reader's own folder");
  const envs = [...new Set([...envFiles(process.cwd(), 2), ...envFiles(home, 0)])];
  if (envs.length) fixes.push(`host .env files (${envs.slice(0, 3).map(tilde).join(', ')}${envs.length > 3 ? ', …' : ''}): remove that mount`);
  if (fixes.length) return ['check', fixes.join('; ')];
  return ['ready', [
    aws.length ? 'AWS folder read-only' : 'no AWS folder',
    process.env.AZURE_CONFIG_DIR ? 'Azure folder its own' : 'no Azure folder',
    'no SSH keys, no static AWS credentials, no host .env files',
  ].join(', ')];
}

// ── doctor ──────────────────────────────────────────────────────────────────

export function checkTools() {
  const tools = [['git', true], [s.HOST, true], ['uv', false], ['npx', false], ['docker', false], ['gh', false], ['aws', false], ['az', false]];
  return tools.filter(([name]) => !(CONTAINER && HOST_ONLY.includes(name) && !which(name))).map(([name, required]) => {
    const where = which(name);
    if (!where) return [name, required, false, 'not found on PATH'];
    const { code, out } = run(name, ['--version']);
    return [name, required, code === 0, out ? out.split('\n')[0] : where];
  });
}

// Which 1xops plugin edition is installed, from the host's own plugin records. Read-only.
export function checkEdition(cli = '') {
  const folder = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), `.${s.HOST}`), 'plugins');
  const read = (name) => { try { return JSON.parse(readFileSync(path.join(folder, name), 'utf8')); } catch { return {}; } };
  const installed = read('installed_plugins.json').plugins ?? {};
  const version = (key) => (installed[key]?.[0]?.version ?? '');
  if ('1xops@1xops' in installed) {
    if (read('known_marketplaces.json')['1xops']?.source?.repo === 'nnthanh101/1xops') return ['edition', false, false, 'free, old marketplace name: run 1xops install --yes'];
    return editionRow('enterprise', version('1xops@1xops'), cli);
  }
  if ('1xops@1ops' in installed) return editionRow('free', version('1xops@1ops'), cli);
  return ['edition', false, false, 'plugin not installed: 1xops install --yes'];
}

const semver = (text) => (String(text).match(/\d+/g) ?? []).slice(0, 3).map(Number);
const compare = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? 0) - (b[i] ?? 0); if (d) return Math.sign(d); } return 0; };

// The plugin and this command ship together: name the one that is behind, with its update.
function editionRow(edition, plugin, cli) {
  const found = `${edition} ${plugin}`.trim();
  const order = plugin && cli ? compare(semver(plugin), semver(cli)) : 0;
  if (order > 0) return ['edition', false, false, `${found}; this 1xops command is ${cli}: uv tool install 1xops@latest (or npm install -g 1xops@latest)`];
  if (order < 0) return ['edition', false, false, `${found}; this 1xops command is ${cli}: run /plugin update 1xops in the assistant`];
  return ['edition', false, true, found];
}

const READER_HINT = `use a Reader identity in its own folder: AZURE_CONFIG_DIR=~/.azure-reader az login${ON_HOST}`;

// Read-only sign-in checks. Account IDs are masked, never printed in full.
export function checkSignIn(awsProfile) {
  const rows = [];
  if (which('aws')) {
    const args = ['sts', 'get-caller-identity', '--output', 'json', ...(awsProfile ? ['--profile', awsProfile] : [])];
    const { code, out } = run('aws', args);
    if (code === 0) {
      let id = {};
      try { id = JSON.parse(out); } catch { /* not JSON */ }
      const access = accessFromRole(id.Arn);
      rows.push(['aws sign-in', false, true, `signed in, account ${mask(id.Account ?? '')}`]);
      rows.push(['aws access', false, access === 'read', ACCESS[access]]);
    } else rows.push(['aws sign-in', false, false, `not signed in (aws sso login${ON_HOST})`]);
  }
  if (which('az') && !process.env.AZURE_CONFIG_DIR) {
    // the default login is never read: it is a person's own, and it may change things
    rows.push(['azure sign-in', false, false, `not checked: ${READER_HINT}`]);
  } else if (which('az')) {
    const { code } = run('az', ['account', 'show', '--output', 'none']);
    rows.push(['azure sign-in', false, code === 0, code === 0 ? 'Reader folder signed in' : `not signed in: ${READER_HINT}`]);
  }
  if (which('gh')) {
    const { code } = run('gh', ['auth', 'status']);
    rows.push(['github sign-in', false, code === 0, code === 0 ? 'signed in' : 'not signed in (gh auth login)']);
  }
  return rows;
}

// (status, fix) for a failed AWS identity call, from the AWS CLI's own error text.
export function awsFix(error, profile) {
  if (/could not be found/i.test(error)) return ['missing', `profile ${profile} not found: aws configure sso --profile ${profile}, or set AWS_CONFIG_FILE`];
  if (/read-only file system.*\.aws\/cli/i.test(error)) return ['check', 'mount only the AWS config file and ~/.aws/sso, read-only (README docker run line)'];
  if (/expired|refresh failed|sso.*token|nocredentials|unable to locate credentials|read-only file system/i.test(error)) return ['signed out', `aws sso login --profile ${profile}${ON_HOST}`];
  const first = error.split('\n').find((l) => l.trim()) ?? 'AWS identity call failed';
  return ['check', first.replace(/^aws: \[ERROR\]: /, '').slice(0, 120)];
}

// read: Reader roles only; write: any role that can change things; unknown: no roles seen.
export function azureAccess(roles = []) {
  if (!roles.length) return 'unknown';
  if (roles.some((r) => /owner|contributor|administrator/i.test(r))) return 'write';
  if (roles.every((r) => /reader/i.test(r))) return 'read';
  return 'unknown';
}
const AZURE_ACCESS = { read: 'read-only', write: 'can change things: use a read-only (Reader) identity', unknown: 'access unknown: use a read-only (Reader) identity' };

export function awsConnector(v, values) {
  const name = `aws ${v}`;
  const profile = values[v] || process.env[v] || '';
  if (!profile) return [name, 'missing', `set ${v} in .env.1xops or the shell (1xops setup)`];
  if (!which('aws')) return [name, 'missing', 'install the AWS CLI'];
  const { code, out } = run('aws', ['sts', 'get-caller-identity', '--output', 'json', '--profile', profile]);
  if (code !== 0) return [name, ...awsFix(out, profile)];
  let id;
  try { id = JSON.parse(out); } catch { return [name, 'check', 'AWS identity call returned no account']; }
  const account = id.Account ?? '';
  const expected = v.endsWith('_PROFILE') ? values[v.replace('_PROFILE', '_ACCOUNT')] || '' : '';
  if (expected && account !== expected) return [name, 'wrong account', `profile ${profile} is ${mask(account)}, this tenant expects ${mask(expected)}: aws configure sso --profile ${profile}`];
  const access = accessFromRole(id.Arn ?? '');
  let detail = `profile ${profile}, account ${mask(account)}, ${ACCESS[access]}`;
  if (longLivedKey(profile)) return [name, 'check', `${detail}; long-lived access key: use SSO, aws configure sso --profile ${profile}`];
  const end = SIGN_IN_ENDS ? ssoEnd(profile) : null;
  if (end && SIGN_IN_ENDS) {
    SIGN_IN_ENDS[name] = [end, `aws sso login --profile ${profile}${ON_HOST}`];
    detail += `, signed in until ${utc(end)} UTC`;
  }
  return [name, access === 'read' ? 'ready' : 'check', detail];
}

// connector: [when its sign-in ends, the sign-in command]. An object only during `1xops doctor`, fresh each run;
// null elsewhere, so the session-start check and setup make no extra calls.
let SIGN_IN_ENDS = null;
const utc = (d) => d.toISOString().slice(0, 16).replace('T', ' ');

// When an SSO sign-in that cannot renew itself ends, from the AWS CLI's own cache; only `expiresAt` is read.
// A session that renews itself (sso_session) keeps a refresh token and its end is not stored: null.
export function ssoEnd(profile) {
  let key = '';
  for (const setting of ['sso_session', 'sso_start_url']) {
    const { code, out } = run('aws', ['configure', 'get', setting, '--profile', profile]);
    if (code === 0 && out) { key = out; break; }
  }
  if (!key) return null;
  let data;
  try { data = JSON.parse(readFileSync(join(homedir(), '.aws', 'sso', 'cache', `${createHash('sha1').update(key).digest('hex')}.json`), 'utf8')); } catch { return null; }
  if (typeof data !== 'object' || data === null || Array.isArray(data) || 'refreshToken' in data) return null;
  const m = String(data.expiresAt ?? '').match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/);
  return m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])) : null;
}

// True when the shared credentials file holds a permanent access key for this profile. No value is kept.
export function longLivedKey(profile) {
  const file = (process.env.AWS_SHARED_CREDENTIALS_FILE || '~/.aws/credentials').replace(/^~(?=$|\/)/, homedir());
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { return false; }
  let inside = false;
  const keys = new Set();
  for (const line of text.split(/\r?\n/)) {
    const section = line.match(/^\s*\[([^\]]+)\]/);
    if (section) { inside = section[1].trim() === profile; continue; }
    const k = inside && line.match(/^\s*([A-Za-z0-9_]+)\s*[=:]/);
    if (k) keys.add(k[1].toLowerCase());
  }
  return keys.has('aws_access_key_id') && !keys.has('aws_session_token');
}

export function azureConnector(values = {}) {
  if (!which('az')) return ['azure', 'missing', 'install the Azure CLI'];
  const who = run('az', ['account', 'show', '--query', 'user.name', '--output', 'tsv']);
  if (who.code !== 0 || !who.out) return ['azure', 'signed out', `az login with a read-only (Reader) identity, in its own AZURE_CONFIG_DIR${ON_HOST}`];
  const wantTenant = values.AZURE_TENANT_ID || '';
  const wantSub = values.AZURE_SUBSCRIPTION_ID || '';
  // the subscription the server is given, by its ID: any one the identity can see, not only the CLI's default
  const pick = wantSub ? ['--subscription', wantSub] : [];
  if (wantTenant || wantSub) {
    const ids = run('az', ['account', 'show', ...pick, '--query', '[tenantId,id]', '--output', 'tsv']);
    if (wantSub && ids.code !== 0) return ['azure', 'wrong account', `this identity cannot see subscription ${mask(wantSub)}: sign in with one that can, AZURE_CONFIG_DIR=~/.azure-reader az login`];
    const [tenant = '', sub = ''] = ids.code === 0 ? ids.out.split('\t') : [];
    if (wantTenant && tenant && tenant !== wantTenant) return ['azure', 'wrong account', `tenant is ${mask(tenant)}, this tenant expects ${mask(wantTenant)}: az login --tenant <AZURE_TENANT_ID>`];
    if (wantSub && sub && sub !== wantSub) return ['azure', 'wrong account', `subscription is ${mask(sub)}, this tenant expects ${mask(wantSub)}: az account set --subscription <AZURE_SUBSCRIPTION_ID>`];
  }
  const roles = run('az', ['role', 'assignment', 'list', '--assignee', who.out, '--all', ...pick, '--query', '[].roleDefinitionName', '--output', 'json'], 60000);
  let names = [];
  try { names = roles.code === 0 ? JSON.parse(roles.out) : []; } catch { /* not JSON */ }
  const access = azureAccess(names);
  return ['azure', access === 'read' ? 'ready' : 'check', AZURE_ACCESS[access]];
}

const GITHUB_WRITE = /^(repo|public_repo|workflow|gist|delete_repo|codespace|write:.*|admin:.*)$/;
// GitHub sign-in of the gh CLI: ready only when the token cannot change things. Prints no token.
export function githubConnector() {
  if (!which('gh')) return ['github', 'missing', 'install the GitHub CLI'];
  const { code, out } = run('gh', ['auth', 'status']);
  if (code !== 0) return ['github', 'signed out', 'gh auth login --web'];
  const user = out.match(/account (\S+)/);
  const who = user ? `signed in as ${user[1]}` : 'signed in';
  const scopes = out.match(/Token scopes:\s*(.+)/);
  if (!scopes || ['', 'none'].includes(scopes[1].trim().replace(/^'|'$/g, ''))) return ['github', 'check', `${who}; a fine-grained token's access cannot be read from here: confirm it is read-only`];
  const quoted = [...scopes[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const names = quoted.length ? quoted : scopes[1].replace(/ /g, '').split(',');
  const writes = names.filter((n) => GITHUB_WRITE.test(n));
  if (writes.length) return ['github', 'check', `${who}; the token can change things (${writes.join(', ')}): use a fine-grained read-only token`];
  return ['github', 'ready', `${who}, read-only scopes`];
}

// [connector, status, fix] for each connector in .env.1xops. Read-only identity calls only.
// Rows are added to `rows` as they are found, so a check that runs out of time keeps what it has.
export function checkConnectors(file, rows = []) {
  if (!existsSync(file)) { rows.push(['connectors', 'missing', `no ${file} here: run 1xops setup`]); return rows; }
  let cfg;
  try { cfg = cf.load(file); } catch (err) { rows.push(['connectors', 'missing', err.message]); return rows; }
  for (const key of ['AWS_CONFIG_FILE', 'AZURE_CONFIG_DIR']) { // this tenant's own, never another tenant's from the shell; in a container, the mount's (docker run -e)
    if (cfg.values[key] && !(CONTAINER && process.env[key])) process.env[key] = cfg.values[key].replace(/^~(?=$|\/)/, homedir());
  }
  if (!Object.keys(cfg.connectors).length) { rows.push(['connectors', 'missing', `ONEXOPS_CONNECTORS is empty in ${file}: run 1xops setup`]); return rows; }
  for (const connector of Object.keys(cfg.connectors)) {
    let servers;
    try { servers = s.loadProfile(connector).mcpServers; } catch (err) { rows.push([connector, 'missing', err.message]); continue; }
    const awsVars = [];
    let azure = false;
    for (const [serverName, server] of Object.entries(servers)) {
      const env = server.env ?? {};
      if ('AWS_PROFILE' in env) awsVars.push(...[...env.AWS_PROFILE.matchAll(/\$\{([A-Z0-9_]+)(?::-[^}]*)?\}/g)].map((m) => m[1]));
      else if ('AZURE_TENANT_ID' in env) azure = true;
      else if (server.type === 'http' && serverName === 'github' && which('gh')) rows.push(githubConnector());
      else if (server.type === 'http' && PROBE.on && server.headers) rows.push([serverName, ...probe(server)]);
      else if (server.type === 'http') rows.push([serverName, 'check', `signs in inside the host: run /mcp and choose ${serverName}`]);
      else rows.push([serverName, 'check', 'no sign-in check for this connector']);
    }
    for (const v of new Set(awsVars)) rows.push(awsConnector(v, cfg.values));
    if (azure) rows.push(azureConnector(cfg.values));
  }
  return rows;
}

const ENV_FIX = 'in .env.1xops, then start the assistant from a shell that ran eval "$(1xops env)"';

// The plugins this folder turns on (.claude/settings.json, .claude/settings.local.json), so a check names the
// connectors the folder's job uses and not every library default. Read-only.
export function folderPlugins() {
  const keys = new Set();
  for (const name of ['settings.json', 'settings.local.json']) {
    try {
      const enabled = JSON.parse(readFileSync(path.join('.claude', name), 'utf8')).enabledPlugins ?? {};
      for (const [k, on] of Object.entries(enabled)) if (on === true) keys.add(k);
    } catch { /* no settings here */ }
  }
  if (existsSync('.env.1xops')) keys.add('operations@knowledge-work-plugins'); // a tenant folder runs the operations playbooks
  return keys;
}

// [server (plugin), status, fix] for the servers of the installed 1xops plugin and of the plugins this folder
// turns on, from the host's own plugin records. Reads no token, makes no call.
export function pluginConnectors() {
  const folder = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), `.${s.HOST}`), 'plugins');
  let installed;
  try { installed = JSON.parse(readFileSync(path.join(folder, 'installed_plugins.json'), 'utf8')).plugins ?? {}; } catch { return []; }
  const wanted = folderPlugins();
  const rows = [];
  for (const [key, entries] of Object.entries(installed)) {
    const plugin = key.split('@')[0];
    if (plugin !== '1xops' && !wanted.has(key)) continue;
    let servers;
    try {
      const data = JSON.parse(readFileSync(path.join(entries[0].installPath, '.mcp.json'), 'utf8'));
      servers = Object.entries(data.mcpServers ?? data);
    } catch { continue; }
    for (const [name, server] of servers) {
      if (typeof server !== 'object' || server === null || Array.isArray(server)) continue;
      const label = `${name} (${plugin})`;
      const unset = [...new Set([...JSON.stringify(server).matchAll(/\$\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]))].filter((v) => !v.startsWith('CLAUDE_') && !process.env[v]);
      if (unset.length) rows.push([label, 'broken', `${unset.join(', ')} not set. Fix: put ${unset.map((v) => `${v}=<value>`).join(', ')} ${ENV_FIX}`]);
      else if ('url' in server && !String(server.url).trim()) rows.push([label, 'not connected', "no server. Fix: connect it in the assistant's connector settings, or list it in ONEXOPS_IGNORE in .env.1xops"]);
      else if (name === 'github' && which('gh')) rows.push([label, ...githubConnector().slice(1)]);
      else if (PROBE.on && server.headers) rows.push([label, ...probe(server)]);
      else rows.push([label, 'in host', `signs in inside the host: run /mcp and choose ${name}`]);
    }
  }
  return rows;
}

export const PROBE = { on: false }; // doctor --probe: only then is a request sent to a connector's server

// [status, fix] from one MCP initialize request with the server's own header token. Sent only with --probe.
// The request runs in a child Node.js process, so the check stays synchronous; the token goes in on stdin.
export function probe(server) {
  const expand = (v) => String(v).replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, n) => process.env[n] ?? '');
  const headers = Object.fromEntries(Object.entries(server.headers ?? {}).map(([k, v]) => [k, expand(v)]));
  Object.assign(headers, { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' });
  const body = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: '1xops', version: PROBE.version ?? '' } } };
  const code = `let s='';process.stdin.on('data',(d)=>s+=d).on('end',async()=>{const r=JSON.parse(s);try{const res=await fetch(r.url,{method:'POST',headers:r.headers,body:r.body,redirect:'manual',signal:AbortSignal.timeout(5000)});process.stdout.write(String(res.status))}catch{process.stdout.write('0')}})`;
  const p = spawnSync(process.execPath, ['-e', code], { input: JSON.stringify({ url: expand(server.url ?? ''), headers, body: JSON.stringify(body) }), encoding: 'utf8', timeout: 10000 });
  const status = Number(p.stdout) || 0;
  if (!status) return ['broken', 'does not answer: check the url and the network'];
  if (status >= 200 && status < 300) return ['check', 'answers; confirm the token is read-only'];
  if (status >= 300 && status < 400) return ['unknown', `answered ${status}, a redirect elsewhere: check the url`]; // never followed with the token
  if (status === 401 || status === 403) return ['signed out', 'token refused: put a valid read-only token in .env.1xops'];
  return ['unknown', `answered ${status}; cannot tell if it works: run /mcp in the assistant`];
}

// The tenant's connectors and the plugin servers, minus the names in ONEXOPS_IGNORE.
export function connectorRows(file, rows) {
  let values = {};
  try { values = cf.load(file).values; } catch { /* no file: nothing to ignore */ }
  const ignore = new Set((values.ONEXOPS_IGNORE ?? '').split(',').map((n) => n.trim()).filter(Boolean));
  try {
    rows.push(...pluginConnectors());
    checkConnectors(file, rows);
  } finally {
    const keep = rows.filter((r) => !ignore.has(r[0]) && !ignore.has(r[0].split(' (')[0]));
    rows.length = 0;
    rows.push(...keep);
  }
  return rows;
}

const SKIP_AT_START = ['ready', 'in host'];
const QUIET = ['signs in inside the host', 'no sign-in check'];

// Session start: one line per connector that is not ready, with its fix. Nothing when all is ready.
// Never throws; a check that runs out of time or fails adds one line saying so.
export function briefText(file, within) {
  const rows = [];
  let done = true;
  deadline = within == null ? null : Date.now() + within * 1000;
  try {
    if (existsSync(file)) connectorRows(file, rows); // not a tenant folder: nothing to say
  } catch { done = false; } finally { deadline = null; }
  const lines = rows.filter(([, status, fix]) => !SKIP_AT_START.includes(status) && !QUIET.some((q) => fix.startsWith(q))).map(([name, , fix]) => `${name}: ${scrub(fix)}`);
  if (!done) lines.push(`1xops: the check did not finish${within == null ? '' : ` in ${within} s`}; run 1xops doctor for the rest.`);
  return lines.join('\n');
}

function brief(opts) {
  const text = briefText(opts.file, opts.within);
  if (text && opts.hook) console.log(JSON.stringify({ systemMessage: text, hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
  else if (text) console.log(text);
  return 0;
}

const RESULT_STYLE = { ok: 'green', ready: 'green', missing: 'red', 'signed out': 'yellow', check: 'yellow', broken: 'red', 'not connected': 'yellow', 'wrong account': 'red', 'in host': 'dim', unknown: 'yellow' };

// Sign-in rows to leave out: a connector of this folder already checks that provider with the folder's own
// profile or identity, and the shell's default sign-in would contradict it.
export function coveredSignIns(connectors, awsProfile) {
  const names = connectors.map((c) => c[0].split(' (')[0]);
  const covered = new Set();
  if (!awsProfile && names.some((n) => n.startsWith('aws '))) { covered.add('aws sign-in'); covered.add('aws access'); }
  if (names.includes('azure')) covered.add('azure sign-in');
  if (names.includes('github')) covered.add('github sign-in');
  return covered;
}

export function doctor(opts, version) {
  if (opts.brief || opts.hook) return brief(opts);
  PROBE.on = Boolean(opts.probe);
  SIGN_IN_ENDS = {};
  PROBE.version = version;
  // The identity calls take seconds; a status line on a terminal (cleared after), nothing when piped.
  const tty = process.stdout.isTTY;
  if (tty) process.stdout.write(color('dim', 'Checking tools, sign-ins and connectors (read-only)…'));
  const all = [...checkTools(), ...(CONTAINER && !which(s.HOST) ? [] : [checkEdition(version)]), ...checkSignIn(opts['aws-profile'])];
  const connectors = connectorRows(opts.file, []);
  const covered = coveredSignIns(connectors, opts['aws-profile']);
  const rows = all.filter((r) => !covered.has(r[0]));
  if (tty) process.stdout.write('\r\x1b[K');
  const shown = rows.map(([name, required, ok, detail]) => [name, required ? 'required' : 'optional', ok ? 'ok' : required ? 'missing' : 'check', scrub(detail)]);
  if (CONTAINER) shown.push(['isolation', 'container', ...checkIsolation().map((x, i) => (i ? scrub(x) : x))]);
  shown.push(...connectors.map(([name, status, fix]) => [name, 'connector', status, scrub(fix)]));
  // Required tools and configured connectors that are not ok or ready. Optional tools stay in the table only.
  const todo = shown.filter((r) => r[2] !== 'ok' && r[2] !== 'ready' && r[2] !== 'in host' && r[1] !== 'optional');
  const soon = Date.now() + 7 * 86400000;
  for (const r of shown) {
    const end = r[2] === 'ready' && SIGN_IN_ENDS[r[0]];
    if (end && end[0].getTime() <= soon) todo.push([r[0], r[1], r[2], `sign-in ends ${utc(end[0])} UTC: ${end[1]}`]);
  }
  const checked = shown.filter((r) => r[1] === 'connector' && r[2] !== 'in host');
  const score = checked.length ? `Score: ${checked.filter((r) => r[2] === 'ready').length} of ${checked.length} connectors ready` : '';
  for (const r of shown) r[2] = color(RESULT_STYLE[r[2]], r[2]);
  table(`1xops ${version} doctor`, ['check', 'needed', 'result', 'detail'], shown);
  if (score) console.log(score);
  // What to do next, in table order (see todo above).
  if (!todo.length) console.log(color('green', 'All set: nothing to fix.'));
  else {
    console.log(color('bold', 'Next:'));
    todo.forEach((r, i) => console.log(`  ${i + 1}. ${r[0]}: ${r[3]}`));
  }
  const failed = rows.filter((r) => r[1] && !r[2]).map((r) => r[0]);
  if (failed.length) {
    console.log(color('red', `Required: ${failed.join(', ')}`));
    return 1;
  }
  return 0;
}

// ── install ─────────────────────────────────────────────────────────────────

// Installing an edition replaces the other (or the free edition under its old marketplace name, 1xops).
const INSTALL_STEPS = [
  [s.HOST, 'plugin', 'marketplace', 'add', 'anthropics/knowledge-work-plugins'],
  [s.HOST, 'plugin', 'uninstall', '1xops@1xops'],
  [s.HOST, 'plugin', 'marketplace', 'remove', '1xops'],
  [s.HOST, 'plugin', 'marketplace', 'add', 'nnthanh101/1xops'],
  [s.HOST, 'plugin', 'install', '1xops@1ops'],
  // an existing install stays on its version until the host updates it: install, then update
  [s.HOST, 'plugin', 'marketplace', 'update', '1ops'],
  [s.HOST, 'plugin', 'update', '1xops@1ops'],
]

const SHOP = 'https://shop.oceansoft.io';

// One released version of the free edition (a rollback), or the latest again. The host keeps the source a
// marketplace was first added with, so it is removed and added back at the release tag, then the plugin installed.
const pinSteps = (version) => {
  const source = version === 'latest' ? 'nnthanh101/1xops' : `nnthanh101/1xops#v${version}`;
  return [
    [s.HOST, 'plugin', 'marketplace', 'add', 'anthropics/knowledge-work-plugins'],
    [s.HOST, 'plugin', 'marketplace', 'remove', '1ops'],
    [s.HOST, 'plugin', 'marketplace', 'add', source],
    [s.HOST, 'plugin', 'install', '1xops@1ops'],
  ];
};

// Free edition out, enterprise in: the same plugin name 1xops, from the unpacked bundle as marketplace 1xops.
const enterpriseSteps = (folder) => [
  [s.HOST, 'plugin', 'marketplace', 'add', 'anthropics/knowledge-work-plugins'],
  [s.HOST, 'plugin', 'uninstall', '1xops@1ops'],
  [s.HOST, 'plugin', 'marketplace', 'remove', '1xops'],
  [s.HOST, 'plugin', 'marketplace', 'add', folder],
  [s.HOST, 'plugin', 'install', '1xops@1xops'],
  [s.HOST, 'plugin', 'marketplace', 'update', '1xops'],
  [s.HOST, 'plugin', 'update', '1xops@1xops'],
];

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;

// Members a bundle may not hold, as Python's tarfile filter="data" refuses them: absolute paths, '..', links, devices.
function unsafeMembers(file) {
  const names = run('tar', ['-tzf', file], 120000);
  const long = run('tar', ['-tvzf', file], 120000);
  if (names.code !== 0 || long.code !== 0) return ['the bundle cannot be read'];
  const list = names.out.split('\n').filter(Boolean);
  const types = long.out.split('\n').filter(Boolean).map((l) => l[0]); // one line per member, same order
  return list.filter((n, i) => n.startsWith('/') || n.split('/').includes('..') || !'-d'.includes(types[i] ?? '?'))
    .map((n) => `'${n}' is not a plain file or folder inside the bundle`);
}

// The enterprise bundle's version, read without unpacking (the system tar, so no dependency).
export function bundleVersion(file) {
  const member = (m) => { const r = run('tar', ['-xzOf', file, m]); if (r.code !== 0) throw new Error(); return JSON.parse(r.out); };
  let market, plugin;
  try { market = member('.claude-plugin/marketplace.json'); plugin = member('plugins/1xops/.claude-plugin/plugin.json'); }
  catch { throw new Error(`${file} is not a 1xops enterprise bundle`); }
  if (market?.name !== '1xops' || plugin?.name !== '1xops') throw new Error(`${file} is not a 1xops enterprise bundle`);
  const version = String(plugin.version ?? '');
  // it names the install folder: never a path
  if (!SEMVER.test(version)) throw new Error(`${file} is not a 1xops enterprise bundle (version '${version}')`);
  return version;
}

export function install(opts) {
  if (!which(s.HOST)) {
    console.log(color('red', `'${s.HOST}' CLI not found; run '1xops doctor'.`));
    return 1;
  }
  let steps = INSTALL_STEPS;
  if (opts.version !== undefined) {
    if (opts.edition === 'enterprise') {
      console.error('1xops install: --version is for the free edition; the enterprise bundle carries its own version');
      return 2;
    }
    if (opts.version !== 'latest' && !SEMVER.test(opts.version)) {
      console.error('1xops install: --version must be x.y.z or latest');
      return 2;
    }
    steps = pinSteps(opts.version);
  }
  if (opts.edition === 'enterprise') {
    if (!opts.file) {
      console.log(`The enterprise edition is sold at ${SHOP}. Download the bundle from your order, then run:`);
      console.log('  1xops install --edition enterprise --file <1xops-enterprise-x.y.z.tar.gz> --yes');
      return 2;
    }
    let version;
    try { version = bundleVersion(opts.file); } catch (err) { console.log(color('red', err.message)); return 2; }
    const folder = path.join(homedir(), '.1xops', 'enterprise', version);
    steps = enterpriseSteps(folder);
    console.log(color('bold', `$ unpack ${opts.file} into ${folder}`));
    if (opts.yes) {
      const bad = unsafeMembers(opts.file);
      if (bad.length) { console.log(color('red', `${opts.file} is not a safe 1xops enterprise bundle: ${bad[0]}`)); return 2; }
      mkdirSync(folder, { recursive: true });
      const r = run('tar', ['-xzf', opts.file, '-C', folder, '--no-same-owner'], 300000);
      if (r.code !== 0) { console.log(r.out); return r.code; }
    }
  }
  for (const base of steps) {
    // the host takes no scope for a marketplace update
    const step = base[2] === 'marketplace' && base[3] === 'update' ? [...base] : [...base, '--scope', opts.scope];
    console.log(color('bold', `$ ${step.join(' ')}`));
    if (!opts.yes) continue;
    const { code, out } = run(step[0], step.slice(1), 180000);
    console.log(out);
    // removing the edition being replaced may fail harmlessly: it was not installed
    if (code !== 0 && !step.includes('uninstall') && !step.includes('remove')) return code;
  }
  if (!opts.yes) console.log('Dry run. Re-run with --yes to install.');
  return 0;
}

// ── config ──────────────────────────────────────────────────────────────────

// A line diff of two JSON documents (longest common subsequence; settings files are small).
function diffLines(a, b) {
  const n = a.length, m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { out.push(` ${a[i]}`); i++; j++; }
    else if (i < n && (j === m || lcs[i + 1][j] >= lcs[i][j + 1])) out.push(`-${a[i++]}`); // removed first, as difflib
    else out.push(`+${b[j++]}`);
  }
  return out;
}

function showChange(file, before, after, linesToo = true) {
  if (s.dumps(before) === s.dumps(after)) {
    console.log(color('dim', `${file}: already up to date`));
    return false;
  }
  const lines = diffLines(s.dumps(before).trimEnd().split('\n'), s.dumps(after).trimEnd().split('\n')).filter((l) => l[0] !== ' ');
  const added = lines.filter((l) => l[0] === '+').length;
  console.log(color('bold', `${file}: ${added} lines added, ${lines.length - added} removed`));
  if (linesToo) for (const l of lines) console.log(color(l[0] === '+' ? 'green' : 'red', l));
  return true;
}

// The same content writes nothing; a change keeps the previous file as <name>.bak.
function write(file, data) {
  mkdirSync(path.dirname(file), { recursive: true });
  const text = typeof data === 'string' ? data : s.dumps(data);
  if (existsSync(file)) {
    const old = readFileSync(file);
    if (old.equals(Buffer.from(text))) return;
    writeFileSync(`${file}.bak`, old);
    console.log(`kept the previous file as ${file}.bak`);
  }
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, text, { flush: true }); // on disk before the swap
  renameSync(tmp, file);
}

function resolveConfig(opts) {
  if (opts.file) {
    const cfg = cf.load(opts.file);
    const base = path.dirname(path.resolve(opts.file)); // a relative folder means: relative to this file
    return { scope: cfg.scope, project: path.resolve(base, cfg.dir), out: cfg.out ? path.resolve(base, cfg.out) : null, connectors: cfg.connectors };
  }
  return {
    scope: opts.scope,
    project: path.resolve(opts.dir),
    out: opts.out ? path.resolve(opts.out) : null,
    connectors: Object.fromEntries((opts.connectors ?? []).map((c) => [c, {}])),
  };
}

export function config(opts) {
  try {
    return configure(opts);
  } catch (err) {
    if (err instanceof TypeError || err instanceof ReferenceError || err instanceof RangeError) throw err; // a bug, not a setting
    console.log(color('red', err.message));
    return 2;
  }
}

function configure(opts) {
  let scope, project, out, profiles;
  try {
    ({ scope, project, out } = resolveConfig(opts));
    profiles = Object.entries(resolveConfig(opts).connectors).map(([name, values]) => [s.loadProfile(name), values]);
  } catch (err) {
    console.log(color('red', err.message));
    return 2;
  }
  const personal = scope === 'local' || scope === 'personal';
  let servers = {};
  let wanted = s.template(scope);
  for (const [profile, values] of profiles) {
    // Shared files keep ${VAR}; private host config gets the person's values.
    Object.assign(servers, personal ? cf.substitute(profile.mcpServers, values) : profile.mcpServers);
    wanted = s.merge(wanted, { permissions: profile.permissions ?? {} });
  }

  const planned = [];
  const target = s.settingsPath(scope, project, out);
  const before = s.readJson(target);
  const after = s.merge(before, wanted);
  if (showChange(target, before, after, opts.preview !== 'summary')) planned.push([target, after]);

  const hostCmds = [];
  if (Object.keys(servers).length) {
    const mcpFile = s.mcpPath(scope, project, out);
    if (mcpFile) {
      const b = s.readJson(mcpFile);
      const a = s.merge(b, { mcpServers: servers });
      if (showChange(mcpFile, b, a, opts.preview !== 'summary')) planned.push([mcpFile, a]);
    } else {
      const hostScope = scope === 'personal' ? 'user' : 'local';
      for (const [name, spec] of Object.entries(servers)) {
        hostCmds.push([s.HOST, 'mcp', 'add-json', '-s', hostScope, name, JSON.stringify(spec)]);
        console.log(color('bold', `$ ${s.HOST} mcp add-json -s ${hostScope} ${name} '…'`));
      }
    }
  }

  if (!opts.yes) {
    if (!opts.preview) console.log('Dry run. Re-run with --yes to write these changes.');
    return 0;
  }
  if (hostCmds.length && !which(s.HOST)) {
    console.log(color('red', `${scope} scope adds connectors through the '${s.HOST}' CLI, which is not installed. Nothing was written. Install it, or use --scope team.`));
    return 1;
  }
  for (const [file, data] of planned) {
    write(file, data);
    console.log(color('green', `wrote ${file}`));
  }
  for (const cmd of hostCmds) {
    const { code, out: msg } = run(cmd[0], cmd.slice(1));
    console.log(msg);
    if (code !== 0) return code;
  }
  if (scope === 'org') console.log(`Give these files to IT to install in: ${s.managedDir()}`);
  if (!personal && profiles.some(([, v]) => Object.keys(v).length)) {
    console.log('Shared files use ${VAR}. Load your values with: eval "$(1xops env)"');
  }
  return 0;
}

// ── env and profiles ────────────────────────────────────────────────────────

const shellQuote = (v) => (/^[A-Za-z0-9@%+=:,./_-]+$/.test(v) ? v : `'${v.replaceAll("'", `'"'"'`)}'`);

const TENANTS_AT_ONCE = 8; // each check signs in to AWS and Azure: a limit keeps 200 tenants from 400 sign-ins at once

// One line per tenant folder (a folder with its own .env.1xops) under a folder. Changes nothing.
export async function tenants(opts) {
  const root = opts.folder ?? '.';
  let folders = [];
  try {
    folders = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(root, d.name, cf.DEFAULT_FILE))).map((d) => d.name).sort();
  } catch { /* not a folder */ }
  if (!folders.length) { console.log(`No tenant folders (a folder with its own ${cf.DEFAULT_FILE}) under ${root}.`); return 0; }
  const bin = join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', '1xops.mjs');
  const check = (name) => new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, 'doctor', '--brief', '--within', '8'], { cwd: join(root, name) });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve([name, code ?? 1, out.split('\n').filter((l) => l.trim())]));
  });
  const results = new Array(folders.length);
  let next = 0;
  const worker = async () => { while (next < folders.length) { const i = next++; results[i] = await check(folders[i]); } };
  await Promise.all(Array.from({ length: Math.min(TENANTS_AT_ONCE, folders.length) }, worker));
  let need = 0;
  for (const [name, code, lines] of results) {
    if (code !== 0) { need += 1; console.log(`✗ ${name}: the check failed (exit ${code}): ${lines.length ? scrub(lines.at(-1)) : 'no output'}`); }
    else if (lines.length) { need += 1; console.log(`✗ ${name}: ${scrub(lines[0])}${lines.length > 1 ? ` (+${lines.length - 1} more)` : ''}`); }
    else console.log(`✓ ${name}: ready`);
  }
  console.log(`${folders.length} tenants, ${need} need attention`);
  return need ? 1 : 0;
}

export function env(opts) {
  let cfg;
  try {
    cfg = cf.load(opts.file);
  } catch (err) {
    console.error(err.message);
    return 2;
  }
  for (const [k, v] of Object.entries(cfg.values)) {
    const value = v === '~' || v.startsWith('~/') ? homedir() + v.slice(1) : v;
    console.log(`export ${k}=${shellQuote(value)}`);
  }
  return 0;
}

export function connectors() {
  const rows = s.builtinProfiles().map((name) => {
    const p = s.loadProfile(name);
    return [name, Object.keys(p.mcpServers).join(', '), cf.variables(p).join(', ') || '—', p.description ?? ''];
  });
  table('Connectors', ['connector', 'servers', 'values (.env.1xops keys)', 'description'], rows);
  console.log("Use your own: a .json file with an 'mcpServers' object, as a connector name.");
  return 0;
}

// ── setup ───────────────────────────────────────────────────────────────────

// Read-only lookups that make good defaults: AWS profiles and region, current Azure account.
const awsConfigFile = () => process.env.AWS_CONFIG_FILE || join(homedir(), '.aws', 'config');
const DEFAULTS = { AWS_REGION: 'ap-southeast-2' }; // Sydney; a region is not a secret

// (name, subscription id, tenant id) of the subscriptions the read-only identity in AZURE_CONFIG_DIR can see. Read from its
// local sign-in, no cloud call. Without AZURE_CONFIG_DIR nothing is read: the default login is never used.
function azureSubscriptions() {
  if (!process.env.AZURE_CONFIG_DIR || !which('az')) return [];
  const r = run('az', ['account', 'list', '--query', '[].{n:name,s:id,t:tenantId}', '--output', 'json']);
  if (r.code !== 0 || !r.out) return [];
  try { return JSON.parse(r.out).map((a) => [a.n, a.s, a.t]); } catch { return []; }
}

function detect() {
  const found = {};
  const ok = (cmd, args) => (which(cmd) ? run(cmd, args) : { code: 1, out: '' });
  const profilesOut = ok('aws', ['configure', 'list-profiles']);
  if (profilesOut.code === 0 && profilesOut.out) found.awsProfiles = profilesOut.out.split(/\s+/);
  const region = process.env.AWS_REGION || (ok('aws', ['configure', 'get', 'region']).code === 0 ? ok('aws', ['configure', 'get', 'region']).out : '');
  if (region) found.AWS_REGION = region;
  // Azure IDs are read only from a separate read-only identity (AZURE_CONFIG_DIR), never the default login.
  const az = process.env.AZURE_CONFIG_DIR ? ok('az', ['account', 'show', '--query', '{t:tenantId,s:id}', '--output', 'json']) : { code: 1, out: '' };
  if (az.code === 0 && az.out) {
    try {
      const ids = JSON.parse(az.out);
      found.AZURE_TENANT_ID = ids.t;
      found.AZURE_SUBSCRIPTION_ID = ids.s;
    } catch { /* not JSON */ }
  }
  return found;
}

// (name, masked account, role) of AWS profiles whose configured role cannot change things. Read from the local AWS
// config only: no cloud call. Unknown and can-change profiles are left out.
export function readOnlyProfiles() {
  const cfg = awsConfigFile();
  if (!existsSync(cfg)) return [];
  const found = [];
  let name = '';
  let kv = {};
  const flush = () => {
    const arn = kv.role_arn ?? '';
    const role = kv.sso_role_name || arn.split('/').pop();
    if (name && role && accessFromRole(`:assumed-role/${role}/`) === 'read') {
      const acct = kv.sso_account_id || arn.split(':')[4] || '';
      found.push([name, acct ? `****${acct.slice(-4)}` : '-', role]);
    }
  };
  for (const raw of readFileSync(cfg, 'utf8').split('\n')) {
    const line = raw.trim();
    const m = line.match(/^\[(?:profile\s+)?([^\]]+)\]/);
    if (m) { flush(); name = m[1].trim(); kv = {}; }
    else if (line.includes('=') && !/^[#;]/.test(line)) { const i = line.indexOf('='); kv[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  }
  flush();
  return found.sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

const SCOPE_HELP = {
  org: 'managed files for IT, every person in the organisation',
  team: 'a shared project or tenant folder',
  local: 'you, in this project only',
  personal: 'you, in every project',
};

// The starter note of a tenant's docs folder: front matter that follows the wiki's contract, so the folder can be
// opened in Obsidian and rendered by Docusaurus as it is.
const slug = (name) => {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
  return /^[a-z][a-z0-9-]{1,62}$/.test(s) ? s : `tenant-${s}`.slice(0, 63);
};
const tenantNote = (name, connectors) => `---\nid: ${slug(name)}\ntitle: ${name}\ntype: entity\nstatus: emerging\n`
  + `last_updated: ${new Date().toLocaleDateString('en-CA')}\nsources: []\ntags: [tenant]\n---\n\n# ${name}\n\n`
  + 'What this tenant runs, who owns it, and where its runbooks are.\n\n'
  + '- Owner: (add a name or team)\n'
  + `- Connectors: ${connectors.join(', ') || '(none yet)'}\n`
  + '- Runbooks go in `runbooks/` (type: runbook), postmortems in `reviews/` (type: review), '
  + 'services and systems in `entities/` (type: entity), decisions in `decisions/` (type: decision).\n\n'
  + 'Notes may name things: profiles, accounts masked as ****1234. They never hold keys, tokens or passwords.\n';

const READER_FIX = 'sign in with a Reader identity in its own folder: AZURE_CONFIG_DIR=~/.azure-reader az login';

export async function setup(opts) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (question, fallback = '') => {
    process.stdout.write(`${question}${fallback ? ` [${fallback}]` : ''}: `);
    const { value, done } = await lines.next();
    const answer = done ? '' : value.trim();
    return answer || fallback;
  };
  const yes = async (question, fallback) => {
    const a = (await ask(`${question} (y/n)`, fallback ? 'y' : 'n')).toLowerCase();
    return a.startsWith('y');
  };
  try {
    let file = opts.file;
    console.log(`${color('bold', '1xops setup')} — non-secret values only; secrets stay in your sign-in.\n`);
    table('Who the settings are for', ['scope', 'for'], s.SCOPES.map((n) => [n, SCOPE_HELP[n]]));
    let scope;
    do scope = await ask(`Scope (${s.SCOPES.join('/')})`, 'team'); while (!s.SCOPES.includes(scope));
    const conf = { scope };
    if (scope === 'team' || scope === 'local') {
      const folder = await ask(`Tenant folder (Enter = this folder: ${process.cwd()})`, '.');
      if (file === cf.DEFAULT_FILE) { // the tenant's settings file lives in the tenant's folder
        file = join(folder, cf.DEFAULT_FILE);
        conf.dir = '.';
      } else conf.dir = folder;
    }
    if (scope === 'org') conf.out = await ask('Folder to write the managed files to', '.');
    const found = detect();
    const connectors = {};
    let listed = false;
    let azureShown = false;
    const picked = {};
    const home = (p) => (p.startsWith(`${homedir()}/`) ? `~${p.slice(homedir().length)}` : p);
    const pickAwsConfig = async () => {
      if (process.env.AWS_CONFIG_FILE) return { AWS_CONFIG_FILE: home(process.env.AWS_CONFIG_FILE) };
      const root = join(homedir(), '.aws', 'tenants');
      let options = [];
      try { options = readdirSync(root).sort().map((n) => [n, join(root, n, 'config')]).filter(([, f]) => existsSync(f)); } catch { /* none */ }
      if (!options.length) return {};
      table(`AWS config files, one per tenant (${options.length})`, ['#', 'tenant', 'file'], options.map(([n, f], i) => [String(i + 1), n, home(f)]));
      for (;;) {
        const pick = (await ask('  AWS_CONFIG_FILE: number or part of a tenant name (Enter skips)')).trim();
        if (!pick || pick === '-') return {};
        const hits = /^\d+$/.test(pick) ? (options[Number(pick) - 1] ? [options[Number(pick) - 1]] : []) : options.filter(([n]) => n.toLowerCase().includes(pick.toLowerCase()));
        if (hits.length === 1) { process.env.AWS_CONFIG_FILE = hits[0][1]; return { AWS_CONFIG_FILE: home(hits[0][1]) }; }
        console.log(`  No single tenant matches '${pick}': pick 1 to ${options.length}.`);
      }
    };
    const askSubscription = async () => {
      const rows = azureSubscriptions();
      if (!rows.length) {
        if (!azureShown) {
          console.log('  No Azure Reader sign-in found. Use a Reader identity in its own folder, never your own login:');
          console.log('    AZURE_CONFIG_DIR=~/.azure-reader az login   then run setup again.');
          azureShown = true;
        }
        const def = process.env.AZURE_SUBSCRIPTION_ID || found.AZURE_SUBSCRIPTION_ID || '';
        return (await ask(def ? `  AZURE_SUBSCRIPTION_ID (Enter keeps ****${def.slice(-4)})` : '  AZURE_SUBSCRIPTION_ID (blank to skip)')) || def;
      }
      table(`Azure subscriptions of the Reader identity (${rows.length})`, ['#', 'name', 'subscription', 'tenant'], rows.map(([n, s, t], i) => [String(i + 1), n, `****${s.slice(-4)}`, `****${t.slice(-4)}`]));
      const current = process.env.AZURE_SUBSCRIPTION_ID || found.AZURE_SUBSCRIPTION_ID || '';
      const cur = rows.findIndex((r) => r[1] === current) + 1;
      const hint = cur ? `Enter keeps ${cur}, - skips` : 'Enter skips';
      for (;;) {
        const pick = (await ask(`  AZURE_SUBSCRIPTION_ID: number or part of a name (${hint})`, cur ? String(cur) : '')).trim();
        if (!pick || pick === '-') return '';
        let chosen = /^\d+$/.test(pick) ? rows[Number(pick) - 1] : null;
        if (!chosen && !/^\d+$/.test(pick)) {
          const hits = rows.filter((r) => r[0].toLowerCase().includes(pick.toLowerCase()));
          if (hits.length === 1) [chosen] = hits;
        }
        if (chosen) { picked.tenant = chosen[2]; return chosen[1]; }
        console.log(`  No single subscription matches '${pick}': pick 1 to ${rows.length}.`);
      }
    };
    for (const name of s.builtinProfiles()) {
      const profile = s.loadProfile(name);
      if (!(await yes(`Add ${name}: ${profile.description ?? ''}?`, false))) continue;
      if (name === 'aws') conf.extra = { ...conf.extra, ...(await pickAwsConfig()) };
      if (name === 'azure' && process.env.AZURE_CONFIG_DIR) conf.extra = { ...conf.extra, AZURE_CONFIG_DIR: home(process.env.AZURE_CONFIG_DIR) };
      const values = {};
      for (const v of cf.variables(profile)) {
        if (v.endsWith('_PROFILE')) {
          // Pick a read-only AWS profile: by number, or type part of a name to filter. A name outside the read-only
          // list cannot get in. The list is shown once; later questions refer to it.
          const options = readOnlyProfiles();
          if (!options.length) {
            if (!listed) { // say it once, not once per variable
              console.log(`  No read-only AWS profile in ${awsConfigFile()} yet.`);
              console.log('  Create one with: aws configure sso (a role such as ReadOnlyAccess).');
              console.log('  Profiles in another file? Run: AWS_CONFIG_FILE=<file> 1xops setup');
              console.log('  Until then 1xops doctor shows this connector as missing.');
              listed = true;
            }
            continue;
          }
          const numbered = options.map((o, i) => [i + 1, o]);
          const show = (rows, title) => table(title, ['#', 'profile', 'account', 'role'], rows.map(([n, [name, acct, role]]) => [String(n).padStart(String(options.length).length), name, acct, role]));
          if (!listed) { show(numbered, `Read-only AWS profiles (${options.length})`); listed = true; }
          const current = numbered.find(([, [name]]) => name === process.env[v]);
          const hint = current ? `Enter keeps ${current[0]}, - skips` : 'Enter skips';
          for (;;) {
            const pick = (await ask(`  ${v}: number or part of a name (${hint})`, current ? String(current[0]) : '')).trim();
            if (!pick || pick === '-') break;
            if (/^\d+$/.test(pick)) {
              if (Number(pick) >= 1 && Number(pick) <= options.length) { values[v] = options[Number(pick) - 1][0]; break; }
              console.log(`  No profile number ${pick}: pick 1 to ${options.length}.`);
              continue;
            }
            const q = pick.toLowerCase();
            const matches = numbered.filter(([, [name, , role]]) => name.toLowerCase().includes(q) || role.toLowerCase().includes(q));
            if (matches.length === 1) { values[v] = matches[0][1][0]; break; }
            if (matches.length) show(matches, `Matching '${pick}' (${matches.length})`);
            else console.log(`  No read-only profile matches '${pick}'.`);
          }
          continue;
        }
        if (v === 'AZURE_SUBSCRIPTION_ID') {
          const sub = await askSubscription();
          if (sub) values[v] = sub;
          continue;
        }
        if (v === 'AZURE_TENANT_ID' && picked.tenant) {
          console.log('  AZURE_TENANT_ID: taken from the subscription.');
          values[v] = picked.tenant;
          continue;
        }
        const def = process.env[v] || found[v] || DEFAULTS[v] || '';
        const value = def && scrub(def) !== def // an ID: shown masked, kept in full
          ? (await ask(`  ${v} (Enter keeps ${scrub(def)})`)) || def
          : await ask(def ? `  ${v}` : `  ${v} (blank to skip)`, def);
        if (value) values[v] = value;
      }
      connectors[name] = values;
    }
    const own = await ask('Your own profile .json file (blank to skip)');
    if (own) connectors[own] = {};
    conf.connectors = connectors;

    // Before any file is written: one read-only identity call per AWS profile and for Azure.
    const MARK = { ready: ['✓', 'green'], check: ['!', 'yellow'] };
    const verify = async (label, check, login) => {
      const show = (row) => { const [mark, style] = MARK[row[1]] ?? ['✗', 'red']; console.log(`  ${color(style, mark)} ${label}: ${scrub(row[2])}`); };
      let row = check();
      show(row);
      if (row[1] === 'signed out' && which(login[0]) && (await yes(`  Sign in now? (${login.join(' ')}; opens your browser)`, true))) {
        spawnSync(login[0], login.slice(1), { stdio: 'inherit' });
        row = check();
        show(row);
      }
      return row;
    };
    const failed = [];
    const checks = [];
    for (const [name, values] of Object.entries(connectors)) {
      if (name === 'aws') {
        for (const v of ['AWS_BILLING_PROFILE', 'AWS_OPERATIONS_PROFILE']) {
          const p = values[v];
          if (p) checks.push([`aws ${v}`, () => awsConnector(v, { [v]: p }), ['aws', 'sso', 'login', '--profile', p]]);
        }
      } else if (name === 'azure') {
        if (!process.env.AZURE_CONFIG_DIR) failed.push(['azure', READER_FIX]);
        else checks.push(['azure', () => azureConnector(values), ['az', 'login', '--output', 'none']]);
      }
    }
    if (checks.length) console.log('\nSign-in: one read-only call each, before any file is written.');
    for (const [label, check, login] of checks) {
      const row = await verify(label, check, login);
      if (row[1] !== 'ready' && row[1] !== 'check') failed.push([label, row[2]]);
    }
    if (failed.length) {
      console.log('\nNothing changed. Fix the sign-in, then run 1xops setup again:');
      for (const [label, fix] of failed) console.log(`  ${label}: ${scrub(fix)}`);
      return 1;
    }

    const text = cf.dump(conf);
    console.log(`\n${color('bold', file)}\n${scrub(text)}`);
    if (existsSync(file) && !(await yes(`${file} exists. Replace it?`, false))) return 1;
    if (!(await yes(`Write ${file}?`, true))) return 1;
    write(file, text);
    cf.load(file); // same checks as `1xops config --file`
    if (scope === 'team' || scope === 'local') {
      const note = join(path.dirname(file), 'docs', 'tenant.md');
      if (!existsSync(note)) {
        write(note, tenantNote(path.basename(path.resolve(path.dirname(file))), Object.keys(connectors)));
        console.log(`Wrote ${note}: this tenant's notes. Open the docs folder in Obsidian.`);
      }
    }

    console.log('\nChanges this would make:');
    if (config({ file, preview: 'summary' }) !== 0) return 2;
    if (await yes('Show every line first?', false)) config({ file, preview: 'full' });
    let code = 0;
    if (await yes('Apply them now?', false)) code = config({ file, yes: true });
    else console.log(`Apply later with: 1xops config --file ${file} --yes`);
    if (code === 0 && Object.keys(connectors).length && (await yes("Connect and verify now? (signs in with each provider's own command)", true))) {
      console.log('\nConnect: sign in, then check that access is read-only.');
      for (const name of Object.keys(connectors)) {
        if (name === 'itsm') {
          console.log('  itsm: sign in inside the assistant: start it in this folder, run /mcp and choose atlassian.');
          if (which('claude') && (await yes('  Start the assistant here now to sign in? (claude)', false))) spawnSync('claude', [], { stdio: 'inherit' });
        }
      }
      await verify('github', githubConnector, ['gh', 'auth', 'login', '--web', '--hostname', 'github.com']);
    }
    return code;
  } finally {
    rl.close();
  }
}
