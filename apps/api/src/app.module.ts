import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { AccessPolicyModule } from './access-policy/access-policy.module';
import { DataRoomsModule } from './data-rooms/data-rooms.module';
import { FoldersModule } from './folders/folders.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AccessPolicyModule,
    DataRoomsModule,
    FoldersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
