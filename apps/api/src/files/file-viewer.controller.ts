import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { FileRecord, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
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

  @Get(':fileId/view-url')
  async getViewUrl(
    @CurrentUser() user: User,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
  ) {
    return { data: await this.files.getViewUrl(user.id, fileId) };
  }
}
