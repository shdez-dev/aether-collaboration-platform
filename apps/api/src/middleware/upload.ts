// apps/api/src/middleware/upload.ts

import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';

// Asegurar que el directorio existe
// En desarrollo (tsx): __dirname = apps/api/src/middleware
// En producción (node): __dirname = apps/api/dist/middleware
const uploadDir = path.join(__dirname, '../../public/uploads/avatars');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración del almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Guardar en la carpeta public/uploads/avatars
    // __dirname = apps/api/src in tsx dev, so ../public = apps/api/public
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre único: userId-timestamp.extension
    const userId = (req as any).user?.id;
    const ext = path.extname(file.originalname);
    const filename = `${userId}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

// Filtro para solo permitir imágenes
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
  }
};

// Configuración de multer
const multerUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
}).single('avatar'); // Campo 'avatar' en el form-data

// Middleware wrapper con manejo de errores
export const uploadAvatar = (req: Request, res: Response, next: NextFunction) => {
  multerUpload(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File size exceeds 5MB limit',
          },
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message,
        },
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE',
          message: err.message,
        },
      });
    }
    // Sin errores, continuar
    next();
  });
};
