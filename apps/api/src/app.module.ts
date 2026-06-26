import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import aiConfig from './config/ai.config';
import stripeConfig from './config/stripe.config';
import queueConfig from './config/queue.config';
import { AuthModule } from './modules/auth/auth.module';
import { BullModule } from '@nestjs/bullmq';
import { UsersModule } from './modules/users/users.module';
import { FilesModule } from './modules/files/files.module';
import { AiModule } from './modules/ai/ai.module';
import { ExamsModule } from './modules/exams/exams.module';
import { FlashcardsModule } from './modules/flashcards/flashcards.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdminModule } from './modules/admin/admin.module';
import { StudyCoachModule } from './modules/study-coach/study-coach.module';
import { RecommendationModule } from './modules/recommendations/recommendation.module';
import { RagModule } from './modules/rag/rag.module';
import { LearningPathsModule } from './modules/learning-paths/learning-paths.module';
import { ProjectSubmissionsModule } from './modules/project-submissions/project-submissions.module';
import { CertificationsModule } from './modules/certifications/certifications.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotesModule } from './modules/notes/notes.module';
import { StudyGroupsModule } from './modules/study-groups/study-groups.module';
import { CustomThrottlerGuard } from './common/guards/throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      load: [appConfig, databaseConfig, authConfig, aiConfig, stripeConfig, queueConfig],
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: configService.get('queue.redis') as any,
      }),
      inject: [ConfigService],
    }),
    // Use static throttler config to avoid runtime init ordering issues.
    ThrottlerModule.forRoot({
      throttlers: [
        {
          // Global throttler
          limit: Number(process.env.THROTTLE_LIMIT) || 100,
          ttl: Number(process.env.THROTTLE_TTL) || 60,
        },
      ],
      setHeaders: true,
    }),
    AuthModule,
    UsersModule,
    FilesModule,
    AiModule,
    ExamsModule,
    FlashcardsModule,
    SubscriptionsModule,
    PaymentsModule,
    AnalyticsModule,
    AdminModule,
    StudyCoachModule,
    RecommendationModule,
    RagModule,
    LearningPathsModule,
    ProjectSubmissionsModule,
    CertificationsModule,
    GamificationModule,
    ChatModule,
    NotesModule,
    StudyGroupsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],

})
export class AppModule {}
