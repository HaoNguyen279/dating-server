
import { SwipesController } from "./swipes.controller.js";
import { SwipesRepository } from "./swipes.repository.js";
import { SwipesService } from "./swipes.service.js";

const swipesRepository = new SwipesRepository();
export const swipesService = new SwipesService(swipesRepository);
export const swipesController = new SwipesController(swipesService);