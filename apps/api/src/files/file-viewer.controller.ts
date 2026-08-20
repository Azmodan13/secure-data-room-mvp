import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { FileRecord, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { MoveFileDto } from './dto/move-file.dto';
import { RenameFileDto } from './dto/rename-file.dto';
import { BulkMoveFilesDto } from './dto/bulk-move-files.dto';
import { BulkDeleteFilesDto } from './dto/bulk-delete-files.dto';
import { FilesService } from './files.service';

function serializeFile(file: FileRecord) {
  return {
    id: file.id,
    dataRoomId: file.dataRoomId,
    folderId: file.folderId,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes.toString(),
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

@Controller('files')
export class FileViewerController {
  constructor(private readonly files: FilesService) {}

  @Get(':fileId')
  async getFile(
    @CurrentUser() user: User,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
  ) {
    return { data: serializeFile(await this.files.getFile(user.id, fileId)) };
  }

  @Post('bulk-move')
  async bulkMove(@CurrentUser() user: User, @Body() dto: BulkMoveFilesDto) {
    return {
      data: (await this.files.bulkMove(user.id, dto)).map(serializeFile),
    };
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async bulkDelete(
    @CurrentUser() user: User,
    @Body() dto: BulkDeleteFilesDto,
  ): Promise<void> {
    await this.files.bulkDelete(user.id, dto);
  }

  @Get(':fileId/view-url')
  async getViewUrl(
    @CurrentUser() user: User,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
  ) {
    return { data: await this.files.getViewUrl(user.id, fileId) };
  }

  @Patch(':fileId')
  async rename(
    @CurrentUser() user: User,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Body() dto: RenameFileDto,
  ) {
    return {
      data: serializeFile(await this.files.rename(user.id, fileId, dto)),
    };
  }

  @Post(':fileId/move')
  async move(
    @CurrentUser() user: User,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Body() dto: MoveFileDto,
  ) {
    return {
      data: serializeFile(await this.files.move(user.id, fileId, dto)),
    };
  }

  @Delete(':fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: User,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
  ): Promise<void> {
    await this.files.delete(user.id, fileId);
  }
}
