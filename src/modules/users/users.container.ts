import { UsersController } from "./users.controller.js";
import { UsersRepository } from "./users.repository.js";
import { UsersService } from "./users.service.js";

const usersRepository = new UsersRepository();
export const usersService = new UsersService(usersRepository);
export const usersController = new UsersController(usersService);
