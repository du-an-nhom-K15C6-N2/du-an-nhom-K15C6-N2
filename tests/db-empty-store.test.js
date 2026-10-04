const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const { verifyPassword } = require('../backend/security/password');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttcs-empty-users-'));
const dataFile = path.join(tempDir, 'users.json');
fs.writeFileSync(dataFile, '');
process.env.DATA_FILE = dataFile;

const db = require('../backend/config/db.config');

after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('an empty existing user store is initialized with demo passwords', async () => {
  const users = db.readUsers();

  assert.equal(users.length, 28);
  assert.deepEqual(JSON.parse(fs.readFileSync(dataFile, 'utf8')), users);
  assert.equal(await verifyPassword('12345678', users[0].passwordHash), true);
});

test('a missing user store is initialized with demo passwords', async () => {
  const originalDataFile = db.dataFile;
  db.dataFile = path.join(tempDir, 'missing-users.json');

  try {
    const users = db.readUsers();

    assert.equal(await verifyPassword('12345678', users[0].passwordHash), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(db.dataFile, 'utf8')), users);
  } finally {
    db.dataFile = originalDataFile;
  }
});

test('existing demo accounts without password hashes are migrated', async () => {
  const usersWithoutHashes = db.readUsers().map(({ passwordHash, ...user }) => user);
  fs.writeFileSync(dataFile, JSON.stringify(usersWithoutHashes));

  db.initDatabase();

  const migratedUsers = db.readUsers();
  assert.equal(await verifyPassword('12345678', migratedUsers[0].passwordHash), true);
});

test('a corrupt user store fails explicitly instead of silently using unhashed users', () => {
  const originalDataFile = db.dataFile;
  db.dataFile = path.join(tempDir, 'corrupt-users.json');
  fs.writeFileSync(db.dataFile, '{');

  try {
    assert.throws(() => db.readUsers(), SyntaxError);
  } finally {
    db.dataFile = originalDataFile;
  }
});
