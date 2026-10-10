
import { Request, Response } from "express";
import { SwipesService } from "./swipes.service.js";
import { createSwipeSchema } from "./swipes.validation.js";

export class SwipesController {
    constructor(private readonly swipesService: SwipesService) {}

    async getSwipesByUserId(req: Request, res: Response) {
        const id = req.params.id;
        if (typeof id !== "string") {
            return res.status(400).json({ message: "Invalid ID" });
        }
        const swipes = await this.swipesService.getSwipesByUserId(id);
        return res.status(200).json(swipes);
    }

    async getUsersSwipedMe(req: Request, res: Response) {
        const id = req.body.id;
        if (typeof id !== "string") {
            return res.status(400).json({ message: "Invalid ID" });
        }
        const swipes = await this.swipesService.getUserSwipedMe(id);
        return res.status(200).json(swipes);
    }

    async createSwipe(req: Request, res: Response) {
        const result = createSwipeSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                message: "Invalid swipe data",
                errors: result.error.flatten().fieldErrors
            });
        }

        const swipe = await this.swipesService.createSwipe(
            result.data.swiper_id,
            result.data.swiped_id,
            result.data.action
        );

        return res.status(201).json(swipe);
    }
}