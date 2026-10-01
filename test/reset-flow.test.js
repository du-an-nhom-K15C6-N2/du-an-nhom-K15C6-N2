import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import Database from 'better-sqlite3';

const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'dnkn-reset-test-'));
const databasePath = path.join(temporaryDirectory, 'auth.sqlite');
const database = new Database(databasePath);
database.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);
database.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
  .run('member@example.test', 'scrypt:initial:hash', Date.now());
database.close();

const port = await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port: availablePort } = probe.address();
    probe.close(() => resolve(availablePort));
  });
});

const projectRoot = path.resolve(import.meta.dirname, '..');
const server = spawn(process.execPath, [path.join(projectRoot, 'server.js')], {
  cwd: projectRoot,
  env: {
    ...process.env,
    DATABASE_PATH: databasePath,
    NODE_ENV: 'development',
    PORT: String(port),
    APP_BASE_URL: `http://localhost:${port}`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.setEncoding('utf8');
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.setEncoding('utf8');
server.stderr.on('data', (chunk) => { output += chunk; });

function waitForOutput(pattern, startAt = 0) {
  const findMatch = () => output.slice(startAt).match(pattern);
  const existingMatch = findMatch();
  if (existingMatch) return Promise.resolve(existingMatch);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.stdout.removeListener('data', onOutput);
      server.stderr.removeListener('data', onOutput);
      reject(new Error(`Timed out waiting for server output: ${pattern}`));
    }, 5000);
    const onOutput = () => {
      const match = findMatch();
      if (!match) return;
      clearTimeout(timeout);
      server.stdout.removeListener('data', onOutput);
      server.stderr.removeListener('data', onOutput);
      resolve(match);
    };
    server.stdout.on('data', onOutput);
    server.stderr.on('data', onOutput);
  });
}

after(async () => {
  if (server.exitCode === null) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('reset requests do not reveal accounts; tokens expire and work only once', async () => {
  await waitForOutput(/listening on http:\/\/localhost:/);
  const baseUrl = `http://localhost:${port}`;
  const requestReset = (email) => fetch(`${baseUrl}/api/password-reset-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const missingAccount = await requestReset('missing@example.test');
  const missingBody = await missingAccount.json();
  assert.equal(missingAccount.status, 200);

  const firstRequestStart = output.length;
  const existingAccount = await requestReset('member@example.test');
  assert.equal(existingAccount.status, 200);
  assert.deepEqual(await existingAccount.json(), missingBody);

  const tokenLogPattern = /Password reset link for member@example\.test: (http:\/\/localhost:\d+\/#token=[A-Za-z0-9_-]+)/;
  const firstTokenLog = await waitForOutput(tokenLogPattern, firstRequestStart);
  const firstToken = new URLSearchParams(new URL(firstTokenLog[1]).hash.slice(1)).get('token');
  const firstTokenHash = crypto.createHash('sha256').update(firstToken).digest('hex');

  const tokenDatabase = new Database(databasePath);
  const firstTokenRecord = tokenDatabase.prepare('SELECT token_hash, expires_at, created_at FROM password_reset_tokens WHERE token_hash = ?').get(firstTokenHash);
  assert.ok(firstTokenRecord);
  assert.equal(firstTokenRecord.token_hash, firstTokenHash);
  assert.notEqual(firstTokenRecord.token_hash, firstToken);
  assert.ok(Math.abs(firstTokenRecord.expires_at - firstTokenRecord.created_at - 30 * 60 * 1000) < 1000);

  const newPassword = 'correct-horse-battery';
  const resetPassword = (token) => fetch(`${baseUrl}/api/password-resets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password: newPassword }),
  });

  const successfulReset = await resetPassword(firstToken);
  assert.equal(successfulReset.status, 200);
  const updatedPasswordHash = tokenDatabase.prepare('SELECT password_hash FROM users WHERE email = ?').get('member@example.test').password_hash;
  assert.match(updatedPasswordHash, /^scrypt:/);
  assert.notEqual(updatedPasswordHash, 'scrypt:initial:hash');
  assert.ok(tokenDatabase.prepare('SELECT used_at FROM password_reset_tokens WHERE token_hash = ?').get(firstTokenHash).used_at);
  assert.equal((await resetPassword(firstToken)).status, 400);

  const secondRequestStart = output.length;
  await requestReset('member@example.test');
  const secondTokenLog = await waitForOutput(tokenLogPattern, secondRequestStart);
  const secondToken = new URLSearchParams(new URL(secondTokenLog[1]).hash.slice(1)).get('token');
  const secondTokenHash = crypto.createHash('sha256').update(secondToken).digest('hex');
  tokenDatabase.prepare('UPDATE password_reset_tokens SET expires_at = ? WHERE token_hash = ?').run(Date.now() - 1, secondTokenHash);
  assert.equal((await resetPassword(secondToken)).status, 400);
  tokenDatabase.close();
});