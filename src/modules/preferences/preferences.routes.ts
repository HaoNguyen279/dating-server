import { Router } from "express";
import { preferencesController } from "./preferences.container.js";

const router = Router();

router.get("/", (req, res) => preferencesController.list(req, res));
router.post("/", (req, res) => preferencesController.create(req, res));
router.get("/user/:userId", (req, res) => preferencesController.getByUserId(req, res));
router.put("/user/:userId", (req, res) => preferencesController.upsert(req, res));
router.patch("/user/:userId", (req, res) => preferencesController.update(req, res));
router.delete("/user/:userId", (req, res) => preferencesController.delete(req, res));

export default router;
