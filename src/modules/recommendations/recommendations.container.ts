import { RecommendationsController } from "./recommendations.controller.js";
import { RecommendationsRepository } from "./recommendations.repository.js";
import { RecommendationsService } from "./recommendations.service.js";

const recommendationsRepository = new RecommendationsRepository();
export const recommendationsService = new RecommendationsService(recommendationsRepository);
export const recommendationsController = new RecommendationsController(recommendationsService);
