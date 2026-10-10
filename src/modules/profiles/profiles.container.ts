import { ProfilesController } from "./profiles.controller.js";
import { ProfilesRepository } from "./profiles.repository.js";
import { ProfilesService } from "./profiles.service.js";

const profilesRepository = new ProfilesRepository();
export const profilesService = new ProfilesService(profilesRepository);
export const profilesController = new ProfilesController(profilesService);