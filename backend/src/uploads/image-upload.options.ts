import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { ALLOWED_MIME, MAX_FILE_BYTES, UPLOAD_DIR } from './uploads.constants';

/** Use with FilesInterceptor / FileInterceptor: @UseInterceptors(FilesInterceptor('files', 5, imageUploadOptions)) */
export const imageUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`), // never trust the client name
  }),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) =>
    ALLOWED_MIME.includes(file.mimetype) ? cb(null, true) : cb(new BadRequestException('Only JPG and PNG images are allowed'), false),
};