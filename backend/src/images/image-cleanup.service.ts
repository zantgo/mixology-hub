import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ImageCleanupService {
  private readonly logger = new Logger(ImageCleanupService.name);
  private readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'cocktails');

  constructor(
    @InjectRepository(Cocktail)
    private readonly cocktailRepository: Repository<Cocktail>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOrphanImages(): Promise<void> {
    this.logger.log('Starting orphan image cleanup');

    let filesOnDisk: string[] = [];
    try {
      filesOnDisk = await fs.readdir(this.UPLOAD_DIR);
    } catch {
      this.logger.log('Upload directory does not exist — nothing to clean');
      return;
    }

    const webpFiles = filesOnDisk.filter((f) => f.endsWith('.webp'));
    if (webpFiles.length === 0) return;

    const cocktails = await this.cocktailRepository.find({
      select: ['image_full', 'image_thumb'],
      where: { is_deleted: false },
    });

    const referenced = new Set<string>();
    for (const c of cocktails) {
      if (c.image_full) referenced.add(path.basename(c.image_full));
      if (c.image_thumb) referenced.add(path.basename(c.image_thumb));
    }

    let deletedCount = 0;
    let freedBytes = 0;

    for (const filename of webpFiles) {
      if (!referenced.has(filename)) {
        const filePath = path.join(this.UPLOAD_DIR, filename);
        try {
          const stat = await fs.stat(filePath);
          freedBytes += stat.size;
          await fs.unlink(filePath);
          deletedCount++;
          this.logger.debug(`Deleted orphan: ${filename} (${stat.size} bytes)`);
        } catch (err: any) {
          this.logger.error(`Failed to delete orphan ${filename}: ${err.message}`);
        }
      }
    }

    const freedMB = (freedBytes / (1024 * 1024)).toFixed(2);
    this.logger.log(`Orphan cleanup complete: ${deletedCount} files, ${freedMB} MB freed`);
  }
}
