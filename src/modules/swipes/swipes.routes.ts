import { Router } from "express";
import { swipesController } from "./swipes.container.js";

const router = Router();

router.get("/:id", (req, res) => swipesController.getSwipesByUserId(req, res));
router.get("/me", (req, res) => swipesController.getUsersSwipedMe  (req, res));
router.post("/", (req, res) => swipesController.createSwipe(req, res));

export default router;