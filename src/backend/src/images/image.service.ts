import { Injectable, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ImageService {
  private readonly UPLOAD_DIR = path.join(
    process.cwd(),
    'uploads',
    'cocktails',
  );
  private readonly MAX_INPUT_PIXELS = parseInt(
    process.env.IMAGE_MAX_INPUT_PIXELS || '4194304',
    10,
  );
  private readonly WEBP_QUALITY_FULL = parseInt(
    process.env.IMAGE_WEBP_QUALITY_FULL || '80',
    10,
  );
  private readonly WEBP_QUALITY_THUMB = parseInt(
    process.env.IMAGE_WEBP_QUALITY_THUMB || '75',
    10,
  );
  private readonly WEBP_EFFORT = parseInt(
    process.env.IMAGE_WEBP_EFFORT || '4',
    10,
  );

  async processAndSaveImage(
    file: Express.Multer.File,
  ): Promise<{ full: string | null; thumb: string | null }> {
    if (!file) return { full: null, thumb: null };

    await fs.mkdir(this.UPLOAD_DIR, { recursive: true });

    // Validate MIME Type (Redundant safety check)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid image format. Only JPG, PNG, and WebP are allowed.',
      );
    }

    const filename = uuidv4();
    const fullPath = path.join(this.UPLOAD_DIR, `${filename}-full.webp`);
    const thumbPath = path.join(this.UPLOAD_DIR, `${filename}-thumb.webp`);

    // Process Full Image (1024x1024, 1:1 Aspect Ratio, WebP, ~80% quality to stay under 300KB)
    // limitInputPixels prevents decompression bomb attacks (ADR 0016)
    await sharp(file.buffer, { limitInputPixels: this.MAX_INPUT_PIXELS }) // 2048^2 max
      .resize(1024, 1024, { fit: 'cover', position: 'center' })
      .webp({ quality: this.WEBP_QUALITY_FULL, effort: this.WEBP_EFFORT })
      .toFile(fullPath);

    // Process Thumbnail (300x300, 1:1 Aspect Ratio, WebP)
    await sharp(file.buffer, { limitInputPixels: this.MAX_INPUT_PIXELS })
      .resize(300, 300, { fit: 'cover', position: 'center' })
      .webp({ quality: this.WEBP_QUALITY_THUMB, effort: this.WEBP_EFFORT })
      .toFile(thumbPath);

    return {
      full: `/uploads/cocktails/${filename}-full.webp`,
      thumb: `/uploads/cocktails/${filename}-thumb.webp`,
    };
  }

  async processAndSaveBuffer(
    buffer: Buffer,
    mimetype?: string,
  ): Promise<{ full: string; thumb: string }> {
    if (mimetype) {
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(mimetype)) {
        throw new BadRequestException(
          'Invalid image format. Only JPG, PNG, and WebP are allowed.',
        );
      }
    }

    await fs.mkdir(this.UPLOAD_DIR, { recursive: true });

    const filename = uuidv4();
    const fullPath = path.join(this.UPLOAD_DIR, `${filename}-full.webp`);
    const thumbPath = path.join(this.UPLOAD_DIR, `${filename}-thumb.webp`);

    // Process Full Image (1024x1024, 1:1 Aspect Ratio, WebP, ~80% quality to stay under 300KB)
    // limitInputPixels prevents decompression bomb attacks (ADR 0016)
    await sharp(buffer, { limitInputPixels: this.MAX_INPUT_PIXELS })
      .resize(1024, 1024, { fit: 'cover', position: 'center' })
      .webp({ quality: this.WEBP_QUALITY_FULL, effort: this.WEBP_EFFORT })
      .toFile(fullPath);

    // Process Thumbnail (300x300, 1:1 Aspect Ratio, WebP)
    await sharp(buffer, { limitInputPixels: this.MAX_INPUT_PIXELS })
      .resize(300, 300, { fit: 'cover', position: 'center' })
      .webp({ quality: this.WEBP_QUALITY_THUMB, effort: this.WEBP_EFFORT })
      .toFile(thumbPath);

    return {
      full: `/uploads/cocktails/${filename}-full.webp`,
      thumb: `/uploads/cocktails/${filename}-thumb.webp`,
    };
  }
}
