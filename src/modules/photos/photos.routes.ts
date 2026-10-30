import { Router } from "express";
import multer from "multer";
import { requireChatAuth } from "../chat/chat.auth.js";
import { photosController } from "./photos.container.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.mimetype)) {
      callback(null, false);
      return;
    }
    callback(null, true);
  },
});

router.use(requireChatAuth);

router.get("/me/photos", (req, res) => photosController.list(req, res));
router.post("/me/photos", (req, res, next) => {
  upload.single("image")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({
        success: false,
        message: error.code === "LIMIT_FILE_SIZE"
          ? "Image must be 10 MB or smaller"
          : "Upload one supported image using the 'image' field (JPEG, PNG, WebP, AVIF, or HEIC)",
      });
      return;
    }
    if (error) return next(error);
    void photosController.upload(req, res);
  });
});
router.patch("/me/photos/order", (req, res) => photosController.setOrder(req, res));
router.patch("/me/photos/:photoId/primary", (req, res) => photosController.setPrimary(req, res));
router.delete("/me/photos/:photoId", (req, res) => photosController.delete(req, res));

export default router;
