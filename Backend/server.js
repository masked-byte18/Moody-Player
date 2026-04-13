require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/db/db');

const port = Number(process.env.PORT || 3000);

const startServer = async () => {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();

