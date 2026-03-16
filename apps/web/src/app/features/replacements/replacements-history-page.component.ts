import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ReplacementItem, TeamListItem } from '@shift-complete/shared-types';
import { UiCardComponent, UiDialogShellComponent, UiLabelComponent, UiSelectComponent, UiSidebarPanelComponent, UiTableShellComponent } from '@shift-complete/ui-kit';
import { ApiErrorService } from '../../core/services/api-error.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { AppApiService } from '../../shared/services/app-api.service';

@Component({
  selector: 'app-replacements-history-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, UiCardComponent, UiDialogShellComponent, UiLabelComponent, UiSelectComponent, UiSidebarPanelComponent, UiTableShellComponent],
  template: `
    <section class="max-w-7xl mx-auto grid gap-6 xl:grid-cols-[1fr_320px]">
      <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <p class="text-sm font-semibold uppercase tracking-widest text-orange-500">Storico sostituzioni</p>
        <h2 class="text-2xl font-semibold tracking-tight text-slate-800">Timeline completa delle sostituzioni approvate, rifiutate e in attesa.</h2>
      </header>

      <ui-card title="Filtri" subtitle="Ricerca rapida per team, stato e volontario">
        <div class="grid gap-4 md:grid-cols-3">
          <div class="grid gap-2">
            <label class="text-sm font-medium text-slate-700">Team</label>
            <input class="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none" [ngModel]="filters.team()" (ngModelChange)="filters.team.set(castString($event))" placeholder="Nome team" />
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-medium text-slate-700">Stato</label>
            <select class="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none" [ngModel]="filters.status()" (ngModelChange)="filters.status.set(castString($event))">
              <option value="">Tutti</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="DECLINED">Declined</option>
            </select>
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-medium text-slate-700">Volontario</label>
            <input class="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none" [ngModel]="filters.person()" (ngModelChange)="filters.person.set(castString($event))" placeholder="Richiedente o sostituto" />
          </div>
        </div>
      </ui-card>

      <ui-card title="Registro sostituzioni" subtitle="Vista trasversale per team e volontari">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" class="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50" (click)="openBulkDialog('APPROVED')" [disabled]="!selectedPendingReplacements().length">Approva selezionate</button>
          <button type="button" class="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-50" (click)="approveAllWithSuggested()" [disabled]="!canApproveAllWithSuggested()">Approva tutte con suggerito</button>
          <button type="button" class="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50" (click)="openBulkDialog('DECLINED')" [disabled]="!selectedPendingReplacements().length">Rifiuta selezionate</button>
          <span class="text-xs text-slate-500" *ngIf="selectedReplacementIds().length">{{ selectedReplacementIds().length }} selezionate</span>
        </div>
        <div class="mb-4 grid gap-2 md:grid-cols-[1fr_auto]" *ngIf="canUseBulkAssignee()">
          <ui-select label="Sostituto bulk" [options]="bulkReplacementOptions()" [value]="bulkReplacementAssigneeId()" (valueChange)="bulkReplacementAssigneeId.set(castString($event) || null)"></ui-select>
          <div class="flex items-end text-xs text-slate-500">Disponibile solo se tutte le replacement selezionate appartengono allo stesso team e slot.</div>
        </div>
        <div class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800" *ngIf="bulkWarnings().length">
          <p class="font-semibold uppercase tracking-[0.22em]">Compatibilita bulk</p>
          <div class="mt-2 grid gap-1">
            <span *ngFor="let warning of bulkWarnings()">{{ warning }}</span>
          </div>
        </div>
        <ui-table-shell>
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-left text-slate-500">
              <tr>
                <th class="px-4 py-3"><input type="checkbox" [checked]="allPendingSelected()" (change)="toggleAllPending($any($event.target).checked)" /></th>
                <th class="px-4 py-3">Evento</th>
                <th class="px-4 py-3">Richiedente</th>
                <th class="px-4 py-3">Sostituto</th>
                <th class="px-4 py-3">Stato</th>
                <th class="px-4 py-3">Azioni</th>
              </tr>
            </thead>
            <tbody>
               <tr *ngFor="let replacement of sortedReplacements()" class="border-t border-slate-100" [class.bg-amber-50]="replacement.id === highlightedReplacementId()">
                <td class="px-4 py-3"><input type="checkbox" [checked]="selectedReplacementIds().includes(replacement.id)" [disabled]="replacement.status !== 'PENDING'" (change)="toggleReplacementSelection(replacement.id, $any($event.target).checked)" /></td>
                <td class="px-4 py-3">
                  <div class="grid gap-1">
                    <span class="font-medium text-slate-800">{{ replacement.assignment?.slot?.event?.title || '-' }}</span>
                    <span class="text-xs text-slate-500">{{ replacement.assignment?.slot?.team?.name || '-' }}</span>
                  </div>
                </td>
                <td class="px-4 py-3">{{ replacement.requestedBy?.fullName || '-' }}</td>
                 <td class="px-4 py-3">
                  <div class="grid gap-2">
                    <span>{{ replacement.replacementAssignee?.fullName || 'Da assegnare' }}</span>
                    <ui-label tone="info" *ngIf="replacement.suggestedReplacement">Suggerito: {{ replacement.suggestedReplacement?.fullName }} · score {{ replacement.suggestedReplacement?.score }}</ui-label>
                    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3" *ngIf="replacement.suggestedCandidates?.length">
                      <div class="flex items-center justify-between gap-2">
                        <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Classifica candidati</p>
                        <button type="button" class="text-xs font-medium text-[#4979e6]" (click)="openAssistant(replacement)">
                          Assistant
                        </button>
                        <button type="button" class="text-xs font-medium text-[#4979e6]" (click)="toggleExpandedReplacement(replacement.id)">
                          {{ expandedReplacementId() === replacement.id ? 'Comprimi' : 'Espandi' }}
                        </button>
                      </div>
                      <div class="mt-2 grid gap-2" *ngIf="expandedReplacementId() === replacement.id">
                        <div class="rounded-xl bg-white px-3 py-2 text-xs text-slate-600" *ngFor="let candidate of replacement.suggestedCandidates | slice:0:3">
                          <div class="flex items-center justify-between gap-2">
                            <span class="font-medium text-slate-800">{{ candidate.fullName }}</span>
                            <ui-label tone="info">score {{ candidate.score }}</ui-label>
                          </div>
                          <div class="mt-1 flex flex-wrap gap-1.5">
                            <ui-label *ngFor="let reason of candidate.reasons" tone="neutral">{{ reason }}</ui-label>
                          </div>
                        </div>
                      </div>
                    </div>
                    <ui-select *ngIf="replacement.status === 'PENDING'" [options]="replacementOptions(replacement)" [value]="replacementSelection[replacement.id]" (valueChange)="replacementSelection[replacement.id] = castString($event)"></ui-select>
                  </div>
                </td>
                <td class="px-4 py-3"><ui-label [tone]="replacement.status === 'APPROVED' ? 'success' : (replacement.status === 'DECLINED' ? 'warn' : 'info')">{{ replacement.status }}</ui-label></td>
                <td class="px-4 py-3">
                  <div class="flex flex-col items-start gap-2">
                    <div class="rounded-2xl border border-[#d9e6ff] bg-[#f7faff] p-3 text-xs text-slate-600" *ngIf="replacement.suggestedReplacement as suggested">
                      <p class="font-semibold uppercase tracking-[0.22em] text-[#4979e6]">Replacement assistant</p>
                      <p class="mt-2">Suggerisco <span class="font-medium text-slate-900">{{ suggested.fullName }}</span> con score {{ suggested.score }}.</p>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        <ui-label *ngFor="let reason of suggested.reasons" tone="neutral">{{ reason }}</ui-label>
                      </div>
                    </div>
                    <button type="button" class="text-sm text-emerald-700" (click)="resolveReplacement(replacement.id, 'APPROVED')" [disabled]="replacement.status !== 'PENDING'">Approva</button>
                     <button type="button" class="text-sm text-[#4979e6]" (click)="approveWithSuggestedReplacement(replacement)" [disabled]="!canUseSuggestedReplacement(replacement) || replacement.status !== 'PENDING'">Approva con suggerito</button>
                     <button type="button" class="text-sm text-red-600" (click)="resolveReplacement(replacement.id, 'DECLINED')" [disabled]="replacement.status !== 'PENDING'">Rifiuta</button>
                    <ui-label *ngIf="actionFeedback()[replacement.id] === 'APPROVED'" tone="success">Approvata ora</ui-label>
                    <ui-label *ngIf="actionFeedback()[replacement.id] === 'DECLINED'" tone="warn">Rifiutata ora</ui-label>
                    <div class="grid gap-1 text-xs text-slate-500">
                      <span>Richiesta: {{ replacement.createdAt | date:'short' }}</span>
                      <span *ngIf="replacement.resolvedAt">Risolta: {{ replacement.resolvedAt | date:'short' }}</span>
                      <span *ngIf="replacement.reason">Motivo: {{ replacement.reason }}</span>
                    </div>
                  </div>
                </td>
              </tr>
              <tr *ngIf="!filteredReplacements().length">
                <td colspan="6" class="px-4 py-6 text-center text-sm text-slate-400">Nessuna sostituzione compatibile con i filtri.</td>
              </tr>
            </tbody>
          </table>
        </ui-table-shell>
      </ui-card>

      <p-dialog [(visible)]="bulkDialogVisible" [modal]="true" [appendTo]="'body'" [baseZIndex]="1200" [blockScroll]="true" [dismissableMask]="true" [closeOnEscape]="true" [focusOnShow]="false" [style]="{ width: '32rem', maxWidth: '94vw' }" [contentStyle]="{ background: 'transparent', padding: '0', overflow: 'visible' }" [draggable]="false" [resizable]="false">
        <ui-dialog-shell title="Conferma azione massiva" eyebrow="Bulk actions" subtitle="Applica la stessa decisione alle richieste selezionate." icon="pi pi-check-square" tone="warn" [hasFooter]="true">
          <div class="grid gap-4">
            <p class="text-sm text-slate-600">
              Stai per {{ bulkActionStatus() === 'APPROVED' ? 'approvare' : 'rifiutare' }} {{ selectedReplacementIds().length }} richieste selezionate.
            </p>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500" *ngIf="bulkReplacementAssigneeId()">
              Il sostituto bulk verra applicato alle richieste selezionate dello stesso team.
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Riepilogo replacement coinvolte</p>
              <div class="mt-3 grid gap-2 text-sm text-slate-600">
                <div class="rounded-xl bg-slate-50 px-3 py-2" *ngFor="let replacement of selectedPendingReplacements()">
                  {{ replacement.assignment?.slot?.event?.title || 'Evento' }} · {{ replacement.assignment?.slot?.team?.name || 'Team' }} · {{ replacement.requestedBy?.fullName || '-' }}
                </div>
              </div>
            </div>
          </div>
          <div dialog-footer class="flex justify-end gap-2">
            <button type="button" class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600" (click)="bulkDialogVisible = false">Annulla</button>
            <button type="button" class="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" (click)="confirmBulkResolve()">Conferma</button>
          </div>
        </ui-dialog-shell>
      </p-dialog>
      </div>

      <ui-sidebar-panel title="Replacement assistant" eyebrow="Decision support">
        <div *ngIf="assistantReplacement() as replacement; else noAssistant" class="grid gap-4">
          <div>
            <p class="text-sm font-medium text-slate-900">{{ replacement.assignment?.slot?.event?.title || 'Sostituzione' }}</p>
            <p class="text-xs text-slate-500">{{ replacement.assignment?.slot?.team?.name || '-' }} · {{ replacement.assignment?.slot?.duty?.name || '-' }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <ui-label [tone]="replacementTone(replacement.status)">{{ assistantStatusLabel(replacement) }}</ui-label>
              <ui-label tone="neutral">{{ assistantCoverageLabel(replacement) }}</ui-label>
            </div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Prossima azione consigliata</p>
            <p class="mt-2 text-sm text-slate-700">{{ assistantRecommendation(replacement) }}</p>
          </div>
          <div class="rounded-2xl border border-[#d9e6ff] bg-[#f7faff] p-4" *ngIf="replacement.suggestedReplacement as suggested">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#4979e6]">Miglior candidato</p>
              <ui-label [tone]="assistantScoreTone(suggested.score)">score {{ suggested.score }}</ui-label>
            </div>
            <p class="mt-2 text-sm text-slate-700"><span class="font-medium text-slate-900">{{ suggested.fullName }}</span></p>
            <div class="mt-3 flex flex-wrap gap-1.5">
              <ui-label *ngFor="let reason of suggested.reasons" tone="neutral">{{ reason }}</ui-label>
            </div>
          </div>
          <div class="grid gap-2" *ngIf="replacement.suggestedCandidates?.length">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Top candidati</p>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3" *ngFor="let candidate of replacement.suggestedCandidates">
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium text-slate-800">{{ candidate.fullName }}</span>
                <ui-label [tone]="assistantScoreTone(candidate.score)">score {{ candidate.score }}</ui-label>
              </div>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <ui-label *ngFor="let reason of candidate.reasons" tone="neutral">{{ reason }}</ui-label>
              </div>
            </div>
          </div>
          <div class="flex gap-2" *ngIf="assistantReplacement()?.status === 'PENDING'">
            <button type="button" class="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" (click)="approveWithSuggestedReplacement(replacement)" [disabled]="!canUseSuggestedReplacement(replacement)">Approva con suggerito</button>
            <button type="button" class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600" (click)="assistantReplacement.set(null)">Chiudi</button>
          </div>
        </div>
        <ng-template #noAssistant>
          <p class="text-sm text-slate-500">Seleziona una replacement per vedere stato, priorita operativa, ranking candidati e azione consigliata.</p>
        </ng-template>
      </ui-sidebar-panel>
    </section>
  `,
})
export class ReplacementsHistoryPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly replacements = signal<ReplacementItem[]>([]);
  protected readonly teams = signal<TeamListItem[]>([]);
  protected readonly highlightedReplacementId = signal<string | null>(null);
  protected readonly expandedReplacementId = signal<string | null>(null);
  protected readonly assistantReplacement = signal<ReplacementItem | null>(null);
  protected readonly locallyReservedSuggestionIds = signal<string[]>([]);
  protected replacementSelection: Record<string, string> = {};
  protected readonly actionFeedback = signal<Record<string, 'APPROVED' | 'DECLINED'>>({});
  protected readonly selectedReplacementIds = signal<string[]>([]);
  protected readonly bulkReplacementAssigneeId = signal<string | null>(null);
  protected readonly bulkActionStatus = signal<'APPROVED' | 'DECLINED'>('APPROVED');
  protected bulkDialogVisible = false;
  protected readonly filters = {
    team: signal(''),
    status: signal(''),
    person: signal(''),
  };

  protected readonly filteredReplacements = computed(() => {
    const team = this.filters.team().trim().toLowerCase();
    const status = this.filters.status().trim();
    const person = this.filters.person().trim().toLowerCase();

    return this.replacements().filter((replacement) => {
      const teamMatch = !team || (replacement.assignment?.slot?.team?.name || '').toLowerCase().includes(team);
      const statusMatch = !status || replacement.status === status;
      const personPool = `${replacement.requestedBy?.fullName || ''} ${replacement.replacementAssignee?.fullName || ''}`.toLowerCase();
      const personMatch = !person || personPool.includes(person);
      return teamMatch && statusMatch && personMatch;
    });
  });

  protected readonly sortedReplacements = computed(() => {
    const highlightedReplacementId = this.highlightedReplacementId();

    return [...this.filteredReplacements()].sort((left, right) => {
      if (left.id === highlightedReplacementId && right.id !== highlightedReplacementId) {
        return -1;
      }

      if (right.id === highlightedReplacementId && left.id !== highlightedReplacementId) {
        return 1;
      }

      const statusOrder = { PENDING: 0, APPROVED: 1, DECLINED: 2 } as const;
      const statusDelta = statusOrder[left.status] - statusOrder[right.status];
      if (statusDelta !== 0) {
        return statusDelta;
      }

      const assigneeDelta = Number(Boolean(left.replacementAssigneeId)) - Number(Boolean(right.replacementAssigneeId));
      if (assigneeDelta !== 0) {
        return assigneeDelta;
      }

      const suggestionDelta = (right.suggestedReplacement?.score ?? -1) - (left.suggestedReplacement?.score ?? -1);
      if (suggestionDelta !== 0) {
        return suggestionDelta;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  });

  protected readonly allPendingSelected = computed(() => {
    const pendingIds = this.filteredReplacements().filter((replacement) => replacement.status === 'PENDING').map((replacement) => replacement.id);
    return pendingIds.length > 0 && pendingIds.every((id) => this.selectedReplacementIds().includes(id));
  });

  protected readonly selectedPendingReplacements = computed(() =>
    this.filteredReplacements().filter((replacement) => this.selectedReplacementIds().includes(replacement.id) && replacement.status === 'PENDING')
  );

  protected readonly canUseBulkAssignee = computed(() => {
    const teamNames = Array.from(new Set(this.selectedPendingReplacements().map((replacement) => replacement.assignment?.slot?.team?.name).filter(Boolean)));
    const slotIds = Array.from(new Set(this.selectedPendingReplacements().map((replacement) => replacement.assignment?.slot?.id).filter(Boolean)));
    return teamNames.length === 1 && slotIds.length === 1 && this.selectedPendingReplacements().length > 0;
  });

  protected readonly bulkReplacementOptions = computed(() => {
    if (!this.canUseBulkAssignee()) {
      return [] as Array<{ label: string; value: string }>;
    }

    const teamName = this.selectedPendingReplacements()[0]?.assignment?.slot?.team?.name;
    const team = this.teams().find((item) => item.name === teamName);
    return (team?.members ?? []).map((member) => ({ label: member.fullName, value: member.id }));
  });

  protected readonly bulkWarnings = computed(() => {
    if (!this.selectedPendingReplacements().length) {
      return [] as string[];
    }

    const teamNames = Array.from(new Set(this.selectedPendingReplacements().map((replacement) => replacement.assignment?.slot?.team?.name).filter(Boolean)));
    const slotIds = Array.from(new Set(this.selectedPendingReplacements().map((replacement) => replacement.assignment?.slot?.id).filter(Boolean)));
    const warnings: string[] = [];

    if (teamNames.length > 1) {
      warnings.push('Le replacement selezionate appartengono a team differenti.');
    }

    if (slotIds.length > 1) {
      warnings.push('Le replacement selezionate appartengono a slot differenti, quindi non possono condividere lo stesso sostituto bulk.');
    }

    const missingSuggestions = this.selectedPendingReplacements().filter((replacement) => !replacement.suggestedReplacement).length;
    if (missingSuggestions > 0) {
      warnings.push(`${missingSuggestions} replacement non hanno un suggerimento automatico disponibile.`);
    }

    const suggestedIds = this.selectedPendingReplacements().map((replacement) => replacement.suggestedReplacement?.id).filter(Boolean);
    if (suggestedIds.length !== new Set(suggestedIds).size) {
      warnings.push('Alcune replacement condividono lo stesso sostituto suggerito e non possono essere approvate insieme con suggerito.');
    }

    return warnings;
  });

  protected readonly canApproveAllWithSuggested = computed(() =>
    this.selectedPendingReplacements().length > 0 &&
    this.selectedPendingReplacements().every((replacement) => Boolean(replacement.suggestedReplacement?.id)) &&
    new Set(this.selectedPendingReplacements().map((replacement) => replacement.suggestedReplacement?.id).filter(Boolean)).size === this.selectedPendingReplacements().length
  );

  constructor() {
    this.api.replacements().subscribe({
      next: (items) => {
        this.replacements.set(items);
        const highlightedReplacementId = this.highlightedReplacementId();
        if (highlightedReplacementId) {
          this.assistantReplacement.set(items.find((item) => item.id === highlightedReplacementId) ?? this.assistantReplacement());
        }
      },
    });
    this.api.teams().subscribe({ next: (teams) => this.teams.set(teams) });
    this.route.queryParamMap.subscribe((params) => {
      const replacementId = params.get('replacementId');
      this.highlightedReplacementId.set(replacementId);
      if (replacementId) {
        this.assistantReplacement.set(this.replacements().find((item) => item.id === replacementId) ?? this.assistantReplacement());
      }
    });
  }

  protected castString(value: unknown): string {
    return value ? String(value) : '';
  }

  protected replacementOptions(replacement: ReplacementItem): Array<{ label: string; value: string }> {
    const teamName = replacement.assignment?.slot?.team?.name;
    const team = this.teams().find((item) => item.name === teamName);
    return (team?.members ?? []).map((member) => ({ label: member.fullName, value: member.id }));
  }

  protected suggestedReplacementAssigneeId(replacement: ReplacementItem): string | null {
    return replacement.suggestedReplacement?.id ?? this.replacementOptions(replacement)[0]?.value ?? null;
  }

  protected canUseSuggestedReplacement(replacement: ReplacementItem): boolean {
    const suggestedId = this.suggestedReplacementAssigneeId(replacement);
    return Boolean(suggestedId && !this.locallyReservedSuggestionIds().includes(suggestedId));
  }

  protected toggleExpandedReplacement(replacementId: string): void {
    this.expandedReplacementId.set(this.expandedReplacementId() === replacementId ? null : replacementId);
  }

  protected openAssistant(replacement: ReplacementItem): void {
    this.assistantReplacement.set(replacement);
    this.expandedReplacementId.set(replacement.id);
    this.router.navigate([], { queryParams: { replacementId: replacement.id }, queryParamsHandling: 'merge' });
  }

  protected replacementTone(status: ReplacementItem['status']): 'success' | 'warn' | 'info' {
    if (status === 'APPROVED') {
      return 'success';
    }

    if (status === 'DECLINED') {
      return 'warn';
    }

    return 'info';
  }

  protected assistantScoreTone(score: number): 'success' | 'info' | 'warn' {
    if (score >= 80) {
      return 'success';
    }

    if (score >= 60) {
      return 'info';
    }

    return 'warn';
  }

  protected assistantStatusLabel(replacement: ReplacementItem): string {
    if (replacement.status === 'APPROVED') {
      return 'Decisione presa';
    }

    if (replacement.status === 'DECLINED') {
      return 'Richiesta chiusa';
    }

    return 'Decisione richiesta';
  }

  protected assistantCoverageLabel(replacement: ReplacementItem): string {
    return replacement.replacementAssignee?.fullName ? `Copertura: ${replacement.replacementAssignee.fullName}` : 'Copertura da confermare';
  }

  protected assistantRecommendation(replacement: ReplacementItem): string {
    if (replacement.status === 'APPROVED') {
      return replacement.replacementAssignee?.fullName
        ? `La copertura e gia confermata con ${replacement.replacementAssignee.fullName}.`
        : 'La richiesta e approvata: verifica che il sostituto venga confermato operativamente.';
    }

    if (replacement.status === 'DECLINED') {
      return 'La richiesta e stata chiusa senza sostituzione: valuta se riaprire il coordinamento manuale.';
    }

    if (replacement.suggestedReplacement?.fullName) {
      return `Valuta ${replacement.suggestedReplacement.fullName} come prima scelta e conferma rapidamente per non perdere copertura.`;
    }

    return 'Non c e un suggerimento automatico forte: valuta manualmente disponibilita e priorita del team.';
  }

  protected resolveReplacement(replacementId: string, status: 'APPROVED' | 'DECLINED'): void {
    const replacementAssigneeId = this.replacementSelection[replacementId] || undefined;
    const replacementAssignee = replacementAssigneeId ? this.findMemberById(replacementAssigneeId) : null;

    this.api.resolveReplacement(replacementId, {
      status,
      replacementAssigneeId,
    }).subscribe({
      next: () => {
        this.actionFeedback.update((state) => ({ ...state, [replacementId]: status }));
        this.selectedReplacementIds.update((ids) => ids.filter((id) => id !== replacementId));
        if (status === 'APPROVED' && replacementAssigneeId) {
          this.locallyReservedSuggestionIds.update((ids) => Array.from(new Set([...ids, replacementAssigneeId])));
        }
        this.feedback.success(status === 'APPROVED' ? 'Sostituzione approvata' : 'Sostituzione rifiutata');
        this.router.navigate([], { queryParams: { replacementId }, queryParamsHandling: 'merge' });
        this.replacements.update((items) =>
          items.map((item) =>
            item.id === replacementId
              ? {
                  ...item,
                  status,
                  resolvedAt: new Date().toISOString(),
                  replacementAssigneeId: replacementAssigneeId ?? item.replacementAssigneeId,
                  replacementAssignee: replacementAssigneeId
                    ? replacementAssignee
                      ? {
                          id: replacementAssignee.id,
                          fullName: replacementAssignee.fullName,
                          email: replacementAssignee.email,
                        }
                      : item.replacementAssignee
                    : item.replacementAssignee,
                }
              : item
          )
        );
        this.assistantReplacement.update((item) =>
          item?.id === replacementId
            ? {
                ...item,
                status,
                resolvedAt: new Date().toISOString(),
                replacementAssigneeId: replacementAssigneeId ?? item.replacementAssigneeId,
                replacementAssignee: replacementAssigneeId
                  ? replacementAssignee
                    ? {
                        id: replacementAssignee.id,
                        fullName: replacementAssignee.fullName,
                        email: replacementAssignee.email,
                      }
                    : item.replacementAssignee
                  : item.replacementAssignee,
              }
            : item
        );
      },
      error: (error) => this.feedback.error('Operazione non riuscita', this.apiError.message(error, 'Impossibile aggiornare la sostituzione.')),
    });
  }

  private findMemberById(memberId: string): NonNullable<TeamListItem['members']>[number] | null {
    return this.teams()
      .flatMap((team) => team.members ?? [])
      .find((member) => member.id === memberId) ?? null;
  }

  protected toggleReplacementSelection(replacementId: string, checked: boolean): void {
    this.selectedReplacementIds.update((ids) =>
      checked ? Array.from(new Set([...ids, replacementId])) : ids.filter((id) => id !== replacementId)
    );
  }

  protected toggleAllPending(checked: boolean): void {
    if (!checked) {
      this.selectedReplacementIds.set([]);
      this.bulkReplacementAssigneeId.set(null);
      return;
    }

    this.selectedReplacementIds.set(this.filteredReplacements().filter((replacement) => replacement.status === 'PENDING').map((replacement) => replacement.id));
  }

  protected openBulkDialog(status: 'APPROVED' | 'DECLINED'): void {
    this.bulkActionStatus.set(status);
    this.bulkDialogVisible = true;
  }

  protected confirmBulkResolve(): void {
    this.bulkDialogVisible = false;
    this.resolveSelected(this.bulkActionStatus());
  }

  protected resolveSelected(status: 'APPROVED' | 'DECLINED'): void {
    for (const replacementId of this.selectedReplacementIds()) {
      if (status === 'APPROVED' && this.canUseBulkAssignee() && this.bulkReplacementAssigneeId()) {
        this.replacementSelection[replacementId] = this.bulkReplacementAssigneeId() as string;
      }
      this.resolveReplacement(replacementId, status);
    }
  }

  protected approveWithSuggestedReplacement(replacement: ReplacementItem): void {
    const suggestedId = this.suggestedReplacementAssigneeId(replacement);
    if (!suggestedId) {
      return;
    }

    this.replacementSelection[replacement.id] = suggestedId;
    this.resolveReplacement(replacement.id, 'APPROVED');
  }

  protected approveAllWithSuggested(): void {
    for (const replacement of this.selectedPendingReplacements()) {
      const suggestedId = this.suggestedReplacementAssigneeId(replacement);
      if (!suggestedId) {
        continue;
      }

      this.replacementSelection[replacement.id] = suggestedId;
      this.resolveReplacement(replacement.id, 'APPROVED');
    }
  }
}
