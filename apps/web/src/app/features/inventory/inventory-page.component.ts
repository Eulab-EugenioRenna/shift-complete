import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { UiDatePickerComponent } from '@shift-complete/ui-kit';
import { ApiErrorService } from '../../core/services/api-error.service';
import { GlobalTeamScopeService } from '../../core/services/global-team-scope.service';
import { SpotlightSearchService } from '../../core/services/spotlight-search.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { fromIsoDateOnly, toIsoDateOnly } from '../../core/utils/date-picker.util';
import { TeamScopeChipsComponent } from '../../shared/components/team-scope-chips.component';
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
  imports: [CommonModule, FormsModule, TagModule, UiDatePickerComponent, TeamScopeChipsComponent],
  templateUrl: './inventory-page.component.html',
})
export class InventoryPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  protected readonly teamScope = inject(GlobalTeamScopeService);
  protected readonly spotlight = inject(SpotlightSearchService);

  protected readonly items = signal<InventoryItem[]>([]);
  protected readonly teams = signal<Array<{ id: string; name: string }>>([]);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected searchQuery = '';
  protected form = this.emptyForm();

  protected readonly canManage = computed(() => {
    const role = this.session.getCurrentUser()?.role;
    return role === 'administrator' || role === 'service_leader';
  });
  protected readonly teamOptions = computed(() => this.teams());
  protected readonly selectedItem = signal<InventoryItem | null>(null);
  protected readonly filteredItems = computed(() => {
    const query = this.searchQuery.trim().toLowerCase();
    return this.items().filter((item) => {
      const matchQuery = !query || item.name.toLowerCase().includes(query) || (item.serialNumber ?? '').toLowerCase().includes(query);
      const scopedTeamId = this.teamScope.teamId();
      const matchTeam = !scopedTeamId || item.team?.id === scopedTeamId;
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
    this.route.queryParamMap.subscribe((params) => {
      const teamId = params.get('teamId');
      const search = params.get('search');
      const itemId = params.get('itemId');
      if (teamId) {
        this.teamScope.setTeam(teamId);
      }
      this.searchQuery = search ?? '';
      if (itemId) {
        this.selectedItem.set(this.items().find((item) => item.id === itemId) ?? null);
      }
    });
  }

  protected openForm(): void {
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.formOpen.set(true);
  }

  protected editItem(item: InventoryItem): void {
    const maintenanceDate = fromIsoDateOnly(item.maintenanceDueAt);
    this.editingId.set(item.id);
    this.form = {
      teamId: item.team?.id ?? '',
      name: item.name ?? '',
      serialNumber: item.serialNumber ?? '',
      status: item.status ?? 'available',
      maintenanceDueAt: maintenanceDate,
    };
    this.formOpen.set(true);
  }

  protected canSaveItem(): boolean {
    return Boolean(this.form.teamId && this.form.name.trim());
  }

  protected openItemDetail(item: InventoryItem): void {
    this.selectedItem.set(item);
    void this.router.navigate([], { queryParams: { itemId: item.id }, queryParamsHandling: 'merge' });
  }

  protected openSpotlight(): void {
    this.spotlight.openSpotlight();
  }

  protected onMaintenanceDateChange(value: Date | null): void {
    this.form.maintenanceDueAt = value && !Number.isNaN(value.getTime()) ? value : null;
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

  protected statusLabel(status: string): string {
    if (status === 'available') return 'Disponibile';
    if (status === 'checked_out') return 'In prestito';
    if (status === 'maintenance') return 'In manutenzione';
    return status;
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
      next: (items) => {
        this.items.set(items);
        const itemId = this.route.snapshot.queryParamMap.get('itemId');
        if (itemId) {
          this.selectedItem.set(items.find((item) => item.id === itemId) ?? null);
        }
      },
      error: (error) => this.feedback.error('Inventario non caricato', this.apiError.message(error, 'Impossibile recuperare l\'inventario.'))
    });
  }
}
