import 'dotenv/config';
import crypto from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const email = process.argv[2]?.trim().toLowerCase();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run user:add -- <email>');
  process.exit(1);
}

function promptForPassword() {
  if (!process.stdin.isTTY) {
    throw new Error('Run this command from an interactive terminal to enter the password securely.');
  }

  return new Promise((resolve, reject) => {
    let password = '';
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write('New password (12-128 characters): ');

    const finish = (error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('keypress', onKeypress);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(password);
    };

    const onKeypress = (character, key) => {
      if (key?.ctrl && key.name === 'c') {
        finish(new Error('Password entry cancelled.'));
      } else if (key?.name === 'return' || key?.name === 'enter') {
        finish();
      } else if (key?.name === 'backspace') {
        password = password.slice(0, -1);
      } else if (!key?.ctrl && !key?.meta && character) {
        password += character;
      }
    };

    process.stdin.on('keypress', onKeypress);
  });
}

let password;
try {
  password = await promptForPassword();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (password.length < 12 || password.length > 128) {
  console.error('Password must be 12-128 characters.');
  process.exit(1);
}

const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'auth.sqlite'));
mkdirSync(path.dirname(databasePath), { recursive: true });
const database = new Database(databasePath);
database.pragma('foreign_keys = ON');
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL
  );
`);

const salt = crypto.randomBytes(16).toString('hex');
const derivedKey = await promisify(crypto.scrypt)(password, salt, 64);
try {
  database.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(email, `scrypt:${salt}:${derivedKey.toString('hex')}`, Date.now());
  console.info(`Created account for ${email}`);
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    console.error('An account with that email already exists.');
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  database.close();
}