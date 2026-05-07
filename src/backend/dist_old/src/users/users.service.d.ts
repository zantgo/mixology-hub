import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
export declare class UsersService {
    private readonly userRepository;
    constructor(userRepository: Repository<User>);
    create(createUserDto: CreateUserDto): Promise<User>;
    findAll(paginationQuery: PaginationQueryDto): Promise<{
        data: User[];
        meta: {
            currentPage: number;
            nextPage: number | null;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<User>;
    update(id: string, updateUserDto: UpdateUserDto): Promise<User>;
    getMockUser(): Promise<User>;
    remove(id: string): Promise<User>;
}
