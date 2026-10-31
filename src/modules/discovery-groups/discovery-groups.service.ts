import { DiscoveryGroupsRepository } from "./discovery-groups.repository.js";

export class DiscoveryGroupsHttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "DiscoveryGroupsHttpError";
  }
}

export class DiscoveryGroupsService {
  constructor(private readonly groupsRepo: DiscoveryGroupsRepository) {}

  list(userId: string) {
    return this.groupsRepo.listActive(userId);
  }

  listRelationshipIntentionCounts() {
    return this.groupsRepo.listRelationshipIntentionCounts();
  }
}
