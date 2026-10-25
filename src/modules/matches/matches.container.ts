import { MatchesController } from "./matches.controller.js";
import { MatchesRepository } from "./matches.repository.js";
import { MatchesService } from "./matches.service.js";

const matchesRepository = new MatchesRepository();
export const matchesService = new MatchesService(matchesRepository);
export const matchesController = new MatchesController(matchesService);
