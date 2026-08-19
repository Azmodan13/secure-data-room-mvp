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
import { CurrentUser } from '../auth/current-user.decorator';
import { DataRoomsService } from './data-rooms.service';
import { CreateDataRoomDto } from './dto/create-data-room.dto';
import { ListDataRoomsQueryDto } from './dto/list-data-rooms-query.dto';
import { UpdateDataRoomDto } from './dto/update-data-room.dto';
import type { DataRoom, User } from '@prisma/client';
import { ListItemsQueryDto } from './dto/list-items-query.dto';

function serializeDataRoom(dataRoom: DataRoom) {
  return {
    id: dataRoom.id,
    ownerId: dataRoom.ownerId,
    name: dataRoom.name,
    createdAt: dataRoom.createdAt,
    updatedAt: dataRoom.updatedAt,
  };
}

@Controller('data-rooms')
export class DataRoomsController {
  constructor(private readonly dataRooms: DataRoomsService) {}

  @Delete(':dataRoomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: User,
    @Param('dataRoomId', new ParseUUIDPipe()) dataRoomId: string,
  ): Promise<void> {
    await this.dataRooms.delete(user.id, dataRoomId);
  }

  @Get(':dataRoomId/delete-summary')
  async getDeleteSummary(
    @CurrentUser() user: User,
    @Param('dataRoomId', new ParseUUIDPipe()) dataRoomId: string,
  ) {
    const summary = await this.dataRooms.getDeleteSummary(user.id, dataRoomId);

    return {
      data: summary,
    };
  }

  @Get(':dataRoomId/items')
  async listItems(
    @CurrentUser() user: User,
    @Param('dataRoomId', new ParseUUIDPipe()) dataRoomId: string,
    @Query() query: ListItemsQueryDto,
  ) {
    const result = await this.dataRooms.listItems(user.id, dataRoomId, query);

    return {
      data: result.items,
      page: {
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
      },
    };
  }

  @Get()
  async list(@CurrentUser() user: User, @Query() query: ListDataRoomsQueryDto) {
    const result = await this.dataRooms.listOwned(user.id, query);

    return {
      data: result.items.map(serializeDataRoom),
      page: {
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
      },
    };
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateDataRoomDto) {
    const dataRoom = await this.dataRooms.create(user.id, dto);

    return {
      data: serializeDataRoom(dataRoom),
    };
  }

  @Get(':dataRoomId')
  async get(
    @CurrentUser() user: User,
    @Param('dataRoomId', new ParseUUIDPipe()) dataRoomId: string,
  ) {
    const dataRoom = await this.dataRooms.get(user.id, dataRoomId);

    return {
      data: serializeDataRoom(dataRoom),
    };
  }

  @Patch(':dataRoomId')
  async rename(
    @CurrentUser() user: User,
    @Param('dataRoomId', new ParseUUIDPipe()) dataRoomId: string,
    @Body() dto: UpdateDataRoomDto,
  ) {
    const dataRoom = await this.dataRooms.rename(user.id, dataRoomId, dto);

    return {
      data: serializeDataRoom(dataRoom),
    };
  }
}
