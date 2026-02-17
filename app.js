const express = require("express");
require("dotenv").config();

const app = express();
const connectDB = require("./config/db.js");

const PORT = process.env.PORT || 5000;

connectDB();

app.use(express.json());

app.use("/auth", require("./routes/authRoutes"));

app.listen(PORT, () => {
  console.log(`Server Is Running at http://localhost:${PORT}`);
});