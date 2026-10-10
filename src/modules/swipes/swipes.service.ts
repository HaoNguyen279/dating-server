import { SwipesRepository } from "./swipes.repository.js";

export class SwipesService {
    constructor(private readonly swipesRepo: SwipesRepository) {}

    async getSwipesByUserId(userId: string) {
        return await this.swipesRepo.getSwipesByUserId(userId);
    }

    async createSwipe(swiperId: string, swipedId: string, action: 'like' | 'pass' | 'super_like') {
        return await this.swipesRepo.createSwipe(swiperId, swipedId, action);
    }
    
    async getUserSwipedMe(userId: string) {
        return await this.swipesRepo.getUserSwipedMe(userId);
    }
}