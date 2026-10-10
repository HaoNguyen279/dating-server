import express from "express";
import cors from "./config/cors.js";
import "dotenv/config";
import profilesRouter from "./modules/profiles/profiles.routes.js";
import swipesRouter from "./modules/swipes/swipes.routes.js";
const app = express();

app.use(cors);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({ success: true, message: "Server is running" });
});

app.get("/", (req, res) => {
  res.json({
    message: "Dating App API is running"
  });
});

app.use("/api/profiles", profilesRouter);
app.use("/api/swipes", swipesRouter);

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});