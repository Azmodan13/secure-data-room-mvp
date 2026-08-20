import { Module } from '@nestjs/common';
import { AccessPolicyModule } from '../access-policy/access-policy.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { FileViewerController } from './file-viewer.controller';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [PrismaModule, AccessPolicyModule, StorageModule],
  controllers: [FilesController, FileViewerController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
