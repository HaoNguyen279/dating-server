import { PhotosController } from "./photos.controller.js";
import { PhotosRepository } from "./photos.repository.js";
import { PhotosService } from "./photos.service.js";

const photosRepository = new PhotosRepository();
const photosService = new PhotosService(photosRepository);

export const photosController = new PhotosController(photosService);
