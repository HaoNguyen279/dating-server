import { PreferencesController } from "./preferences.controller.js";
import { PreferencesRepository } from "./preferences.repository.js";
import { PreferencesService } from "./preferences.service.js";

const preferencesRepository = new PreferencesRepository();
export const preferencesService = new PreferencesService(preferencesRepository);
export const preferencesController = new PreferencesController(preferencesService);
