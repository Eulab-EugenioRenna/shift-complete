import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { TeamsModule } from '../modules/teams/teams.module';
import { EventsModule } from '../modules/events/events.module';
import { SchedulingModule } from '../modules/scheduling/scheduling.module';
import { InventoryModule } from '../modules/inventory/inventory.module';
import { ResourcesModule } from '../modules/resources/resources.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { RealtimeModule } from '../modules/realtime/realtime.module';
import { LoggingModule } from '../modules/logging/logging.module';
import { AiSettingsModule } from '../modules/ai-settings/ai-settings.module';
import { ExportsModule } from '../modules/exports/exports.module';
import { DatabaseModule } from '../database/database.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me',
      signOptions: { expiresIn: '12h' }
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    TeamsModule,
    EventsModule,
    SchedulingModule,
    InventoryModule,
    ResourcesModule,
    NotificationsModule,
    RealtimeModule,
    LoggingModule,
    AiSettingsModule,
    ExportsModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, jwtService: JwtService) => new JwtAuthGuard(reflector, jwtService),
      inject: [Reflector, JwtService]
    },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new RolesGuard(reflector),
      inject: [Reflector]
    }
  ]
})
export class AppModule {}
