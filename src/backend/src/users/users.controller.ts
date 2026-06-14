import {
  Controller,
  UseGuards,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

interface AuthenticatedRequest extends ExpressRequest {
  user: { id: string; [key: string]: unknown };
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get current user preferences' })
  getPreferences(@Request() req: AuthenticatedRequest) {
    return this.usersService.getPreferences(req.user.id);
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Update current user preferences' })
  updatePreferences(
    @Request() req: AuthenticatedRequest,
    @Body() preferencesDto: Record<string, unknown>,
  ) {
    return this.usersService.updatePreferences(req.user.id, preferencesDto);
  }

  @Get('me/cocktails')
  @ApiOperation({ summary: 'Get cocktails authored by current user' })
  getAuthoredCocktails(
    @Request() req: AuthenticatedRequest,
    @Query() paginationQuery: PaginationQueryDto,
  ) {
    return this.usersService.getAuthoredCocktails(req.user.id, paginationQuery);
  }

  @Get('me/preparations')
  @ApiOperation({ summary: 'Get recent preparations for current user' })
  getRecentPreparations(
    @Request() req: AuthenticatedRequest,
    @Query() paginationQuery: PaginationQueryDto,
  ) {
    return this.usersService.getRecentPreparations(
      req.user.id,
      paginationQuery,
    );
  }

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Create a new user (admin only)' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get all users with pagination (admin only)' })
  findAll(@Query() paginationQuery: PaginationQueryDto) {
    return this.usersService.findAll(paginationQuery);
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get a user by ID (admin only)' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update a user (admin only)' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Delete a user (admin only)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
