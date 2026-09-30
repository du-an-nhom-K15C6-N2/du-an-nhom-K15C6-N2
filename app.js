module.exports = require('./rbac/app');

if (require.main === module) {
  const app = require('./rbac/app');
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`RBAC app listening on port ${port}`);
  });
}
