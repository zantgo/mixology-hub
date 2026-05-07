export declare class ImageService {
    private readonly UPLOAD_DIR;
    constructor();
    private ensureDirectoryExists;
    processAndSaveImage(file: Express.Multer.File): Promise<{
        full: string | null;
        thumb: string | null;
    }>;
    processAndSaveBuffer(buffer: Buffer): Promise<{
        full: string;
        thumb: string;
    }>;
}
