import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { UiDatePickerComponent } from '@shift-complete/ui-kit';
import { ApiErrorService } from '../../core/services/api-error.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { fromIsoDateOnly, toIsoDateOnly } from '../../core/utils/date-picker.util';
import { AppApiService } from '../../shared/services/app-api.service';
import { SessionService } from '../../core/services/session.service';

type InventoryItem = {
  id: string;
  name: string;
  serialNumber?: string | null;
  status: string;
  maintenanceDueAt?: string | null;
  team?: { id: string; name: string } | null;
};

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TagModule, UiDatePickerComponent],
  template: `
    <section class="mx-auto flex max-w-7xl flex-col gap-6">
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-widest text-teal-600">Inventario</p>
          <h2 class="mt-1 text-2xl font-semibold tracking-tight text-slate-800">Asset e manutenzioni organizzati per team operativo.</h2>
        </div>
        <div class="flex items-center gap-2" *ngIf="canManage()">
          <select class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" [(ngModel)]="form.teamId">
            <option value="">Seleziona team</option>
            <option *ngFor="let team of teamOptions()" [value]="team.id">{{ team.name }}</option>
          </select>
          <button class="rounded-md bg-[#4979e6] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700" (click)="openForm()">
            <i class="pi pi-plus mr-2 text-xs"></i>Aggiungi asset
          </button>
        </div>
      </header>

      <div class="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div class="relative min-w-52 flex-1">
              <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
              <input class="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-sm" [(ngModel)]="searchQuery" placeholder="Cerca asset o seriale..." />
            </div>
            <p class="text-xs text-slate-500">{{ filteredItems().length }} asset visibili</p>
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

      <div class="overflow-hidden rounded-lg border border-[#4979e6] bg-white shadow-sm" *ngIf="formOpen() && canManage()">
        <div class="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h3 class="text-base font-semibold text-slate-800">{{ editingId() ? 'Modifica asset' : 'Nuovo asset' }}</h3>
          <button class="text-slate-400 hover:text-slate-600" (click)="formOpen.set(false)"><i class="pi pi-times"></i></button>
        </div>
        <div class="grid gap-4 px-5 py-4 md:grid-cols-2 lg:grid-cols-5">
          <div class="grid gap-1">
            <label class="text-xs font-medium text-slate-600">Team *</label>
            <select class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" [(ngModel)]="form.teamId">
              <option value="">Seleziona team</option>
              <option *ngFor="let team of teamOptions()" [value]="team.id">{{ team.name }}</option>
            </select>
          </div>
          <div class="grid gap-1">
            <label class="text-xs font-medium text-slate-600">Nome *</label>
            <input class="rounded-md border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="form.name" placeholder="Es. Radio portatile" />
          </div>
          <div class="grid gap-1">
            <label class="text-xs font-medium text-slate-600">Numero seriale</label>
            <input class="rounded-md border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="form.serialNumber" placeholder="Es. RAD-001" />
          </div>
          <div class="grid gap-1">
            <label class="text-xs font-medium text-slate-600">Stato</label>
            <select class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" [(ngModel)]="form.status">
              <option value="available">Disponibile</option>
              <option value="checked_out">In prestito</option>
              <option value="maintenance">In manutenzione</option>
            </select>
          </div>
          <div class="grid gap-1">
            <ui-date-picker label="Manutenzione entro" [(value)]="form.maintenanceDueAt" dateFormat="dd/mm/yy" [baseZIndex]="1400" inputStyleClass="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"></ui-date-picker>
          </div>
        </div>
        <div class="px-5 pb-4 flex items-center gap-3">
          <button class="rounded-md bg-[#4979e6] px-4 py-2 text-sm font-medium text-white disabled:opacity-60" (click)="saveItem()" [disabled]="!canSaveItem() || saving()">{{ saving() ? 'Salvo...' : editingId() ? 'Salva modifiche' : 'Crea asset' }}</button>
          <button class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" (click)="formOpen.set(false)">Annulla</button>
        </div>
      </div>

      <div class="grid gap-4" *ngIf="groupedItems().length; else noItems">
        <article *ngFor="let group of groupedItems()" class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div class="border-b border-slate-100 px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold text-slate-900">{{ group.label }}</h3>
              <p class="mt-1 text-sm text-slate-500">{{ group.items.length }} asset in questo team</p>
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <span>{{ checkedOutCount(group.items) }} in prestito</span>
              <span>·</span>
              <span>{{ maintenanceCount(group.items) }} da revisionare</span>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th class="px-5 py-3">Nome</th>
                  <th class="px-5 py-3">Seriale</th>
                  <th class="px-5 py-3">Stato</th>
                  <th class="px-5 py-3">Manutenzione</th>
                  <th class="px-5 py-3 text-right" *ngIf="canManage()">Azioni</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of group.items" class="border-t border-slate-100">
                  <td class="px-5 py-3 font-medium text-slate-900">{{ item.name }}</td>
                  <td class="px-5 py-3 text-xs font-mono text-slate-500">{{ item.serialNumber || '—' }}</td>
                  <td class="px-5 py-3">
                    <p-tag [severity]="tagSeverity(item.status)" [value]="item.status"></p-tag>
                  </td>
                  <td class="px-5 py-3 text-slate-500">{{ item.maintenanceDueAt ? (item.maintenanceDueAt | date:'shortDate') : 'ok' }}</td>
                  <td class="px-5 py-3 text-right" *ngIf="canManage()">
                    <button class="mr-3 text-sm text-[#4979e6] hover:underline" (click)="editItem(item)">Modifica</button>
                    <button class="text-sm text-red-600 hover:underline" (click)="deleteItem(item.id)">Elimina</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
      <ng-template #noItems>
        <div class="rounded-lg border border-slate-200 bg-white px-5 py-16 text-center text-slate-400 shadow-sm">Nessun asset disponibile per il filtro selezionato.</div>
      </ng-template>
    </section>
  `
})
export class InventoryPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly session = inject(SessionService);

  protected readonly items = signal<InventoryItem[]>([]);
  protected readonly teams = signal<Array<{ id: string; name: string }>>([]);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected searchQuery = '';
  protected filterTeamId = '';
  protected form = this.emptyForm();

  protected readonly canManage = computed(() => {
    const role = this.session.getCurrentUser()?.role;
    return role === 'administrator' || role === 'service_leader';
  });
  protected readonly teamOptions = computed(() => this.teams());
  protected readonly filterOptions = computed(() => [{ id: '', name: 'Tutti' }, ...this.teams()]);
  protected readonly filteredItems = computed(() => {
    const query = this.searchQuery.trim().toLowerCase();
    return this.items().filter((item) => {
      const matchQuery = !query || item.name.toLowerCase().includes(query) || (item.serialNumber ?? '').toLowerCase().includes(query);
      const matchTeam = !this.filterTeamId || item.team?.id === this.filterTeamId;
      return matchQuery && matchTeam;
    });
  });
  protected readonly groupedItems = computed(() => {
    const groups = new Map<string, { label: string; items: InventoryItem[] }>();
    for (const item of this.filteredItems()) {
      const key = item.team?.id ?? 'unassigned';
      const label = item.team?.name ?? 'Senza team';
      if (!groups.has(key)) {
        groups.set(key, { label, items: [] });
      }
      groups.get(key)?.items.push(item);
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  });

  constructor() {
    this.loadContext();
  }

  protected openForm(): void {
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.formOpen.set(true);
  }

  protected editItem(item: InventoryItem): void {
    this.editingId.set(item.id);
    this.form = {
      teamId: item.team?.id ?? '',
      name: item.name ?? '',
      serialNumber: item.serialNumber ?? '',
      status: item.status ?? 'available',
      maintenanceDueAt: fromIsoDateOnly(item.maintenanceDueAt),
    };
    this.formOpen.set(true);
  }

  protected canSaveItem(): boolean {
    return Boolean(this.form.teamId && this.form.name.trim());
  }

  protected saveItem(): void {
    if (!this.canSaveItem()) {
      return;
    }

    this.saving.set(true);
    const payload = {
      teamId: this.form.teamId,
      name: this.form.name.trim(),
      serialNumber: this.form.serialNumber || undefined,
      status: this.form.status,
      maintenanceDueAt: toIsoDateOnly(this.form.maintenanceDueAt),
    };
    const wasEditing = Boolean(this.editingId());
    const req = wasEditing ? this.api.updateInventoryItem(this.editingId()!, payload) : this.api.createInventoryItem(payload);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.editingId.set(null);
        this.loadItems();
        this.feedback.success(wasEditing ? 'Asset aggiornato' : 'Asset creato');
      },
      error: (error) => {
        this.saving.set(false);
        this.feedback.error('Salvataggio non riuscito', this.apiError.message(error, 'Impossibile salvare l\'asset.'));
      }
    });
  }

  protected deleteItem(id: string): void {
    this.api.deleteInventoryItem(id).subscribe({
      next: () => {
        this.loadItems();
        this.feedback.success('Asset eliminato');
      },
      error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare l\'asset.'))
    });
  }

  protected checkedOutCount(items: InventoryItem[]): number {
    return items.filter((item) => item.status === 'checked_out').length;
  }

  protected maintenanceCount(items: InventoryItem[]): number {
    return items.filter((item) => item.status === 'maintenance' || item.maintenanceDueAt).length;
  }

  protected tagSeverity(status: string): 'success' | 'warn' | 'danger' | 'info' | undefined {
    if (status === 'available') return 'success';
    if (status === 'checked_out') return 'warn';
    if (status === 'maintenance') return 'danger';
    return 'info';
  }

  private emptyForm() {
    return {
      teamId: this.teams()[0]?.id ?? '',
      name: '',
      serialNumber: '',
      status: 'available',
      maintenanceDueAt: null as Date | null,
    };
  }

  private loadContext() {
    this.api.teams().subscribe({
      next: (teams) => {
        this.teams.set(teams.map((team) => ({ id: team.id, name: team.name })));
        if (!this.form.teamId && teams.length === 1) {
          this.form.teamId = teams[0].id;
        }
      }
    });
    this.loadItems();
  }

  private loadItems(): void {
    this.api.inventoryItems().subscribe({
      next: (items) => this.items.set(items),
      error: (error) => this.feedback.error('Inventario non caricato', this.apiError.message(error, 'Impossibile recuperare l\'inventario.'))
    });
  }
}
