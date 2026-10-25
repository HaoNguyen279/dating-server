import { Router } from "express";
import { matchesController } from "./matches.container.js";

const router = Router();

// Matches of a specific user (must come before /:id)
router.get("/user/:userId", (req, res) => matchesController.getByUserId(req, res));

// Match detail & unmatch
router.get("/:id", (req, res) => matchesController.getById(req, res));
router.patch("/:id/unmatch", (req, res) => matchesController.unmatch(req, res));
router.post("/:id/unmatch", (req, res) => matchesController.unmatch(req, res));

export default router;
