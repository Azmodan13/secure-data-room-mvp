import { Module } from '@nestjs/common';
import { AccessPolicyModule } from '../access-policy/access-policy.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DataRoomsController } from './data-rooms.controller';
import { DataRoomsService } from './data-rooms.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, AccessPolicyModule, StorageModule],
  controllers: [DataRoomsController],
  providers: [DataRoomsService],
  exports: [DataRoomsService],
})
export class DataRoomsModule {}
