
import { ProfilesRepository } from "./profiles.repository.js";


export class ProfilesService {
  constructor(private readonly profilesRepo: ProfilesRepository){}
  async getProfileById(id: string) {
    const profile = await this.profilesRepo.findById(id);
    return profile;
  }
  async getAllProfiles(){
    const profiles = await this.profilesRepo.findAll();
    return profiles;
  }
}

