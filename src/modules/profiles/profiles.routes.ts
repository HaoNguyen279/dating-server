import { Router } from "express";
import { profilesController } from "./profiles.container.js";

const router = Router();

// List & Create
router.get("/", (req, res) => profilesController.list(req, res));
router.post("/", (req, res) => profilesController.create(req, res));

// User-centric profile endpoints (must come before /:id)
router.get("/user/:userId", (req, res) => profilesController.getByUserId(req, res));
router.patch("/user/:userId", (req, res) => profilesController.updateByUserId(req, res));
router.put("/user/:userId", (req, res) => profilesController.upsertByUserId(req, res));
router.delete("/user/:userId", (req, res) => profilesController.deleteByUserId(req, res));

// Profile ID specific endpoints
router.get("/:id", (req, res) => profilesController.getById(req, res));
router.patch("/:id", (req, res) => profilesController.updateById(req, res));
router.delete("/:id", (req, res) => profilesController.deleteById(req, res));

export default router;
