import { Router } from "express";
import { authController } from "./auth.container.js";

const router = Router();

router.post("/register", (req, res) => authController.register(req, res));
router.post("/login", (req, res) => authController.login(req, res));
router.post("/google", (req, res) => authController.googleSignIn(req, res));
router.post("/firebase", (req, res) => authController.firebaseSignIn(req, res));
router.post("/firebase/phone-verification", (req, res) => authController.syncPhoneVerification(req, res));
router.post("/firebase/native-phone-session", (req, res) => authController.createNativePhoneSession(req, res));

export default router;
