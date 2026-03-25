import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { DomainSyncModule } from '../domain-sync/domain-sync.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [NotificationsModule, CatalogModule, DomainSyncModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
