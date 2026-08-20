import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { FileRecord, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { CreateUploadIntentsDto } from './dto/create-upload-intents.dto';
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

@Controller('data-rooms/:dataRoomId/upload-intents')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  async createUploadIntents(
    @CurrentUser() user: User,
    @Param('dataRoomId', new ParseUUIDPipe()) dataRoomId: string,
    @Body() dto: CreateUploadIntentsDto,
  ) {
    return {
      data: await this.files.createUploadIntents(user.id, dataRoomId, dto),
    };
  }

  @Post(':uploadId/confirm')
  async confirmUpload(
    @CurrentUser() user: User,
    @Param('dataRoomId', new ParseUUIDPipe()) dataRoomId: string,
    @Param('uploadId', new ParseUUIDPipe()) uploadId: string,
    @Body() dto: ConfirmUploadDto,
  ) {
    return {
      data: serializeFile(
        await this.files.confirmUpload(user.id, dataRoomId, uploadId, dto),
      ),
    };
  }

  @Delete(':uploadId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelUpload(
    @CurrentUser() user: User,
    @Param('dataRoomId', new ParseUUIDPipe()) dataRoomId: string,
    @Param('uploadId', new ParseUUIDPipe()) uploadId: string,
  ): Promise<void> {
    await this.files.cancelUpload(user.id, dataRoomId, uploadId);
  }
}
