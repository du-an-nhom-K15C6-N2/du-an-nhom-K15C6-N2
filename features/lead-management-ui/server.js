const express = require('express');
const path = require('node:path');
const { readFile } = require('node:fs/promises');
const { createDatabase } = require('../lead-list-search-pagination/backend/src/database');
const { createLeadRouter } = require('../lead-list-search-pagination/backend/src/app');

const app = express();
const port = Number(process.env.PORT) || 3001;
const frontendDirectory = path.join(__dirname, 'frontend');
const databasePath = process.env.DATABASE_PATH ||
  path.join(__dirname, '..', 'lead-list-search-pagination', 'data', 'leads.sqlite');
const db = createDatabase(databasePath);

app.use(express.json());
app.use('/api/leads', createLeadRouter(db));
app.get('/api/health', (req, res) => res.json({ success: true, status: 'OK', service: 'dnkn93-lead-management' }));
app.get('/', async (req, res, next) => {
  try {
    const indexFile = await readFile(path.join(frontendDirectory, 'index.html'), 'utf8');
    const integrationConfig = '<script>window.LEAD_API_ENABLED=true;window.LEAD_API_BASE_URL="";</script>';
    res.type('html').send(indexFile.replace('</head>', `${integrationConfig}</head>`));
  } catch (error) {
    next(error);
  }
});
app.use(express.static(frontendDirectory));
app.use('/api', (req, res) => res.status(404).json({
  success: false,
  message: 'Không tìm thấy endpoint.',
}));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body JSON không hợp lệ.' });
  }
  console.error('Lỗi máy chủ DNKN93:', error);
  res.status(500).json({ message: 'Đã xảy ra lỗi máy chủ.' });
});

const server = app.listen(port, () => {
  console.log(`DNKN93 Lead Management đang chạy tại http://localhost:${port}`);
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close((error) => {
    db.close();
    if (error) {
      console.error('Không thể đóng server DNKN93:', error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
