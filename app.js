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

const allowedOrigins = [
  process.env.CLIENT_URL,          // e.g. http://localhost:5173
  process.env.CLIENT_URL_LAN,      // e.g. http://192.168.1.5:5173
].filter(Boolean);
app.set("trust proxy", 1);//ip prottection
app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (postman / curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  })
);


app.use("/auth", require("./routes/authRoutes"));
app.use("/api", require("./routes/product.routes"));
app.use("/api", require("./routes/catalog.routes"));
app.use("/api", require("./routes/admin.users.routes.js"));
app.use("/api/cart", require("./routes/cartRoutes.js"));
app.use("/api/admin/stock", require("./routes/adminStockRoutes.js"));
app.use("/api" , require("./routes/paymentRouter.js"))
app.use("/api" , require("./routes/order.roter.js"))

// app.use("/api/admin/returns", require("./routes/adminReturnRoutes.js"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});