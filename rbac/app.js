const express = require('express');
const gradeRoutes = require('./routes/gradeRoutes');
const tuitionRoutes = require('./routes/tuitionRoutes');
const rbacPolicy = require('./config/rbacPolicy');

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
app.get('/api/v1/navigation', (req, res) => {
  const user = req.user || {
    id: 1,
    name: 'NGUYEN VAN A',
    role: 'ADMIN'
  };

  const permissions = rbacPolicy[user.role] || {
    grades: [],
    tuition: [],
    system: []
  };

  res.status(200).json({
    id: user.id,
    name: user.name,
    role: user.role,
    permissions: permissions
  });
});
app.get('/profile', (req, res) => {
  const user = req.user || {
    name: 'NGUYEN VAN A',
    role: 'ADMIN'
  };
  const menuItems = [
    {
      name: 'Trang chu',
      path: '/',
      roles: ['ADMIN', 'LECTURER', 'STUDENT']
    },
    {
      name: 'Ho so',
      path: '/profile',
      roles: ['ADMIN', 'LECTURER', 'STUDENT']
    },
    {
      name: 'Quan ly diem',
      path: '/api/v1/grades/update',
      roles: ['ADMIN', 'LECTURER']
    },
    {
      name: 'Quan ly hoc phi',
      path: '/api/v1/tuition/update',
      roles: ['ADMIN', 'ACCOUNTANT']
    }
  ];

  const visibleMenu = menuItems.filter(item =>
    item.roles.includes(user.role)
  );

  const menuHtml = visibleMenu.map(item =>
    `<li><a href="${item.path}">${item.name}</a></li>`
  ).join('');

  res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
    body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 20px;
        background: #f5f5f5;
    }

    .profile-box {
        max-width: 400px;
        margin: 20px auto;
        padding: 20px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-sizing: border-box;
    }

    @media (max-width: 360px) {
        body {
            padding: 10px;
        }

        .profile-box {
            width: 100%;
            margin: 10px 0;
            padding: 15px;
        }

        h2 {
            font-size: 20px;
        }

        p {
            font-size: 14px;
        }
    }
</style>
            <title>Thong tin nguoi dung</title>
        </head>

        <body>
    <div class="profile-box">
        <h2>Thong tin nguoi dung</h2>
        <p><strong>Ten:</strong> ${user.name}</p>
        <p><strong>Vai tro:</strong> ${user.role}</p>
        <h3>Menu</h3>
        <ul>
    ${menuHtml}
</ul>
 
    </div>
</body>
        </html>
    `);
});
app.get('/unauthorized', (req, res) => {
  res.status(403).send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Khong co quyen truy cap</title>

            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 30px;
                    background: #f5f5f5;
                }

                .message-box {
                    max-width: 500px;
                    margin: 50px auto;
                    padding: 25px;
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                }
            </style>
        </head>

        <body>
            <div class="message-box">
                <h2>Khong co quyen truy cap</h2>
                <p>Ban khong duoc phep su dung chuc nang nay.</p>
            </div>
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
