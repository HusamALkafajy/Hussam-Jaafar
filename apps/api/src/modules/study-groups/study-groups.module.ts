import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StudyGroupsController } from './study-groups.controller';
import { StudyGroupsService } from './study-groups.service';
import { StudyGroupsGateway } from './study-groups.gateway';

@Module({
  imports: [
    // JwtModule needed by the Gateway to verify tokens on WS connection
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('auth.jwtSecret'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [StudyGroupsController],
  providers: [StudyGroupsService, StudyGroupsGateway],
  exports: [StudyGroupsService], // Exported so ChatModule can use isFileSharedWithUser()
})
export class StudyGroupsModule {}
