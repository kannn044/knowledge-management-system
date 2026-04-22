import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { AppError } from './errorHandler';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/x-markdown': 'md',
  'application/pdf': 'pdf',
};

const ALLOWED_EXTENSIONS = ['.txt', '.md', '.pdf'];

/**
 * Multer disk storage — saves files under:
 * /uploads/{year}/{month}/{uuid}/original.{ext}
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const now = new Date();
    const dir = path.join(
      env.UPLOAD_DIR,
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      uuidv4()
    );
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },

  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `original${ext}`);
  },
});

/**
 * File filter — reject disallowed mime types and extensions.
 */
function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeAllowed = !!ALLOWED_MIME_TYPES[file.mimetype];
  const extAllowed = ALLOWED_EXTENSIONS.includes(ext);

  if (mimeAllowed || extAllowed) {
    cb(null, true);
  } else {
    cb(new AppError(
      `File type not allowed. Accepted: .txt, .md, .pdf. Got: ${ext || file.mimetype}`,
      415
    ));
  }
}

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});

/**
 * Derive the file type enum from a mimetype or filename.
 */
export function resolveFileType(file: Express.Multer.File): 'txt' | 'md' | 'pdf' {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (ext === 'txt') return 'txt';
  if (ext === 'md') return 'md';
  if (ext === 'pdf') return 'pdf';
  return ALLOWED_MIME_TYPES[file.mimetype] as 'txt' | 'md' | 'pdf' ?? 'txt';
}
