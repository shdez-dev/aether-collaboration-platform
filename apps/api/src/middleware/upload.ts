// apps/api/src/middleware/upload.ts

import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

// Usar memoria en vez de disco — el buffer se sube directamente a R2
const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se aceptan JPEG, PNG, GIF y WebP.'));
  }
};

const multerUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
}).single('avatar');

export const uploadAvatar = (req: Request, res: Response, next: NextFunction) => {
  multerUpload(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: { code: 'FILE_TOO_LARGE', message: 'El archivo supera el límite de 5MB' },
        });
      }
      return res.status(400).json({
        success: false,
        error: { code: 'UPLOAD_ERROR', message: err.message },
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_FILE', message: err.message },
      });
    }
    next();
  });
};

// Middleware genérico para subir cualquier tipo de archivo (PDFs, imágenes, etc.)
const multerFileUpload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB máximo
  },
}).single('file');

export const uploadFile = (req: Request, res: Response, next: NextFunction) => {
  multerFileUpload(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: { code: 'FILE_TOO_LARGE', message: 'El archivo supera el límite de 20MB' },
        });
      }
      return res.status(400).json({
        success: false,
        error: { code: 'UPLOAD_ERROR', message: err.message },
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_FILE', message: err.message },
      });
    }
    next();
  });
};
