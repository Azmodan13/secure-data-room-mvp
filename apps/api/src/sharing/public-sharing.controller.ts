import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { FilesService } from '../files/files.service';
import { PublicItemsQueryDto } from './dto/public-items-query.dto';
import { SharingService } from './sharing.service';

@Public()
@Controller('public/:token')
export class PublicSharingController {
  constructor(
    private readonly sharing: SharingService,
    private readonly files: FilesService,
  ) {}

  @Get()
  async getRoot(@Param('token') token: string) {
    return { data: await this.sharing.getPublicRoot(token) };
  }

  @Get('items')
  async listItems(
    @Param('token') token: string,
    @Query() query: PublicItemsQueryDto,
  ) {
    return {
      data: await this.sharing.listPublicItems(token, query.folderId),
    };
  }

  @Get('files/:fileId/view-url')
  async getViewUrl(
    @Param('token') token: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
  ) {
    return {
      data: await this.files.getPublicViewUrl(
        this.sharing.hashToken(token),
        fileId,
      ),
    };
  }

  @Get('folders/:folderId')
  async getFolder(
    @Param('token') token: string,
    @Param('folderId', new ParseUUIDPipe()) folderId: string,
  ) {
    return { data: await this.sharing.getPublicFolder(token, folderId) };
  }
}
