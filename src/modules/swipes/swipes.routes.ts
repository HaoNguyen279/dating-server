import { Router } from "express";
import { swipesController } from "./swipes.container.js";

const router = Router();

// Create swipe
router.post("/", (req, res) => swipesController.createSwipe(req, res));

// User specific swipe history (explicit routes first)
router.get("/user/:userId", (req, res) => swipesController.getSwipesByUserId(req, res));
router.get("/swiped-me/:userId", (req, res) => swipesController.getUsersSwipedMe(req, res));

// Backwards compatibility routes
router.get("/me", (req, res) => swipesController.getUsersSwipedMe(req, res));
router.post("/me", (req, res) => swipesController.getUsersSwipedMe(req, res));
router.get("/:id", (req, res) => swipesController.getSwipesByUserId(req, res));

export default router;
