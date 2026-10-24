const app = require('./src/app');

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Pantau Tokder backend listening on http://localhost:${PORT}`);
  });
}

module.exports = app;