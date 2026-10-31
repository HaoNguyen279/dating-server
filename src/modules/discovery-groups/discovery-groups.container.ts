import { DiscoveryGroupsController } from "./discovery-groups.controller.js";
import { DiscoveryGroupsRepository } from "./discovery-groups.repository.js";
import { DiscoveryGroupsService } from "./discovery-groups.service.js";
import { recommendationsService } from "../recommendations/recommendations.container.js";

const groupsRepository = new DiscoveryGroupsRepository();
const groupsService = new DiscoveryGroupsService(groupsRepository);

export const discoveryGroupsController = new DiscoveryGroupsController(groupsService, recommendationsService);
