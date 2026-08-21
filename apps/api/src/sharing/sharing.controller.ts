import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateShareGrantDto } from './dto/create-share-grant.dto';
import { ListOwnedAccessQueryDto } from './dto/list-owned-access-query.dto';
import { ResourceTargetDto } from './dto/resource-target.dto';
import { SharingService } from './sharing.service';

@Controller('shares')
export class SharingController {
  constructor(private readonly sharing: SharingService) {}

  @Post('public-links')
  async createPublicLink(
    @CurrentUser() user: User,
    @Body() dto: ResourceTargetDto,
  ) {
    return { data: await this.sharing.createPublicLink(user.id, dto) };
  }

  @Get('public-links')
  async listOwnedPublicLinks(
    @CurrentUser() user: User,
    @Query() query: ListOwnedAccessQueryDto,
  ) {
    return { data: await this.sharing.listOwnedPublicLinks(user.id, query) };
  }

  @Get('grants')
  async listOwnedGrants(
    @CurrentUser() user: User,
    @Query() query: ListOwnedAccessQueryDto,
  ) {
    return { data: await this.sharing.listOwnedGrants(user.id, query) };
  }

  @Delete('public-links/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokePublicLink(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.sharing.revokePublicLink(user.id, id);
  }

  @Post('grants')
  async createGrant(
    @CurrentUser() user: User,
    @Body() dto: CreateShareGrantDto,
  ) {
    return { data: await this.sharing.createGrant(user.id, dto) };
  }

  @Delete('grants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeGrant(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.sharing.revokeGrant(user.id, id);
  }

  @Get('received')
  async listReceived(@CurrentUser() user: User) {
    return { data: await this.sharing.listReceived(user.id) };
  }

  @Get()
  async listTargetShares(
    @CurrentUser() user: User,
    @Query() dto: ResourceTargetDto,
  ) {
    return { data: await this.sharing.listTargetShares(user.id, dto) };
  }
}
