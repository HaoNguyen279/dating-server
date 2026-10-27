import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";

const authRepository = new AuthRepository();
const authService = new AuthService(authRepository);

export const authController = new AuthController(authService);
