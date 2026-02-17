const express = require("express");
require("dotenv").config();

const app = express();
const connectDB = require("./config/db.js");
const cookieParser = require("cookie-parser");
const cors = require("cors");


const PORT = process.env.PORT || 5000;

connectDB();

app.use(express.json());
app.use(cookieParser());

app.use("/auth", require("./routes/authRoutes"));

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

app.listen(PORT, () => {
  console.log(`Server Is Running at http://localhost:${PORT}`);
});