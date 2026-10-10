import { Router } from "express";
import { profilesController } from "./profiles.container.js";
const router = Router();

router.get("/", (req, res) => profilesController.getAllProfiles(req, res))

export default router;