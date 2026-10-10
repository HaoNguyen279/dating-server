import prisma from "../../lib/prisma.js";

export interface Swipe {
    id: string;
    swiper_id: string;
    swiped_id: string;
    action: 'like' | 'pass' | 'super_like';
}

export class SwipesRepository {
    async getSwipesByUserId(userId: string): Promise<Swipe[]> {
        return await prisma.swipes.findMany({
            where: {
                swiper_id: userId
            }
        });
    }

    async createSwipe(swiper_id: string, swiped_id: string, action: 'like' | 'pass' | 'super_like') {
        return await prisma.swipes.create({
            data: {
                swiper_id,
                swiped_id,
                action
            }
        });
    }
    async getUserSwipedMe(userId: string): Promise<Swipe[]> {
        return await prisma.swipes.findMany({
            where: {
                swiped_id: userId
            },
            include: {
                users_swipes_swiper_idTousers: true
            }
        });
    }
}