import { Router } from "express";
import { usersController } from "./users.container.js";

const router = Router();

// Availability check (must come before /:id)
router.get("/check", (req, res) => usersController.checkAvailability(req, res));

// List and Create
router.get("/", (req, res) => usersController.getUsers(req, res));
router.post("/", (req, res) => usersController.createUser(req, res));

// Specific User operations
router.get("/:id", (req, res) => usersController.getUserById(req, res));
router.patch("/:id", (req, res) => usersController.updateUser(req, res));
router.put("/:id", (req, res) => usersController.updateUser(req, res));
router.patch("/:id/status", (req, res) => usersController.updateStatus(req, res));
router.post("/:id/activity", (req, res) => usersController.recordActivity(req, res));
router.delete("/:id", (req, res) => usersController.deleteUser(req, res));

export default router;
