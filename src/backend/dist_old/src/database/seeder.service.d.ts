import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
export declare class SeederService implements OnModuleInit {
    private readonly userRepository;
    private readonly logger;
    constructor(userRepository: Repository<User>);
    onModuleInit(): Promise<void>;
}
