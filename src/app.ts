import express from "express";
import cors from "./config/cors.js";
import "dotenv/config";
import profilesRouter from "./modules/profiles/profiles.routes.js";
import swipesRouter from "./modules/swipes/swipes.routes.js";
import usersRouter from "./modules/users/users.routes.js";
import preferencesRouter from "./modules/preferences/preferences.routes.js";
import matchesRouter from "./modules/matches/matches.routes.js";
import { notFoundHandler } from "./middlewares/not-found.js";
import { errorHandler } from "./middlewares/error-handler.js";

const app = express();

app.use(cors);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({ success: true, message: "Server is running" });
});

app.get("/", (_req, res) => {
  res.json({
    message: "Dating App API is running",
  });
});

app.use("/api/profiles", profilesRouter);
app.use("/api/swipes", swipesRouter);
app.use("/api/users", usersRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/matches", matchesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
