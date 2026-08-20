import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Folder, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateFolderDto } from './dto/create-folder.dto';
import { ListFoldersQueryDto } from './dto/list-folders-query.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { FoldersService } from './folders.service';

function serializeFolder(folder: Folder) {
  return {
    id: folder.id,
    dataRoomId: folder.dataRoomId,
    parentId: folder.parentId,
    name: folder.name,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

@Controller()
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  @Get('folders/:folderId/delete-summary')
  async getDeleteSummary(
    @CurrentUser() user: User,
    @Param('folderId', new ParseUUIDPipe()) folderId: string,
  ) {
    const summary = await this.folders.getDeleteSummary(user.id, folderId);

    return {
      data: summary,
    };
  }

  @Post('data-rooms/:dataRoomId/folders')
  async create(
    @CurrentUser() user: User,
    @Param('dataRoomId', new ParseUUIDPipe()) dataRoomId: string,
    @Body() dto: CreateFolderDto,
  ) {
    const folder = await this.folders.create(user.id, dataRoomId, dto);

    return {
      data: serializeFolder(folder),
    };
  }

  @Get('data-rooms/:dataRoomId/folders')
  async listDestinations(
    @CurrentUser() user: User,
    @Param('dataRoomId', new ParseUUIDPipe()) dataRoomId: string,
    @Query() query: ListFoldersQueryDto,
  ) {
    const result = await this.folders.listDestinations(
      user.id,
      dataRoomId,
      query,
    );

    return {
      data: result.items.map(serializeFolder),
      page: {
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
      },
    };
  }

  @Get('folders/:folderId')
  async get(
    @CurrentUser() user: User,
    @Param('folderId', new ParseUUIDPipe()) folderId: string,
  ) {
    const folder = await this.folders.get(user.id, folderId);

    return {
      data: serializeFolder(folder),
    };
  }

  @Get('folders/:folderId/breadcrumbs')
  async getBreadcrumbs(
    @CurrentUser() user: User,
    @Param('folderId', new ParseUUIDPipe()) folderId: string,
  ) {
    const breadcrumbs = await this.folders.getBreadcrumbs(user.id, folderId);

    return {
      data: breadcrumbs,
    };
  }

  @Patch('folders/:folderId')
  async rename(
    @CurrentUser() user: User,
    @Param('folderId', new ParseUUIDPipe()) folderId: string,
    @Body() dto: UpdateFolderDto,
  ) {
    const folder = await this.folders.rename(user.id, folderId, dto);

    return {
      data: serializeFolder(folder),
    };
  }

  @Delete('folders/:folderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: User,
    @Param('folderId', new ParseUUIDPipe()) folderId: string,
  ): Promise<void> {
    await this.folders.delete(user.id, folderId);
  }
}
