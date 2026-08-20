import { Module } from '@nestjs/common';
import { AccessPolicyModule } from '../access-policy/access-policy.module';
import { FilesModule } from '../files/files.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SharingController } from './sharing.controller';
import { PublicSharingController } from './public-sharing.controller';
import { SharingService } from './sharing.service';

@Module({
  imports: [PrismaModule, AccessPolicyModule, FilesModule],
  controllers: [SharingController, PublicSharingController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
