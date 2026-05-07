"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageService = void 0;
const common_1 = require("@nestjs/common");
const sharp_1 = __importDefault(require("sharp"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const uuid_1 = require("uuid");
let ImageService = class ImageService {
    UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'cocktails');
    constructor() {
        this.ensureDirectoryExists();
    }
    async ensureDirectoryExists() {
        await fs.mkdir(this.UPLOAD_DIR, { recursive: true });
    }
    async processAndSaveImage(file) {
        if (!file)
            return { full: null, thumb: null };
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new common_1.BadRequestException('Invalid image format. Only JPG, PNG, and WebP are allowed.');
        }
        const filename = (0, uuid_1.v4)();
        const fullPath = path.join(this.UPLOAD_DIR, `${filename}-full.webp`);
        const thumbPath = path.join(this.UPLOAD_DIR, `${filename}-thumb.webp`);
        await (0, sharp_1.default)(file.buffer, { limitInputPixels: 268435456 })
            .resize(1024, 1024, { fit: 'cover', position: 'center' })
            .webp({ quality: 80, effort: 4 })
            .toFile(fullPath);
        await (0, sharp_1.default)(file.buffer, { limitInputPixels: 268435456 })
            .resize(300, 300, { fit: 'cover', position: 'center' })
            .webp({ quality: 75, effort: 4 })
            .toFile(thumbPath);
        return {
            full: `/uploads/cocktails/${filename}-full.webp`,
            thumb: `/uploads/cocktails/${filename}-thumb.webp`,
        };
    }
    async processAndSaveBuffer(buffer) {
        const filename = (0, uuid_1.v4)();
        const fullPath = path.join(this.UPLOAD_DIR, `${filename}-full.webp`);
        const thumbPath = path.join(this.UPLOAD_DIR, `${filename}-thumb.webp`);
        await (0, sharp_1.default)(buffer, { limitInputPixels: 268435456 })
            .resize(1024, 1024, { fit: 'cover', position: 'center' })
            .webp({ quality: 80, effort: 4 })
            .toFile(fullPath);
        await (0, sharp_1.default)(buffer, { limitInputPixels: 268435456 })
            .resize(300, 300, { fit: 'cover', position: 'center' })
            .webp({ quality: 75, effort: 4 })
            .toFile(thumbPath);
        return {
            full: `/uploads/cocktails/${filename}-full.webp`,
            thumb: `/uploads/cocktails/${filename}-thumb.webp`,
        };
    }
};
exports.ImageService = ImageService;
exports.ImageService = ImageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ImageService);
//# sourceMappingURL=image.service.js.map