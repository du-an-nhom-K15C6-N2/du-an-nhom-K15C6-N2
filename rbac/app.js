const app = require('../src/app');

module.exports = app;

if (require.main === module) {
	const port = process.env.PORT || 3000;
	app.listen(port, () => {
		console.log(`RBAC app listening on port ${port}`);
	});
}
