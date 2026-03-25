import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButtonComponent, UiConfirmDialogComponent, UiDatePickerComponent, UiFieldComponent, UiInputComponent, UiLabelComponent, UiModalComponent, UiPageHeaderComponent, UiSelectComponent, UiSurfaceComponent } from '@shift-complete/ui-kit';
import { ApiErrorService } from '../../core/services/api-error.service';
import { GlobalTeamScopeService } from '../../core/services/global-team-scope.service';
import { SpotlightSearchService } from '../../core/services/spotlight-search.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { fromIsoDateOnly, toIsoDateOnly } from '../../core/utils/date-picker.util';
import { TeamScopeChipsComponent } from '../../shared/components/team-scope-chips.component';
import { ReportDocument, ReportModalComponent } from '../../shared/components/report-modal.component';
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
  imports: [CommonModule, FormsModule, UiButtonComponent, UiConfirmDialogComponent, UiDatePickerComponent, UiFieldComponent, UiInputComponent, UiLabelComponent, UiModalComponent, UiPageHeaderComponent, UiSelectComponent, UiSurfaceComponent, TeamScopeChipsComponent, ReportModalComponent],
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
  protected readonly teamSelectOptions = computed(() => this.teamOptions().map((team) => ({ label: team.name, value: team.id })));
  protected readonly statusOptions = [
    { label: 'Disponibile', value: 'available' },
    { label: 'In prestito', value: 'checked_out' },
    { label: 'In manutenzione', value: 'maintenance' },
  ];
  protected readonly selectedItem = signal<InventoryItem | null>(null);
  protected readonly confirmVisible = signal(false);
  protected readonly reportVisible = signal(false);
  protected readonly pendingDelete = signal<{ id: string; name: string } | null>(null);
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
  protected readonly inventoryReport = computed<ReportDocument>(() => {
    const items = this.filteredItems();
    const selectedTeamId = this.teamScope.teamId();
    const selectedTeam = this.teams().find((team) => team.id === selectedTeamId) ?? null;
    const maintenanceItems = items.filter((item) => item.status === 'maintenance' || Boolean(item.maintenanceDueAt));
    const checkedOutItems = items.filter((item) => item.status === 'checked_out');

    return {
      eyebrow: 'Report inventario',
      title: selectedTeam ? `Inventario ${selectedTeam.name}` : 'Inventario operativo',
      subtitle: 'Situazione asset per team, stato operativo e manutenzioni in evidenza.',
      fileName: this.reportFileName(selectedTeam ? `inventario-${selectedTeam.name}` : 'inventario-operativo'),
      generatedAt: this.formatDateTime(new Date().toISOString()),
      sections: [
        {
          title: 'Panoramica asset',
          metrics: [
            { label: 'Asset visibili', value: String(items.length) },
            { label: 'Disponibili', value: String(items.filter((item) => item.status === 'available').length) },
            { label: 'In prestito', value: String(checkedOutItems.length) },
            { label: 'Da revisionare', value: String(maintenanceItems.length) },
          ],
          facts: [
            { label: 'Scope team', value: selectedTeam?.name || 'Tutti i team' },
            { label: 'Ricerca attiva', value: this.searchQuery.trim() || 'Nessun filtro testuale' },
            { label: 'Gruppi visibili', value: String(this.groupedItems().length) },
            { label: 'Elemento selezionato', value: this.selectedItem()?.name || 'Nessun dettaglio selezionato' },
          ],
        },
        {
          title: 'Stato per team',
          description: 'Raggruppamento sintetico delle dotazioni per area operativa.',
          table: {
            columns: ['Team', 'Asset', 'In prestito', 'Da revisionare'],
            rows: this.groupedItems().length
              ? this.groupedItems().map((group) => [
                  group.label,
                  String(group.items.length),
                  String(this.checkedOutCount(group.items)),
                  String(this.maintenanceCount(group.items)),
                ])
              : [['Nessun gruppo', '0', '0', '0']],
          },
        },
        {
          title: 'Dettaglio asset',
          description: 'Elenco completo delle dotazioni incluse nel report.',
          table: {
            columns: ['Nome', 'Team', 'Seriale', 'Stato', 'Manutenzione'],
            rows: items.length
              ? items.map((item) => [
                  item.name,
                  item.team?.name || 'Senza team',
                  item.serialNumber || '-',
                  this.statusLabel(item.status),
                  item.maintenanceDueAt ? this.formatDate(item.maintenanceDueAt) : 'Nessuna data',
                ])
              : [['Nessuna dotazione', '-', '-', '-', '-']],
          },
          note: maintenanceItems.length
            ? `Attenzione: ${maintenanceItems.length} asset richiedono controllo o manutenzione pianificata.`
            : 'Nessun asset con manutenzione aperta nel filtro corrente.',
        },
      ],
    };
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

  protected openInventoryReport(): void {
    this.reportVisible.set(true);
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
    const itemName = this.items().find((item) => item.id === id)?.name ?? 'questa dotazione';
    this.pendingDelete.set({ id, name: itemName });
    this.confirmVisible.set(true);
  }

  protected confirmDeleteItem(): void {
    const pending = this.pendingDelete();
    if (!pending) {
      return;
    }

    this.api.deleteInventoryItem(pending.id).subscribe({
      next: () => {
        this.closeDeleteConfirm();
        this.loadItems();
        this.feedback.success('Asset eliminato');
      },
      error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare l\'asset.'))
    });
  }

  protected closeDeleteConfirm(): void {
    this.confirmVisible.set(false);
    this.pendingDelete.set(null);
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

  private formatDate(value?: string | null): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(new Date(value));
  }

  private formatDateTime(value?: string | null): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private reportFileName(value: string): string {
    return `${value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report'}.pdf`;
  }
}
