import prisma from '../../lib/prisma.js'


export class ProfilesRepository {
  async findById(id: string) {
    return prisma.profiles.findUnique({
      where: { id },
    });
  }
  async findAll(){
    return prisma.profiles.findMany();
  }
}