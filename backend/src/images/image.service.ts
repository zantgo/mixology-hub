import { Injectable, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ImageService {
  private readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'cocktails');

  constructor() {
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists() {
    await fs.mkdir(this.UPLOAD_DIR, { recursive: true });
  }

  async processAndSaveImage(file: Express.Multer.File): Promise<{ full: string | null; thumb: string | null }> {
    if (!file) return { full: null, thumb: null };

    // Validate MIME Type (Redundant safety check)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid image format. Only JPG, PNG, and WebP are allowed.');
    }

    const filename = uuidv4();
    const fullPath = path.join(this.UPLOAD_DIR, `${filename}-full.webp`);
    const thumbPath = path.join(this.UPLOAD_DIR, `${filename}-thumb.webp`);

    // Process Full Image (1024x1024, 1:1 Aspect Ratio, WebP, ~80% quality to stay under 300KB)
    // limitInputPixels prevents decompression bomb attacks (ADR 0016)
    await sharp(file.buffer, { limitInputPixels: 268435456 }) // 16384^2 max
      .resize(1024, 1024, { fit: 'cover', position: 'center' })
      .webp({ quality: 80, effort: 4 }) // Effort 4 balances speed/compression
      .toFile(fullPath);

    // Process Thumbnail (300x300, 1:1 Aspect Ratio, WebP)
    await sharp(file.buffer, { limitInputPixels: 268435456 })
      .resize(300, 300, { fit: 'cover', position: 'center' })
      .webp({ quality: 75, effort: 4 })
      .toFile(thumbPath);

    return {
      full: `/uploads/cocktails/${filename}-full.webp`,
      thumb: `/uploads/cocktails/${filename}-thumb.webp`,
    };
  }

  async processAndSaveBuffer(buffer: Buffer): Promise<{ full: string; thumb: string }> {
    const filename = uuidv4();
    const fullPath = path.join(this.UPLOAD_DIR, `${filename}-full.webp`);
    const thumbPath = path.join(this.UPLOAD_DIR, `${filename}-thumb.webp`);

    // Process Full Image (1024x1024, 1:1 Aspect Ratio, WebP, ~80% quality to stay under 300KB)
    // limitInputPixels prevents decompression bomb attacks (ADR 0016)
    await sharp(buffer, { limitInputPixels: 268435456 })
      .resize(1024, 1024, { fit: 'cover', position: 'center' })
      .webp({ quality: 80, effort: 4 })
      .toFile(fullPath);

    // Process Thumbnail (300x300, 1:1 Aspect Ratio, WebP)
    await sharp(buffer, { limitInputPixels: 268435456 })
      .resize(300, 300, { fit: 'cover', position: 'center' })
      .webp({ quality: 75, effort: 4 })
      .toFile(thumbPath);

    return {
      full: `/uploads/cocktails/${filename}-full.webp`,
      thumb: `/uploads/cocktails/${filename}-thumb.webp`,
    };
  }
}