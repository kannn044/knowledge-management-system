import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger';

/**
 * File storage service.
 * Phase 1: local disk storage under /uploads/{year}/{month}/{uuid}/
 * Future: swap implementation for S3 / MinIO without changing callers.
 */
export const storageService = {
  /**
   * Read extracted text from disk (written by Python microservice).
   */
  readExtractedText(filePath: string): string {
    const extractedPath = path.join(path.dirname(filePath), 'extracted.txt');
    if (!fs.existsSync(extractedPath)) {
      throw new Error(`Extracted text not found: ${extractedPath}`);
    }
    return fs.readFileSync(extractedPath, 'utf-8');
  },

  /**
   * Delete a file and its parent directory.
   */
  deleteFile(filePath: string): void {
    try {
      const dir = path.dirname(filePath);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        logger.info(`Deleted file directory: ${dir}`);
      }
    } catch (error) {
      logger.error(`Failed to delete file: ${filePath}`, error);
    }
  },

  /**
   * Check if a file exists on disk.
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  },

  /**
   * Get file stats (size, etc.).
   */
  getFileSize(filePath: string): number {
    try {
      return fs.statSync(filePath).size;
    } catch {
      return 0;
    }
  },
};
