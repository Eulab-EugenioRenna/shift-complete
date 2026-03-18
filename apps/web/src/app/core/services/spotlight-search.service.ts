import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, map, of } from 'rxjs';
import { AppApiService } from '../../shared/services/app-api.service';
import { GlobalTeamScopeService } from './global-team-scope.service';
import { SessionService } from './session.service';

export type SpotlightItem = {
  id: string;
  title: string;
  subtitle: string;
  group: 'Eventi' | 'Risorse' | 'Inventario' | 'Persone' | 'Team' | 'Sostituzioni';
  action: () => Promise<boolean>;
};

@Injectable({ providedIn: 'root' })
export class SpotlightSearchService {
  private readonly api = inject(AppApiService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly teamScope = inject(GlobalTeamScopeService);

  private readonly openSignal = signal(false);
  private readonly querySignal = signal('');
  private readonly loadingSignal = signal(false);
  private readonly resultsSignal = signal<SpotlightItem[]>([]);

  readonly open = this.openSignal.asReadonly();
  readonly query = this.querySignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly results = this.resultsSignal.asReadonly();
  readonly activeIndex = signal(0);
  readonly groupedResults = computed(() => {
    const groups = new Map<string, SpotlightItem[]>();
    for (const item of this.resultsSignal()) {
      groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
    }
    return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
  });

  openSpotlight(): void {
    this.openSignal.set(true);
    this.activeIndex.set(0);
  }

  closeSpotlight(): void {
    this.openSignal.set(false);
    this.loadingSignal.set(false);
    this.querySignal.set('');
    this.resultsSignal.set([]);
    this.activeIndex.set(0);
  }

  setQuery(query: string): void {
    this.querySignal.set(query);
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) {
      this.resultsSignal.set([]);
      this.loadingSignal.set(false);
      this.activeIndex.set(0);
      return;
    }

    this.loadingSignal.set(true);
    forkJoin({
      events: this.api.events(),
      resources: this.api.resources(),
      inventory: this.canManageOperational() ? this.api.inventoryItems() : of([]),
      teams: this.canManageOperational() ? this.api.teams() : of([]),
      replacements: this.canManageOperational() ? this.api.replacements() : of([]),
      users: this.session.isAdministrator() ? this.api.managedUsers() : of([]),
    }).pipe(
      map((payload) => this.buildResults(normalized, payload))
    ).subscribe({
      next: (items) => {
        if (this.querySignal().trim().toLowerCase() !== normalized) {
          return;
        }
        this.resultsSignal.set(items.slice(0, 30));
        this.activeIndex.set(0);
        this.loadingSignal.set(false);
      },
      error: () => {
        this.resultsSignal.set([]);
        this.loadingSignal.set(false);
        this.activeIndex.set(0);
      }
    });
  }

  async activate(item: SpotlightItem): Promise<void> {
    await item.action();
    this.closeSpotlight();
  }

  activeItem(): SpotlightItem | null {
    return this.resultsSignal()[this.activeIndex()] ?? null;
  }

  moveActive(delta: number): void {
    const results = this.resultsSignal();
    if (!results.length) {
      this.activeIndex.set(0);
      return;
    }

    const next = (this.activeIndex() + delta + results.length) % results.length;
    this.activeIndex.set(next);
  }

  setActiveById(itemId: string): void {
    const index = this.resultsSignal().findIndex((item) => item.id === itemId);
    if (index >= 0) {
      this.activeIndex.set(index);
    }
  }

  private canManageOperational(): boolean {
    return this.session.hasAnyRole('administrator', 'service_leader');
  }

  private buildResults(query: string, payload: any): SpotlightItem[] {
    const items: SpotlightItem[] = [];
    const activeTeamId = this.teamScope.teamId();

    for (const event of payload.events ?? []) {
      if (!this.matchesQuery(query, [event.title, event.description, event.slots?.map((slot: any) => slot.teamName).join(' ')])) {
        continue;
      }
      if (activeTeamId && !(event.slots ?? []).some((slot: any) => slot.teamId === activeTeamId)) {
        continue;
      }
      items.push({
        id: `event:${event.id}`,
        title: event.title,
        subtitle: `${this.formatDateTime(event.startsAt)} · ${event.type}`,
        group: 'Eventi',
        action: () => this.router.navigate(['/events'], { queryParams: { eventId: event.id } }),
      });
    }

    for (const resource of payload.resources ?? []) {
      const teamId = resource.team?.id ?? 'global';
      if (activeTeamId && teamId !== activeTeamId) {
        continue;
      }
      if (!this.matchesQuery(query, [resource.name, resource.team?.name, resource.mimeType])) {
        continue;
      }
      items.push({
        id: `resource:${resource.id}`,
        title: resource.name,
        subtitle: `${resource.team?.name ?? 'Libreria globale'} · ${this.formatDateTime(resource.uploadedAt)}`,
        group: 'Risorse',
        action: () => this.router.navigate(['/resources'], { queryParams: { resourceId: resource.id, teamId: resource.team?.id ?? null, search: resource.name } }),
      });
    }

    for (const asset of payload.inventory ?? []) {
      if (activeTeamId && asset.team?.id !== activeTeamId) {
        continue;
      }
      if (!this.matchesQuery(query, [asset.name, asset.serialNumber, asset.team?.name])) {
        continue;
      }
      items.push({
        id: `inventory:${asset.id}`,
        title: asset.name,
        subtitle: `${asset.team?.name ?? 'Senza team'} · ${asset.serialNumber ?? asset.status}`,
        group: 'Inventario',
        action: () => this.router.navigate(['/inventory'], { queryParams: { itemId: asset.id, teamId: asset.team?.id ?? null, search: asset.name } }),
      });
    }

    for (const team of payload.teams ?? []) {
      if (activeTeamId && team.id !== activeTeamId) {
        continue;
      }
      if (!this.matchesQuery(query, [team.name, team.description])) {
        continue;
      }
      items.push({
        id: `team:${team.id}`,
        title: team.name,
        subtitle: team.description ?? 'Workspace team',
        group: 'Team',
        action: () => this.router.navigate(['/teams'], { queryParams: { teamId: team.id } }),
      });
    }

    for (const replacement of payload.replacements ?? []) {
      if (activeTeamId && replacement.assignment?.slot?.team?.id !== activeTeamId) {
        continue;
      }
      if (!this.matchesQuery(query, [replacement.assignment?.slot?.event?.title, replacement.assignment?.slot?.team?.name, replacement.requestedBy?.fullName, replacement.replacementAssignee?.fullName])) {
        continue;
      }
      items.push({
        id: `replacement:${replacement.id}`,
        title: replacement.assignment?.slot?.event?.title ?? 'Sostituzione',
        subtitle: `${replacement.assignment?.slot?.team?.name ?? '-'} · ${replacement.status} · ${this.formatDateTime(replacement.createdAt)}`,
        group: 'Sostituzioni',
        action: () => this.router.navigate(['/replacements'], { queryParams: { replacementId: replacement.id } }),
      });
    }

    for (const user of payload.users ?? []) {
      if (activeTeamId && !(user.activeTeamIds ?? []).includes(activeTeamId)) {
        continue;
      }
      if (!this.matchesQuery(query, [user.fullName, user.email, user.phone])) {
        continue;
      }
      items.push({
        id: `user:${user.id}`,
        title: user.fullName,
        subtitle: `${user.email} · ${user.role}`,
        group: 'Persone',
        action: () => this.router.navigate(['/admin/users', user.id]),
      });
    }

    return items;
  }

  private matchesQuery(query: string, values: Array<string | null | undefined>): boolean {
    return values.some((value) => (value ?? '').toLowerCase().includes(query));
  }

  private formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return 'Data non disponibile';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
}
