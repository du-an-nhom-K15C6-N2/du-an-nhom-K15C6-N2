const express = require('express');
const gradeRoutes = require('./routes/gradeRoutes');
const tuitionRoutes = require('./routes/tuitionRoutes');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const role = req.headers['x-user-role'];
  if (role) {
    req.user = { id: 1, role: role };
  }
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    message: 'RBAC API đang hoạt động bình thường.',
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    name: 'RBAC System',
    message: 'API phân quyền theo vai trò đang chạy.',
    endpoints: {
      grades: '/api/v1/grades/update',
      tuition: '/api/v1/tuition/update',
      health: '/health',
    },
  });
});

app.use('/api/v1/grades', gradeRoutes);
app.use('/api/v1/tuition', tuitionRoutes);

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`RBAC app listening on port ${port}`);
  });
}
