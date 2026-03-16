import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiErrorService } from '../../core/services/api-error.service';
import { ResourceTransferQueueService } from '../../core/services/resource-transfer-queue.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { AppApiService } from '../../shared/services/app-api.service';

type ResourceItem = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  team?: { id: string; name: string } | null;
};

@Component({
  selector: 'app-resources-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="mx-auto flex max-w-7xl flex-col gap-6">
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-widest text-orange-500">File Manager</p>
          <h2 class="mt-1 text-2xl font-semibold tracking-tight text-slate-800">Repository documentale diviso per team con code upload e download asincrone.</h2>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" [(ngModel)]="uploadTeamId">
            <option value="">{{ canManageGlobal() ? 'Libreria globale' : 'Seleziona team' }}</option>
            <option *ngFor="let team of teamOptions()" [value]="team.id">{{ team.name }}</option>
          </select>
          <label class="cursor-pointer rounded-md bg-[#4979e6] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700">
            <i class="pi pi-upload mr-2 text-xs"></i> Carica file
            <input type="file" multiple class="hidden" (change)="onFileSelect($event)" />
          </label>
        </div>
      </header>

      <div class="grid gap-4 xl:grid-cols-[1.65fr_0.85fr]">
        <div class="flex flex-col gap-4">
          <div class="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div class="relative min-w-52 flex-1">
                  <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
                  <input class="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-sm" [(ngModel)]="searchQuery" placeholder="Cerca file..." />
                </div>
                <p class="text-xs text-slate-500">{{ filteredResources().length }} file visibili</p>
              </div>

              <div class="flex items-center gap-2 flex-wrap" *ngIf="filterOptions().length">
                <span class="mr-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Team:</span>
                <button *ngFor="let option of filterOptions()" type="button"
                  class="px-3 py-1.5 rounded-full text-sm font-medium border transition"
                  [class.bg-[#4979e6]]="filterTeamId === option.id"
                  [class.text-white]="filterTeamId === option.id"
                  [class.border-[#4979e6]]="filterTeamId === option.id"
                  [class.bg-white]="filterTeamId !== option.id"
                  [class.text-slate-700]="filterTeamId !== option.id"
                  [class.border-slate-300]="filterTeamId !== option.id"
                  [class.hover:bg-slate-50]="filterTeamId !== option.id"
                  (click)="filterTeamId = option.id">
                  {{ option.name }}
                </button>
                <button *ngIf="filterTeamId" type="button" class="ml-auto text-xs text-slate-400 hover:text-slate-600 transition" (click)="filterTeamId = ''">
                  <i class="pi pi-times mr-1"></i>Deseleziona
                </button>
              </div>
            </div>
          </div>

          <div class="grid gap-4" *ngIf="groupedResources().length; else noFiles">
            <article *ngFor="let group of groupedResources()" class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div class="border-b border-slate-100 px-5 py-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <h3 class="text-base font-semibold text-slate-900">{{ group.label }}</h3>
                    <p class="mt-1 text-sm text-slate-500">{{ group.items.length }} documenti disponibili</p>
                  </div>
                  <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">{{ group.items.length }}</span>
                </div>
              </div>
              <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                  <thead class="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th class="px-5 py-3">Nome</th>
                      <th class="px-5 py-3">Tipo</th>
                      <th class="px-5 py-3">Dimensione</th>
                      <th class="px-5 py-3">Aggiornato</th>
                      <th class="px-5 py-3 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let resource of group.items" class="border-t border-slate-100">
                      <td class="px-5 py-3">
                        <div class="flex items-center gap-3">
                          <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-[#4979e6]">
                            <i class="text-sm" [class]="fileIcon(resource.mimeType)"></i>
                          </div>
                          <div>
                            <p *ngIf="renamingId() !== resource.id" class="font-medium text-slate-900">{{ resource.name }}</p>
                            <input *ngIf="renamingId() === resource.id" class="rounded-md border border-[#4979e6] px-2 py-1 text-sm" [(ngModel)]="renameValue" (blur)="confirmRename(resource)" (keydown.enter)="confirmRename(resource)" (keydown.escape)="cancelRename()" />
                            <p class="mt-0.5 text-xs text-slate-400">{{ group.label }}</p>
                          </div>
                        </div>
                      </td>
                      <td class="px-5 py-3 text-xs font-mono text-slate-500">{{ resource.mimeType || 'n/a' }}</td>
                      <td class="px-5 py-3 text-slate-500">{{ formatSize(resource.sizeBytes) }}</td>
                      <td class="px-5 py-3 text-slate-500">{{ resource.uploadedAt | date:'short' }}</td>
                      <td class="px-5 py-3 text-right">
                        <div class="flex items-center justify-end gap-3">
                          <button type="button" class="text-sm text-[#4979e6] hover:underline" (click)="queueDownload(resource)">Scarica</button>
                          <button type="button" class="text-sm text-slate-600 hover:underline" (click)="startRename(resource)">Rinomina</button>
                          <button type="button" class="text-sm text-red-600 hover:underline" (click)="deleteResource(resource.id)">Elimina</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </div>
          <ng-template #noFiles>
            <div class="rounded-lg border border-slate-200 bg-white px-5 py-16 text-center text-slate-400 shadow-sm">
              <i class="pi pi-folder-open mb-3 block text-4xl opacity-40"></i>
              <p class="text-sm">Nessun file disponibile per il filtro selezionato.</p>
            </div>
          </ng-template>
        </div>

        <aside class="flex flex-col gap-4">
          <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div class="border-b border-slate-100 px-5 py-4">
              <h3 class="text-base font-semibold text-slate-900">Queue trasferimenti</h3>
              <p class="mt-1 text-sm text-slate-500">Job backend distribuiti con progress realtime e recupero stato multiistanza.</p>
            </div>
            <div class="divide-y divide-slate-100">
              <div *ngFor="let item of transferQueue.items()" class="px-5 py-4">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium text-slate-900">{{ item.name }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ item.kind === 'upload' ? 'Upload' : 'Download' }} · {{ teamLabel(item.teamId) }}</p>
                  </div>
                  <button type="button" class="text-slate-400 hover:text-slate-700" (click)="transferQueue.dismiss(item.id)" *ngIf="item.status !== 'running'">
                    <i class="pi pi-times text-xs"></i>
                  </button>
                </div>
                <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div class="h-full rounded-full transition-all"
                    [class.bg-[#4979e6]]="item.status === 'running'"
                    [class.bg-emerald-500]="item.status === 'completed'"
                    [class.bg-red-500]="item.status === 'failed'"
                    [style.width.%]="item.status === 'failed' ? 100 : item.progress"></div>
                </div>
                <p class="mt-2 text-xs"
                  [class.text-slate-500]="item.status === 'queued' || item.status === 'running'"
                  [class.text-emerald-600]="item.status === 'completed'"
                  [class.text-red-600]="item.status === 'failed'">
                  {{ transferStatusLabel(item) }}
                </p>
              </div>
              <div *ngIf="!transferQueue.items().length" class="px-5 py-10 text-center text-sm text-slate-400">Nessun trasferimento in coda.</div>
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-widest text-slate-400">Team visibili</p>
            <div class="mt-4 grid gap-2">
              <div *ngFor="let team of visibleGroups()" class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span class="text-sm text-slate-700">{{ team.label }}</span>
                <span class="text-xs font-medium text-slate-500">{{ team.count }}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  `
})
export class ResourcesPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  protected readonly transferQueue = inject(ResourceTransferQueueService);

  protected readonly resources = signal<ResourceItem[]>([]);
  protected readonly teams = signal<Array<{ id: string; name: string }>>([]);
  protected readonly renamingId = signal<string | null>(null);
  protected searchQuery = '';
  protected filterTeamId = '';
  protected uploadTeamId = '';
  protected renameValue = '';

  protected readonly teamOptions = computed(() => this.teams());
  protected readonly filterOptions = computed(() => [{ id: '', name: 'Tutti' }, ...this.teams()]);
  protected readonly filteredResources = computed(() => {
    const query = this.searchQuery.trim().toLowerCase();
    return this.resources().filter((resource) => {
      const nameMatch = !query || resource.name.toLowerCase().includes(query);
      const teamKey = resource.team?.id ?? 'global';
      const teamMatch = !this.filterTeamId || this.filterTeamId === teamKey;
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
  private lastCompletedUploads = 0;

  constructor() {
    this.loadContext();
    effect(() => {
      const completedUploads = this.transferQueue.items().filter((item) => item.kind === 'upload' && item.status === 'completed').length;
      if (completedUploads > this.lastCompletedUploads) {
        this.loadResources();
      }
      this.lastCompletedUploads = completedUploads;
    });
  }

  protected onFileSelect(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (!files.length) {
      return;
    }

    this.transferQueue.enqueueUploads(files, this.uploadTeamId || undefined);
    this.feedback.success('Upload accodato', `${files.length} file inseriti nella coda trasferimenti.`);
    (event.target as HTMLInputElement).value = '';
  }

  protected queueDownload(resource: ResourceItem): void {
    this.transferQueue.enqueueDownload(resource);
    this.feedback.info('Download accodato', `Preparazione download per ${resource.name}.`);
  }

  protected startRename(resource: ResourceItem): void {
    this.renamingId.set(resource.id);
    this.renameValue = resource.name;
  }

  protected cancelRename(): void {
    this.renamingId.set(null);
    this.renameValue = '';
  }

  protected confirmRename(resource: ResourceItem): void {
    const nextName = this.renameValue.trim();
    if (!nextName || nextName === resource.name) {
      this.cancelRename();
      return;
    }

    this.api.renameResource(resource.id, nextName).subscribe({
      next: () => {
        this.cancelRename();
        this.loadResources();
        this.feedback.success('File rinominato', `${resource.name} e ora ${nextName}.`);
      },
      error: (error) => {
        this.cancelRename();
        this.feedback.error('Rinomina non riuscita', this.apiError.message(error, 'Impossibile rinominare il file.'));
      }
    });
  }

  protected deleteResource(id: string): void {
    this.api.deleteResource(id).subscribe({
      next: () => {
        this.loadResources();
        this.feedback.success('File eliminato');
      },
      error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare il file.'))
    });
  }

  protected canManageGlobal(): boolean {
    return this.teams().length > 1 || this.teams().length === 0;
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

  private loadResources(): void {
    this.api.resources().subscribe({
      next: (resources) => this.resources.set(resources),
      error: (error) => this.feedback.error('Risorse non caricate', this.apiError.message(error, 'Impossibile recuperare le risorse.'))
    });
  }
}
