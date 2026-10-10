import { Request, Response } from "express";
import { ProfilesService } from "./profiles.service.js";

export class ProfilesController{
    constructor(private readonly profileService : ProfilesService){}
    async getAllProfiles(req : Request, res : Response){
        const data = await this.profileService.getAllProfiles()
        return res.status(200).json(data);
    }
}