"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SeederService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeederService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../users/entities/user.entity");
let SeederService = SeederService_1 = class SeederService {
    userRepository;
    logger = new common_1.Logger(SeederService_1.name);
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async onModuleInit() {
        const mockEmail = 'mock@test.com';
        const exists = await this.userRepository.findOne({ where: { email: mockEmail } });
        if (!exists) {
            this.logger.log('Seeding mock user into the database...');
            const user = this.userRepository.create({
                id: '00000000-0000-0000-0000-000000000000',
                email: mockEmail,
                passwordHash: 'hashed_password_for_mock_user',
                displayName: 'Mock User',
                emailVerified: true,
            });
            await this.userRepository.save(user);
            this.logger.log('Mock user seeded successfully.');
        }
    }
};
exports.SeederService = SeederService;
exports.SeederService = SeederService = SeederService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SeederService);
//# sourceMappingURL=seeder.service.js.map