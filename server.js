require('dotenv').config();
const app = require('./src/app');
const { initCron } = require('./src/jobs/cronScan');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  initCron();
});
