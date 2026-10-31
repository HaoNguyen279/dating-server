import { Router } from "express";
import { requireChatAuth } from "../chat/chat.auth.js";
import { discoveryGroupsController } from "./discovery-groups.container.js";

const router = Router();

router.use(requireChatAuth);
router.get("/", (req, res) => discoveryGroupsController.list(req, res));
router.get("/intentions", (req, res) => discoveryGroupsController.listRelationshipIntentions(req, res));
router.get("/intentions/recommendations", (req, res) => discoveryGroupsController.getRelationshipIntentionRecommendations(req, res));
router.post("/intentions/recommendations/impressions", (req, res) => discoveryGroupsController.recordImpressions(req, res));
router.get("/:slug/recommendations", (req, res) => discoveryGroupsController.getRecommendations(req, res));
router.post("/:slug/recommendations/impressions", (req, res) => discoveryGroupsController.recordImpressions(req, res));

export default router;
