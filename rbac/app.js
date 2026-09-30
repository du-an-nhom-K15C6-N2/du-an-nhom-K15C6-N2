const express = require('express');
const gradeRoutes = require('./routes/gradeRoutes');
const tuitionRoutes = require('./routes/tuitionRoutes');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const role = req.headers['x-user-role'];
  const name = req.headers['x-user-name'] || 'Nguyen Van A';

  if (role) {
    req.user = {
      id: 1,
      name: name,
      role: role
    };
  }
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    message: 'RBAC API đang hoạt động bình thường.',
  });
});

app.get('/api/v1/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      message: 'Chua co thong tin nguoi dung'
    });
  }

  res.status(200).json({
    id: req.user.id,
    name: req.user.name,
    role: req.user.role
  });
});

app.get('/profile', (req, res) => {
  const user = req.user || {
    name: 'NGUYEN VAN A',
    role: 'ADMIN'
  };

  res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Thong tin nguoi dung</title>
        </head>

        <body>
            <h2>Thong tin nguoi dung</h2>

            <p><strong>Ten:</strong> ${user.name}</p>
            <p><strong>Vai tro:</strong> ${user.role}</p>
        </body>
        </html>
    `);
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
