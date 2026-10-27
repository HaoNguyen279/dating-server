import { Router } from "express";
import { recommendationsController } from "./recommendations.container.js";

const router = Router();

router.get("/", (req, res) => recommendationsController.getRecommendations(req, res));
router.get("/:userId", (req, res) => recommendationsController.getRecommendations(req, res));

export default router;
