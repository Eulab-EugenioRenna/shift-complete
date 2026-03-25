import { Injectable } from '@nestjs/common';
import { toJsonValue } from '../../common/utils/json.util';
import { PrismaService } from '../../database/prisma.service';
import { SyncHolidayCalendarDto, UpsertPreferenceCatalogItemDto } from '@shift-complete/shared-types';
import { DomainSyncService } from '../domain-sync/domain-sync.service';
import { USER_PREFERENCE_CATALOG } from '../users/user-preference-catalog';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainSync: DomainSyncService,
  ) {}

  async bootstrapDefaults() {
    const items = [
      ...USER_PREFERENCE_CATALOG.shifts.map((item) => ({ ...item, type: 'shift' })),
      ...USER_PREFERENCE_CATALOG.competencies.map((item) => ({ ...item, type: 'competency' })),
      ...USER_PREFERENCE_CATALOG.locations.map((item) => ({ ...item, type: 'location' })),
    ];

    await Promise.all(items.map((item) =>
      (this.prisma as any).userPreferenceCatalogItem.upsert({
        where: { type_value: { type: item.type, value: item.value } },
        update: {
          label: item.label,
          description: item.description,
          keywords: toJsonValue(item.keywords),
          active: true,
          sortOrder: item.sortOrder,
        },
        create: {
          type: item.type,
          value: item.value,
          label: item.label,
          description: item.description,
          keywords: toJsonValue(item.keywords),
          active: true,
          sortOrder: item.sortOrder,
        },
      })
    ));
  }

  listCatalog(type?: string) {
    return (this.prisma as any).userPreferenceCatalogItem.findMany({
      where: { type: type ?? undefined },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async upsertCatalogItem(payload: UpsertPreferenceCatalogItemDto) {
    const item = await (this.prisma as any).userPreferenceCatalogItem.upsert({
      where: { type_value: { type: payload.type, value: payload.value } },
      update: {
        label: payload.label,
        description: payload.description,
        keywords: toJsonValue(payload.keywords ?? []),
        active: payload.active ?? true,
        sortOrder: payload.sortOrder ?? 0,
      },
      create: {
        type: payload.type,
        value: payload.value,
        label: payload.label,
        description: payload.description,
        keywords: toJsonValue(payload.keywords ?? []),
        active: payload.active ?? true,
        sortOrder: payload.sortOrder ?? 0,
      },
    });

    await this.domainSync.syncPlanningContextMutation({
      action: 'catalog.preference.upserted',
      entityId: item.id,
      reason: `catalog-${payload.type}-updated`,
    });

    return item;
  }

  async removeCatalogItem(id: string) {
    const item = await (this.prisma as any).userPreferenceCatalogItem.delete({ where: { id } });
    await this.domainSync.syncPlanningContextMutation({
      action: 'catalog.preference.deleted',
      entityId: id,
      reason: `catalog-${item.type}-deleted`,
    });

    return item;
  }

  async listHolidays() {
    return (this.prisma as any).holidayCalendarDay.findMany({ orderBy: { date: 'asc' } });
  }

  async syncItalianHolidays(payload: SyncHolidayCalendarDto) {
    const synced: any[] = [];
    for (const year of payload.years) {
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/IT`);
      const items = await response.json() as Array<{ date: string; localName: string; name: string }>;
      for (const item of items) {
        const saved = await (this.prisma as any).holidayCalendarDay.upsert({
          where: { date: new Date(item.date) },
          update: {
            localName: item.localName,
            name: item.name,
            isPublicHoliday: true,
            source: 'nager',
          },
          create: {
            date: new Date(item.date),
            countryCode: 'IT',
            localName: item.localName,
            name: item.name,
            isPublicHoliday: true,
            source: 'nager',
          },
        });
        synced.push(saved);
      }
    }

    await this.domainSync.syncPlanningContextMutation({
      action: 'holiday.calendar.synced',
      entityId: payload.years.join(','),
      reason: 'holiday-calendar-synced',
    });

    return synced;
  }
}
