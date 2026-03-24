import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButtonComponent, UiConfirmDialogComponent, UiLabelComponent, UiPageHeaderComponent, UiSelectComponent, UiStatCardComponent, UiSurfaceComponent } from '@shift-complete/ui-kit';
import { ApiErrorService } from '../../core/services/api-error.service';
import { GlobalTeamScopeService } from '../../core/services/global-team-scope.service';
import { ResourceTransferQueueService } from '../../core/services/resource-transfer-queue.service';
import { SpotlightSearchService } from '../../core/services/spotlight-search.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { TeamScopeChipsComponent } from '../../shared/components/team-scope-chips.component';
import { AppApiService } from '../../shared/services/app-api.service';
import { SessionService } from '../../core/services/session.service';

type ResourceItem = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  path?: string;
  team?: { id: string; name: string } | null;
};

type ResourceSummary = {
  totalUsedBytes: number;
  totalLimitBytes: number | null;
  totalAvailableBytes: number | null;
  totalFileCount: number;
  totalFolderCount: number;
  teamCount: number;
  teams: Array<{
    teamId: string | null;
    label: string;
    fileCount: number;
    folderCount: number;
    usedBytes: number;
    limitBytes: number | null;
    availableBytes: number | null;
    usageRatio: number | null;
    isGlobal: boolean;
  }>;
};

@Component({
  selector: 'app-resources-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UiButtonComponent, UiConfirmDialogComponent, UiLabelComponent, UiPageHeaderComponent, UiSelectComponent, UiStatCardComponent, UiSurfaceComponent, TeamScopeChipsComponent],
  templateUrl: './resources-page.component.html',
  styles: [`
    :host ::ng-deep .resource-row-highlight {
      animation: resourceRowHighlight 2.2s ease-out;
    }

    @keyframes resourceRowHighlight {
      0% {
        box-shadow: inset 0 0 0 999px rgba(251, 191, 36, 0.34);
      }
      45% {
        box-shadow: inset 0 0 0 999px rgba(251, 191, 36, 0.2);
      }
      100% {
        box-shadow: inset 0 0 0 999px rgba(251, 191, 36, 0);
      }
    }
  `],
})
export class ResourcesPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  protected readonly spotlight = inject(SpotlightSearchService);
  protected readonly teamScope = inject(GlobalTeamScopeService);
  protected readonly transferQueue = inject(ResourceTransferQueueService);

  protected readonly resources = signal<ResourceItem[]>([]);
  protected readonly teams = signal<Array<{ id: string; name: string }>>([]);
  protected readonly renamingId = signal<string | null>(null);
  protected searchQuery = '';
  protected uploadTeamId = '';
  protected renameValue = '';
  protected readonly selectedResource = signal<ResourceItem | null>(null);
  protected readonly highlightedResourceId = signal<string | null>(null);
  protected readonly summary = signal<ResourceSummary | null>(null);
  protected readonly confirmVisible = signal(false);
  protected readonly pendingDelete = signal<ResourceItem | null>(null);
  private highlightResetTimer?: ReturnType<typeof setTimeout>;

  protected readonly teamOptions = computed(() => this.teams());
  protected readonly uploadTeamOptions = computed(() => [
    { label: this.canManageGlobal() ? 'Libreria globale' : 'Seleziona team', value: '' },
    ...this.teamOptions(),
  ]);
  protected readonly canManageResources = computed(() => this.session.hasAnyRole('administrator', 'service_leader'));
  protected readonly filteredResources = computed(() => {
    const query = this.searchQuery.trim().toLowerCase();
    return this.resources().filter((resource) => {
      const nameMatch = !query || resource.name.toLowerCase().includes(query);
      const teamKey = resource.team?.id ?? 'global';
      const scopedTeamId = this.teamScope.teamId();
      const teamMatch = !scopedTeamId || scopedTeamId === teamKey;
      return nameMatch && teamMatch;
    });
  });

  protected readonly groupedResources = computed(() => {
    const groups = new Map<string, { label: string; items: ResourceItem[] }>();
    for (const resource of this.filteredResources()) {
      const key = resource.team?.id ?? 'global';
      const label = resource.team?.name ?? 'Libreria globale';
      if (!groups.has(key)) {
        groups.set(key, { label, items: [] });
      }
      groups.get(key)?.items.push(resource);
    }
    return Array.from(groups.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  protected readonly visibleGroups = computed(() =>
    this.groupedResources().map((group) => ({ label: group.label, count: group.items.length }))
  );
  protected readonly resourceFolders = computed(() => {
    return this.groupedResources().map((group) => ({
      label: group.label,
      count: group.items.length,
      access: group.key === 'global' ? 'Globale' : 'Team',
      writable: group.key === 'global' ? this.session.isAdministrator() : this.canManageResources(),
    }));
  });
  protected readonly summaryCards = computed(() => {
    const summary = this.summary();
    if (!summary) {
      return [];
    }

    return [
      {
        label: 'Spazio occupato',
        value: this.formatSize(summary.totalUsedBytes),
        detail: summary.totalLimitBytes === null
          ? 'Capienza totale illimitata'
          : `${this.totalUsagePercent(summary)}% del totale`,
        tone: 'amber'
      },
      {
        label: 'Spazio disponibile',
        value: summary.totalAvailableBytes === null ? 'Illimitato' : this.formatSize(summary.totalAvailableBytes),
        detail: summary.totalLimitBytes === null ? 'Nessun tetto globale' : `Limite ${this.formatSize(summary.totalLimitBytes)}`,
        tone: 'emerald'
      },
      {
        label: 'Numero file',
        value: `${summary.totalFileCount}`,
        detail: `${summary.teamCount} team monitorati`,
        tone: 'blue'
      },
      {
        label: 'Cartelle',
        value: `${summary.totalFolderCount}`,
        detail: 'Global + cartelle team visibili',
        tone: 'slate'
      },
    ];
  });
  constructor() {
    this.loadContext();
    this.route.queryParamMap.subscribe((params) => {
      const teamId = params.get('teamId');
      const search = params.get('search');
      const resourceId = params.get('resourceId');
      if (teamId) {
        this.teamScope.setTeam(teamId);
      }
      this.searchQuery = search ?? '';
      if (resourceId) {
        const selected = this.resources().find((resource) => resource.id === resourceId) ?? null;
        this.selectedResource.set(selected);
      }
    });
    effect(() => {
      const completedUpload = this.transferQueue.lastCompletedUpload();
      if (completedUpload) {
        this.loadResources(completedUpload.resourceId ?? this.selectedResource()?.id ?? undefined);
      }
    });
  }

  protected onFileSelect(event: Event): void {
    if (!this.canManageResources()) {
      return;
    }
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (!files.length) {
      return;
    }

    this.transferQueue.enqueueUploads(files, this.uploadTeamId || undefined);
    this.feedback.success('Upload accodato', `${files.length} file inseriti nella coda trasferimenti.`);
    (event.target as HTMLInputElement).value = '';
  }

  protected queueDownload(resource: ResourceItem): void {
    this.selectedResource.set(resource);
    this.transferQueue.enqueueDownload(resource);
    this.feedback.info('Download accodato', `Preparazione download per ${resource.name}.`);
  }

  protected openSpotlight(): void {
    this.spotlight.openSpotlight();
  }

  protected focusResource(resource: ResourceItem): void {
    this.selectedResource.set(resource);
    void this.router.navigate([], { queryParams: { resourceId: resource.id }, queryParamsHandling: 'merge' });
  }

  protected startRename(resource: ResourceItem): void {
    if (!this.canManageResources()) {
      return;
    }
    this.renamingId.set(resource.id);
    this.renameValue = resource.name;
  }

  protected cancelRename(): void {
    this.renamingId.set(null);
    this.renameValue = '';
  }

  protected confirmRename(resource: ResourceItem): void {
    if (!this.canManageResources()) {
      return;
    }
    const nextName = this.renameValue.trim();
    if (!nextName || nextName === resource.name) {
      this.cancelRename();
      return;
    }

    this.api.renameResource(resource.id, nextName).subscribe({
      next: (updated) => {
        this.cancelRename();
        this.loadResources(updated.id);
        this.feedback.success('File rinominato', `${resource.name} e ora ${nextName}.`);
      },
      error: (error) => {
        this.cancelRename();
        this.feedback.error('Rinomina non riuscita', this.apiError.message(error, 'Impossibile rinominare il file.'));
      }
    });
  }

  protected deleteResource(id: string): void {
    if (!this.canManageResources()) {
      return;
    }

    this.pendingDelete.set(this.resources().find((resource) => resource.id === id) ?? null);
    this.confirmVisible.set(true);
  }

  protected confirmDeleteResource(): void {
    const pending = this.pendingDelete();
    if (!pending) {
      return;
    }

    this.api.deleteResource(pending.id).subscribe({
      next: () => {
        const nextSelectedId = this.selectedResource()?.id === pending.id ? undefined : this.selectedResource()?.id;
        if (this.selectedResource()?.id === pending.id) {
          this.selectedResource.set(null);
        }
        this.closeDeleteConfirm();
        this.loadResources(nextSelectedId);
        this.feedback.success('File eliminato');
      },
      error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare il file.'))
    });
  }

  protected closeDeleteConfirm(): void {
    this.confirmVisible.set(false);
    this.pendingDelete.set(null);
  }

  protected canManageGlobal(): boolean {
    return this.teams().length > 1 || this.teams().length === 0;
  }

  protected selectResource(resource: ResourceItem): void {
    this.selectedResource.set(resource);
  }

  protected resourceFolder(resource: ResourceItem): string {
    if (!resource.path) {
      return resource.team?.name || 'global';
    }

    const normalized = resource.path.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    return segments.length > 1 ? segments[segments.length - 2] : (resource.team?.name || 'global');
  }

  protected teamLabel(teamId?: string | null): string {
    if (!teamId) {
      return 'Libreria globale';
    }
    return this.teams().find((team) => team.id === teamId)?.name ?? 'Team';
  }

  protected transferStatusLabel(item: { status: string; progress: number; error?: string }): string {
    if (item.status === 'failed') {
      return item.error ?? 'Trasferimento fallito';
    }
    if (item.status === 'completed') {
      return 'Completato';
    }
    if (item.status === 'queued') {
      return 'In attesa in coda';
    }
    return `${item.progress}% completato`;
  }

  protected fileIcon(mimeType: string): string {
    if (!mimeType) return 'pi pi-file';
    if (mimeType.includes('pdf')) return 'pi pi-file-pdf';
    if (mimeType.includes('image')) return 'pi pi-image';
    if (mimeType.includes('video')) return 'pi pi-video';
    if (mimeType.includes('audio')) return 'pi pi-volume-up';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'pi pi-file-word';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'pi pi-file-excel';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'pi pi-file-import';
    return 'pi pi-file';
  }

  protected formatSize(bytes: number): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected usageStatus(ratio: number | null | undefined): 'neutral' | 'healthy' | 'warning' | 'critical' {
    if (ratio === null || ratio === undefined) {
      return 'neutral';
    }
    if (ratio >= 0.95) {
      return 'critical';
    }
    if (ratio >= 0.8) {
      return 'warning';
    }
    return 'healthy';
  }

  protected usageLabel(ratio: number | null | undefined): string {
    const status = this.usageStatus(ratio);
    if (status === 'critical') {
      return 'Soglia critica';
    }
    if (status === 'warning') {
      return 'Vicino al limite';
    }
    if (status === 'healthy') {
      return 'Capacita OK';
    }
    return 'Nessun limite';
  }

  protected totalUsagePercent(summary: ResourceSummary): number {
    if (!summary.totalLimitBytes || summary.totalLimitBytes <= 0) {
      return 0;
    }
    return Math.min(Math.round((summary.totalUsedBytes / summary.totalLimitBytes) * 100), 100);
  }

  protected teamLimitLabel(limitBytes: number | null | undefined): string {
    return limitBytes === null || limitBytes === undefined ? 'Limite non impostato' : `Limite ${this.formatSize(limitBytes)}`;
  }

  private loadContext() {
    this.api.teams().subscribe({
      next: (teams) => {
        this.teams.set(teams.map((team) => ({ id: team.id, name: team.name })));
        if (!this.uploadTeamId && teams.length === 1) {
          this.uploadTeamId = teams[0].id;
        }
      }
    });
    this.loadResources();
  }

  private loadResources(preferredResourceId?: string): void {
    this.api.resources().subscribe({
      next: (resources) => {
        this.resources.set(resources);
        const resourceId = preferredResourceId ?? this.route.snapshot.queryParamMap.get('resourceId');
        if (resourceId) {
          const selected = resources.find((resource) => resource.id === resourceId) ?? null;
          this.selectedResource.set(selected);
          if (selected) {
            void this.router.navigate([], { queryParams: { resourceId: selected.id }, queryParamsHandling: 'merge' });
            this.focusResourceRow(selected.id);
          } else if (this.route.snapshot.queryParamMap.get('resourceId')) {
            void this.router.navigate([], { queryParams: { resourceId: null }, queryParamsHandling: 'merge' });
          }
          return;
        }

        const selectedId = this.selectedResource()?.id;
        this.selectedResource.set(selectedId ? resources.find((resource) => resource.id === selectedId) ?? null : null);
      },
      error: (error) => this.feedback.error('Risorse non caricate', this.apiError.message(error, 'Impossibile recuperare le risorse.'))
    });
    this.api.resourceSummary().subscribe({
      next: (summary) => this.summary.set(summary),
      error: (error) => this.feedback.error('Statistiche risorse non caricate', this.apiError.message(error, 'Impossibile recuperare i contatori risorse.'))
    });
  }

  private focusResourceRow(resourceId: string): void {
    this.highlightedResourceId.set(resourceId);
    if (this.highlightResetTimer) {
      clearTimeout(this.highlightResetTimer);
    }
    this.highlightResetTimer = setTimeout(() => this.highlightedResourceId.set(null), 2200);

    if (typeof document === 'undefined') {
      return;
    }

    setTimeout(() => {
      const row = document.querySelector(`[data-resource-id="${resourceId}"]`);
      if (row instanceof HTMLElement) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
}
