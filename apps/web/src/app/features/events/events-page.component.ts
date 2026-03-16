import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ReplacementItem } from '@shift-complete/shared-types';
import { ApiErrorService } from '../../core/services/api-error.service';
import { SessionService } from '../../core/services/session.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { toIsoDateTime } from '../../core/utils/date-picker.util';
import { AppApiService } from '../../shared/services/app-api.service';
import { LiveNotificationsService } from '../../core/services/live-notifications.service';
import {
  UiDatePickerComponent,
  UiDialogShellComponent,
  UiLabelComponent,
  UiSelectComponent,
  UiSidebarPanelComponent,
  UiTableShellComponent,
  UiToggleComponent,
} from '@shift-complete/ui-kit';

type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  type: string;
  slots?: Array<{
    id: string;
    dutyId?: string;
    roleName?: string;
    teamId: string;
    teamName?: string;
    startsAt?: string;
    endsAt?: string;
    assignments?: Array<{ id: string; assigneeId?: string | null; status: string; replacementApproved?: boolean; assignee?: { id?: string; fullName?: string | null } | null }>;
  }>;
  assignments?: Array<{ id: string; eventId: string; slotId: string; roleName?: string; team?: string; assignee?: string | null; status: string }>;
};

type AssignmentRecord = NonNullable<NonNullable<CalendarEvent['slots']>[number]['assignments']>[number];

type EventSlotForm = {
  teamId: string | null;
  dutyId: string;
  startsAt: Date | null;
  endsAt: Date | null;
  required: boolean;
};

type TeamOption = {
  id: string;
  name: string;
  description?: string | null;
  members?: Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
  }>;
  duties?: Array<{
    id: string;
    name: string;
    color?: string | null;
    icon?: string | null;
  }>;
};

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    TableModule,
    TagModule,
    UiDialogShellComponent,
    UiSidebarPanelComponent,
    UiSelectComponent,
    UiDatePickerComponent,
    UiToggleComponent,
    UiTableShellComponent,
    UiLabelComponent,
  ],
  template: `
    <section class="grid gap-6">
      <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-teal-700">Eventi</p>
          <h2 class="text-3xl font-semibold tracking-tight text-slate-900">CRUD eventi, assegnazioni e copertura reale dei turni.</h2>
          <p class="mt-2 max-w-3xl text-sm text-slate-500">Gestisci creazione, modifica, assegnazioni e replacement in una workspace operativa dedicata agli eventi.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button pButton type="button" label="Nuovo evento" icon="pi pi-plus" (click)="openEventDialog()"></button>
          <button pButton type="button" label="Auto assegna" icon="pi pi-sparkles" severity="contrast" [outlined]="true" (click)="autoAssign()"></button>
          <button pButton type="button" label="Board assegnazioni" icon="pi pi-directions-alt" severity="secondary" [outlined]="true" (click)="openAssignmentBoard()"></button>
        </div>
      </header>

      <div class="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div class="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div class="border-b border-slate-100 px-5 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="text-base font-semibold text-slate-800">Registro eventi</h3>
              <p class="mt-0.5 text-sm text-slate-500">Tutti gli eventi ordinati per data con accesso diretto a modifica, eliminazione e board operativa.</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">{{ sortedEvents().length }} eventi</span>
            </div>
          </div>

          <div class="divide-y divide-slate-100">
            <div *ngFor="let event of sortedEvents()"
              class="group flex cursor-pointer items-start gap-4 px-5 py-4 transition hover:bg-slate-50"
              [class.bg-slate-50]="selectedEvent()?.id === event.id"
              (click)="selectEvent(event)">
              <div class="flex min-w-12 flex-col items-center justify-center rounded-xl bg-[#4979e6] px-2 py-2 text-center text-white">
                <span class="text-lg font-light leading-none">{{ event.startsAt | date:'d' }}</span>
                <span class="mt-0.5 text-[9px] font-semibold uppercase tracking-widest">{{ event.startsAt | date:'MMM' }}</span>
              </div>
              <div class="flex-1">
                <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p class="text-sm font-semibold text-slate-800 transition group-hover:text-[#4979e6]">{{ event.title }}</p>
                    <p class="mt-0.5 text-xs text-slate-500">{{ event.startsAt | date:'short' }} - {{ event.endsAt | date:'short' }}</p>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <ui-label tone="neutral">{{ event.type }}</ui-label>
                    <ui-label [tone]="(event.assignments?.length || 0) > 0 ? 'success' : 'warn'">{{ (event.assignments?.length || 0) > 0 ? 'coperto' : 'da coprire' }}</ui-label>
                    <ui-label tone="info">{{ event.slots?.length || 0 }} slot</ui-label>
                  </div>
                </div>
              </div>
              <i class="pi pi-chevron-right mt-1 text-slate-300 transition group-hover:text-[#4979e6]"></i>
            </div>
            <div *ngIf="!events().length" class="px-5 py-12 text-center text-sm text-slate-400">
              <i class="pi pi-calendar mb-2 block text-3xl opacity-40"></i>
              Nessun evento disponibile.
            </div>
          </div>
        </div>

        <div class="grid gap-4">
          <ui-sidebar-panel title="Dettaglio evento" eyebrow="Workspace eventi">
            <div *ngIf="selectedEvent() as event; else noEvent" class="grid gap-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-lg font-semibold text-slate-900">{{ event.title }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ event.startsAt | date:'fullDate' }} · {{ event.startsAt | date:'shortTime' }} - {{ event.endsAt | date:'shortTime' }}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" (click)="openEditEvent(event)">Modifica</button>
                  <button type="button" class="rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50" (click)="deleteEvent(event.id)">Elimina</button>
                </div>
              </div>
              <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p class="font-medium text-slate-900">Finestra operativa</p>
                <p class="mt-1">{{ event.startsAt | date:'short' }} - {{ event.endsAt | date:'short' }}</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <ui-label tone="neutral">{{ event.type }}</ui-label>
                  <ui-label [tone]="(event.assignments?.length || 0) > 0 ? 'success' : 'warn'">{{ (event.assignments?.length || 0) > 0 ? 'copertura avviata' : 'nessuna assegnazione' }}</ui-label>
                </div>
              </div>
              <ui-table-shell title="Slot evento">
                <table class="min-w-full text-sm">
                  <thead class="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th class="px-4 py-3">Mansione</th>
                      <th class="px-4 py-3">Team</th>
                      <th class="px-4 py-3">Assegnazioni</th>
                      <th class="px-4 py-3">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let slot of event.slots || []" class="border-t border-slate-100" [class.bg-amber-50]="isTargetSlot(slot)" [class.ring-1]="isTargetSlot(slot)" [class.ring-amber-300]="isTargetSlot(slot)">
                      <td class="px-4 py-3">{{ slot.roleName || 'Mansione' }}</td>
                      <td class="px-4 py-3">{{ slot.teamName || 'Team' }}</td>
                      <td class="px-4 py-3">
                        <div class="grid gap-2" *ngIf="slot.assignments?.length; else noSlotAssignments">
                          <div *ngFor="let assignment of slot.assignments" class="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                            <div class="flex items-start justify-between gap-3">
                              <div>
                                <p class="font-medium text-slate-900">{{ assignment.assignee?.fullName || 'Assegnazione aperta' }}</p>
                                <p class="text-xs text-slate-500">{{ assignment.status }}</p>
                              </div>
                              <div class="flex flex-wrap gap-2" *ngIf="replacementForAssignment(assignment.id) as replacement">
                                <ui-label [tone]="replacementTone(replacement.status)">{{ replacement.status }}</ui-label>
                                <ui-label tone="neutral" *ngIf="replacement.reason">{{ replacement.reason }}</ui-label>
                                <button type="button" class="text-xs font-medium text-[#4979e6]" (click)="openReplacementAssistant(replacement)">Assistant</button>
                              </div>
                            </div>
                            <div class="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3" *ngIf="replacementForAssignment(assignment.id) as replacement">
                              <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Timeline sostituzione</p>
                              <div class="mt-2 grid gap-2 text-xs text-slate-600">
                                <div class="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                                  <span>Assegnazione originaria</span>
                                  <span class="font-medium text-slate-800">{{ replacement.requestedBy?.fullName || assignment.assignee?.fullName || 'Volontario' }}</span>
                                </div>
                                <div class="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2" *ngIf="replacement.replacementAssignee?.fullName">
                                  <span>Sostituto confermato</span>
                                  <span class="font-medium text-emerald-700">{{ replacement.replacementAssignee?.fullName }}</span>
                                </div>
                              </div>
                            </div>
                            <div class="mt-2 grid gap-2" *ngIf="canRequestReplacement(assignment)">
                              <input class="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none" [(ngModel)]="replacementReason" placeholder="Motivo sostituzione" />
                              <button type="button" class="text-xs font-medium text-orange-700" (click)="requestReplacement(assignment.id)" [disabled]="hasPendingReplacement(assignment.id)">
                                {{ hasPendingReplacement(assignment.id) ? 'Richiesta inviata' : 'Richiedi sostituzione' }}
                              </button>
                            </div>
                          </div>
                        </div>
                        <ng-template #noSlotAssignments>
                          <span class="text-sm text-slate-400">Nessuna assegnazione</span>
                        </ng-template>
                      </td>
                      <td class="px-4 py-3">
                        <ui-label [tone]="slot.assignments?.length ? 'success' : 'warn'">{{ slot.assignments?.length ? 'coperto' : 'vacante' }}</ui-label>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </ui-table-shell>
              <div class="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
                <p class="font-medium text-slate-900">Realtime</p>
                <p class="mt-1">{{ live.connected() ? 'Connesso al gateway websocket' : 'In attesa connessione websocket' }}</p>
              </div>
            </div>
            <ng-template #noEvent>
              <p class="text-sm text-slate-500">Seleziona un evento dalla lista oppure creane uno nuovo.</p>
            </ng-template>
          </ui-sidebar-panel>

          <ui-sidebar-panel title="Replacement assistant" eyebrow="Workspace eventi">
            <div *ngIf="assistantReplacement() as replacement; else noReplacementAssistant" class="grid gap-4">
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
                <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3" *ngFor="let candidate of replacement.suggestedCandidates | slice:0:3">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-medium text-slate-800">{{ candidate.fullName }}</span>
                    <ui-label [tone]="assistantScoreTone(candidate.score)">score {{ candidate.score }}</ui-label>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    <ui-label *ngFor="let reason of candidate.reasons" tone="neutral">{{ reason }}</ui-label>
                  </div>
                </div>
              </div>
              <div class="flex gap-2" *ngIf="replacement.status === 'PENDING'">
                <button type="button" class="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" (click)="approveReplacementWithSuggestion(replacement)" [disabled]="!replacement.suggestedReplacement?.id || locallyReservedSuggestionIds().includes(replacement.suggestedReplacement.id)">Approva con suggerito</button>
                <button type="button" class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600" (click)="assistantReplacement.set(null)">Chiudi</button>
              </div>
            </div>
            <ng-template #noReplacementAssistant>
              <p class="text-sm text-slate-500">Apri una replacement dalla timeline o dalla board per vedere stato, priorita operativa, ranking candidati e azione consigliata.</p>
            </ng-template>
          </ui-sidebar-panel>
        </div>
      </div>

      <p-dialog [(visible)]="eventDialogVisible" [modal]="true" [appendTo]="'body'" [baseZIndex]="1200" [blockScroll]="true" [dismissableMask]="true" [closeOnEscape]="true" [focusOnShow]="false" [style]="{ width: '48rem', maxWidth: '96vw' }" [contentStyle]="{ background: 'transparent', padding: '0', overflow: 'visible' }" [draggable]="false" [resizable]="false">
        <ui-dialog-shell [title]="editingEventId() ? 'Modifica evento' : 'Nuovo evento'" eyebrow="Workspace eventi" subtitle="Definisci slot, team e ricorrenza del servizio." icon="pi pi-calendar-plus" tone="info" [hasFooter]="true">
          <div class="grid gap-4">
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">Titolo evento</label>
              <input class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="eventForm.title" placeholder="Titolo evento" />
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="grid gap-2">
                <label class="text-sm font-medium text-slate-700">Inizio</label>
                <ui-date-picker label="Inizio" [(value)]="eventForm.startsAt" [showTime]="true" hourFormat="24" [baseZIndex]="1400" inputStyleClass="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"></ui-date-picker>
              </div>
              <div class="grid gap-2">
                <label class="text-sm font-medium text-slate-700">Fine</label>
                <ui-date-picker label="Fine" [(value)]="eventForm.endsAt" [showTime]="true" hourFormat="24" [baseZIndex]="1400" inputStyleClass="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"></ui-date-picker>
              </div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <ui-toggle label="Evento ricorrente settimanale" [value]="eventForm.isRecurring" (valueChange)="eventForm.isRecurring = $event"></ui-toggle>
            </div>
            <div class="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-medium text-slate-900">Slot evento</p>
                  <p class="text-xs text-slate-500">Aggiungi piu team e piu mansioni nello stesso evento.</p>
                </div>
                <button type="button" class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" (click)="addEventSlot()">Aggiungi slot</button>
              </div>
              <div class="grid gap-3" *ngFor="let slot of eventForm.slots; let slotIndex = index">
                <div class="rounded-2xl border border-slate-200 bg-white p-4">
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <p class="text-sm font-medium text-slate-900">Slot {{ slotIndex + 1 }}</p>
                    <button type="button" class="text-xs text-red-600 hover:text-red-700" (click)="removeEventSlot(slotIndex)" [disabled]="eventForm.slots.length === 1">Rimuovi</button>
                  </div>
                    <div class="grid gap-4 md:grid-cols-2">
                      <ui-select label="Team" [options]="teamOptions()" [value]="slot.teamId" (valueChange)="updateSlotTeam(slotIndex, castNullable($event) ?? '')"></ui-select>
                      <ui-select label="Mansione" [options]="slotDutyOptions(slot.teamId)" [value]="slot.dutyId" (valueChange)="updateSlotDuty(slotIndex, castNullable($event) ?? '')"></ui-select>
                      <div class="grid gap-2">
                        <label class="text-sm font-medium text-slate-700">Inizio slot</label>
                      <ui-date-picker label="Inizio slot" [(value)]="slot.startsAt" [showTime]="true" hourFormat="24" [baseZIndex]="1400" inputStyleClass="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"></ui-date-picker>
                    </div>
                    <div class="grid gap-2">
                        <label class="text-sm font-medium text-slate-700">Fine slot</label>
                        <ui-date-picker label="Fine slot" [(value)]="slot.endsAt" [showTime]="true" hourFormat="24" [baseZIndex]="1400" inputStyleClass="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"></ui-date-picker>
                      </div>
                    </div>
                    <div class="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <ui-toggle label="Slot richiesto" [value]="slot.required" (valueChange)="slot.required = $event"></ui-toggle>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          <div dialog-footer class="flex justify-end gap-2">
            <button pButton type="button" label="Annulla" [text]="true" (click)="eventDialogVisible = false"></button>
            <button pButton type="button" [label]="editingEventId() ? 'Salva modifiche' : 'Crea evento'" (click)="saveEvent()" [disabled]="!isEventFormValid()"></button>
          </div>
        </ui-dialog-shell>
      </p-dialog>

      <p-dialog [(visible)]="previewVisible" [modal]="true" [appendTo]="'body'" [baseZIndex]="1200" [blockScroll]="true" [dismissableMask]="true" [closeOnEscape]="true" [focusOnShow]="false" [style]="{ width: '72rem', maxWidth: '96vw' }" [contentStyle]="{ background: 'transparent', padding: '0', overflow: 'visible' }" [draggable]="false" [resizable]="false">
        <ui-dialog-shell title="Auto assegnazione turni" eyebrow="Scheduling engine" subtitle="Analizza disponibilita, conflitti e motivazioni prima di applicare il planning." icon="pi pi-sparkles" tone="success">
          <ui-table-shell>
            <p-table [value]="previewSuggestions()" [tableStyle]="{ 'min-width': '50rem' }">
              <ng-template pTemplate="header">
                <tr><th>Team</th><th>Ruolo</th><th>Inizio</th><th>Copertura</th><th>Volontario</th><th>Strategia</th><th>Perche</th></tr>
              </ng-template>
              <ng-template pTemplate="body" let-item>
                <tr>
                  <td>{{ item.teamName }}</td>
                  <td>{{ item.roleName }}</td>
                  <td>{{ item.startsAt | date:'short' }}</td>
                  <td><p-tag [severity]="item.coverageStatus === 'covered' ? 'success' : (item.coverageStatus === 'suggested' ? 'info' : 'warn')" [value]="item.coverageStatus"></p-tag></td>
                  <td>{{ item.assigneeName || '-' }}</td>
                  <td>{{ item.strategy }}</td>
                  <td>
                    <div class="flex flex-wrap gap-1.5" *ngIf="item.reasons?.length; else noReasons">
                      <ui-label *ngFor="let reason of item.reasons" [tone]="reasonTone(reason)">{{ reason }}</ui-label>
                    </div>
                    <ng-template #noReasons>-</ng-template>
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </ui-table-shell>
          <div class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" *ngIf="previewSuggestions().length">
            <p class="text-sm font-medium text-slate-900">Perche e stato scelto</p>
            <div class="mt-3 grid gap-3">
              <div class="rounded-2xl border border-slate-200 bg-white p-3" *ngFor="let suggestion of previewSuggestions() | slice:0:3">
                <div class="flex items-center justify-between gap-3">
                  <p class="font-medium text-slate-900">{{ suggestion.roleName }} · {{ suggestion.teamName }}</p>
                  <ui-label tone="info">{{ suggestion.assigneeName || 'Nessun candidato' }}</ui-label>
                </div>
                <div class="mt-2 flex flex-wrap gap-2">
                  <ui-label *ngFor="let reason of suggestion.reasons || []" [tone]="reasonTone(reason)">{{ reason }}</ui-label>
                </div>
                <div class="mt-3 grid gap-2" *ngIf="suggestion.candidates?.length">
                  <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Classifica candidati</p>
                  <div class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600" *ngFor="let candidate of suggestion.candidates">
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-medium text-slate-800">{{ candidate.fullName }}</span>
                      <ui-label tone="info">score {{ candidate.score }}</ui-label>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-1.5">
                      <ui-label *ngFor="let reason of candidate.reasons" [tone]="reasonTone(reason)">{{ reason }}</ui-label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ui-dialog-shell>
      </p-dialog>

      <p-dialog [(visible)]="assignmentBoardVisible" [modal]="true" [appendTo]="'body'" [baseZIndex]="1200" [blockScroll]="true" [dismissableMask]="true" [closeOnEscape]="true" [focusOnShow]="false" [style]="{ width: '78rem', maxWidth: '98vw' }" [contentStyle]="{ background: 'transparent', padding: '0', overflow: 'visible' }" [draggable]="false" [resizable]="false">
        <ui-dialog-shell title="Board assegnazioni" eyebrow="Workspace eventi" subtitle="Gestisci assegnazioni, replacement e copertura del servizio in un'unica board." icon="pi pi-directions-alt" tone="info">
          <div class="grid gap-4" *ngIf="selectedEvent() as event; else noAssignmentEvent">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-900">{{ event.title }}</p>
                  <p class="mt-1 text-xs text-slate-500">Trascina una persona del team nello slot corretto oppure gestisci replacement e conferme direttamente dalla board.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <ui-label tone="neutral">{{ selectedEventSlots().length }} slot</ui-label>
                  <ui-label tone="info">{{ event.assignments?.length || 0 }} assegnazioni</ui-label>
                </div>
              </div>
            </div>

            <div class="grid gap-4 xl:grid-cols-2">
              <div *ngFor="let slot of selectedEventSlots()" class="relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition" [class.ring-2]="isTargetSlot(slot) || dragHoverSlotId() === slot.id" [class.ring-amber-300]="isTargetSlot(slot) || dragHoverSlotId() === slot.id" [class.border-[#4979e6]]="dragHoverSlotId() === slot.id" [class.bg-[#f8fbff]]="dragHoverSlotId() === slot.id" (dragover)="allowDrop($event, slot.id)" (dragenter)="setDragHoverSlot(slot.id)" (dragleave)="clearDragHoverSlot(slot.id)" (drop)="dropVolunteer(slot.id)">
                <div *ngIf="dragHoverSlotId() === slot.id" class="pointer-events-none absolute inset-3 rounded-2xl border-2 border-dashed border-[#4979e6] bg-[#eef4ff]/80"></div>
                <div class="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p class="font-medium text-slate-900">{{ slot.roleName }}</p>
                    <p class="text-sm text-slate-500">{{ slot.teamName }}</p>
                  </div>
                  <ui-label [tone]="slot.assignments?.length ? 'success' : 'warn'">{{ slot.assignments?.length ? 'coperto' : 'vacante' }}</ui-label>
                </div>

                <div class="mt-4 grid flex-1 gap-4 lg:grid-cols-2">
                  <div class="grid content-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div class="flex items-center justify-between gap-2">
                      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Persone del team</p>
                      <span class="text-xs text-slate-400">{{ membersForTeam(slot.teamId).length }}</span>
                    </div>
                    <div *ngFor="let member of membersForTeam(slot.teamId)" draggable="true" (dragstart)="startDragging(member.id)" (dragend)="finishDragging()" class="cursor-grab rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm transition hover:border-slate-300 hover:shadow" [class.border-[#4979e6]]="draggedVolunteerId() === member.id" [class.bg-[#f8fbff]]="draggedVolunteerId() === member.id" [class.shadow-lg]="draggedVolunteerId() === member.id" [class.scale-[1.01]]="draggedVolunteerId() === member.id">
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                          <p class="truncate font-medium text-slate-900">{{ member.fullName }}</p>
                          <p class="truncate text-xs text-slate-500">{{ member.email }}</p>
                        </div>
                        <ui-label tone="neutral">{{ member.role }}</ui-label>
                      </div>
                    </div>
                    <div *ngIf="!membersForTeam(slot.teamId).length" class="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-400">
                      Nessuna persona presente in questo team.
                    </div>
                  </div>

                  <div class="grid content-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div class="flex items-center justify-between gap-2">
                      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Assegnazioni slot</p>
                      <span class="text-xs text-slate-400">{{ slot.assignments?.length || 0 }}</span>
                    </div>
                    <div class="rounded-xl border border-dashed px-3 py-3 text-sm transition" [class.border-[#4979e6]]="dragHoverSlotId() === slot.id" [class.bg-[#eef4ff]]="dragHoverSlotId() === slot.id" [class.text-[#3156b3]]="dragHoverSlotId() === slot.id" [class.border-orange-200]="dragHoverSlotId() !== slot.id" [class.bg-orange-50]="dragHoverSlotId() !== slot.id" [class.text-orange-700]="dragHoverSlotId() !== slot.id" *ngIf="!slot.assignments?.length">{{ dragHoverSlotId() === slot.id ? 'Rilascia qui per assegnare il volontario.' : 'Trascina qui un volontario per assegnarlo.' }}</div>
                    <div class="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm" *ngFor="let assignment of slot.assignments">
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                          <p class="truncate font-medium text-slate-900">{{ assignment.assignee?.fullName || 'Assegnazione senza volontario' }}</p>
                          <p class="mt-1 text-xs text-slate-500">{{ assignment.assignee?.email || 'Nessuna mail disponibile' }}</p>
                        </div>
                        <div class="flex flex-wrap justify-end gap-2">
                          <ui-label *ngIf="assignment.replacementApproved" tone="success">replacement</ui-label>
                          <ui-label *ngIf="replacementForAssignment(assignment.id) as replacement" [tone]="replacementTone(replacement.status)">{{ replacement.status }}</ui-label>
                          <button type="button" class="text-xs font-medium text-[#4979e6]" *ngIf="replacementForAssignment(assignment.id) as replacement" (click)="openReplacementAssistant(replacement)">Assistant</button>
                        </div>
                      </div>
                      <div class="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3" *ngIf="replacementForAssignment(assignment.id) as replacement">
                        <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Timeline</p>
                        <div class="mt-2 grid gap-2 text-xs text-slate-600">
                          <div class="flex items-center justify-between gap-3">
                            <span>Originario</span>
                            <span class="font-medium text-slate-800">{{ replacement.requestedBy?.fullName || assignment.assignee?.fullName || '-' }}</span>
                          </div>
                          <div class="flex items-center justify-between gap-3" *ngIf="replacement.replacementAssignee?.fullName">
                            <span>Sostituto</span>
                            <span class="font-medium text-emerald-700">{{ replacement.replacementAssignee?.fullName }}</span>
                          </div>
                          <div class="flex items-center justify-between gap-3" *ngIf="replacement.suggestedReplacement?.fullName">
                            <span>Suggerito</span>
                            <span class="font-medium text-[#4979e6]">{{ replacement.suggestedReplacement?.fullName }} · {{ replacement.suggestedReplacement?.score }}</span>
                          </div>
                        </div>
                      </div>
                      <div class="mt-3 grid gap-2" *ngIf="canRequestReplacement(assignment)">
                        <input class="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none" [(ngModel)]="replacementReason" placeholder="Motivo sostituzione" />
                        <button type="button" class="text-left text-xs font-medium text-orange-700" (click)="requestReplacement(assignment.id)" [disabled]="hasPendingReplacement(assignment.id)">
                          {{ hasPendingReplacement(assignment.id) ? 'Richiesta inviata' : 'Richiedi sostituzione' }}
                        </button>
                      </div>
                      <div class="mt-3 grid gap-2" *ngIf="replacementForAssignment(assignment.id)?.status === 'APPROVED'">
                        <ui-select label="Sostituto" [options]="memberOptionsForTeam(slot.teamId)" [value]="replacementAssigneeId()" (valueChange)="replacementAssigneeId.set(castNullable($event))"></ui-select>
                        <button type="button" class="text-left text-xs font-medium text-emerald-700" (click)="resolveApprovedReplacement(replacementForAssignment(assignment.id)!.id)">Conferma sostituto</button>
                      </div>
                      <div class="mt-3" *ngIf="replacementForAssignment(assignment.id)?.suggestedReplacement?.id && replacementForAssignment(assignment.id)?.status === 'PENDING'">
                        <button type="button" class="text-left text-xs font-medium text-[#4979e6]" (click)="approveReplacementWithSuggestion(replacementForAssignment(assignment.id)!)" [disabled]="locallyReservedSuggestionIds().includes(replacementForAssignment(assignment.id)!.suggestedReplacement!.id)">Approva con suggerito</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <ng-template #noAssignmentEvent>
            <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
              Seleziona prima un evento per aprire la board assegnazioni.
            </div>
          </ng-template>
        </ui-dialog-shell>
      </p-dialog>
    </section>
  `,
})
export class EventsPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  protected readonly live = inject(LiveNotificationsService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);

  protected readonly events = signal<CalendarEvent[]>([]);
  protected readonly teams = signal<TeamOption[]>([]);
  protected readonly replacements = signal<ReplacementItem[]>([]);
  protected readonly previewSuggestions = signal<any[]>([]);
  protected readonly selectedEvent = signal<CalendarEvent | null>(null);
  protected readonly editingEventId = signal<string | null>(null);
  protected readonly assistantReplacement = signal<ReplacementItem | null>(null);
  protected readonly loading = signal(false);
  protected readonly savingEvent = signal(false);
  protected readonly scheduling = signal(false);
  protected readonly locallyReservedSuggestionIds = signal<string[]>([]);
  protected previewVisible = false;
  protected assignmentBoardVisible = false;
  protected eventDialogVisible = false;
  protected eventForm = { title: '', startsAt: null as Date | null, endsAt: null as Date | null, isRecurring: false, slots: [] as EventSlotForm[] };
  protected replacementReason = '';
  protected readonly replacementAssigneeId = signal<string | null>(null);
  protected readonly draggedVolunteerId = signal<string | null>(null);
  protected readonly dragHoverSlotId = signal<string | null>(null);
  protected readonly teamOptions = computed(() => this.teams().map((team) => ({ label: team.name, value: team.id })));
  protected readonly selectedEventSlots = computed(() => this.selectedEvent()?.slots ?? []);
  protected reasonTone(reason: string): 'success' | 'warn' | 'neutral' {
    return reason.includes(':+') ? 'success' : reason.includes(':-') ? 'warn' : 'neutral';
  }

  protected slotDutyOptions(teamId: string | null): Array<{ label: string; value: string }> {
    if (!teamId) {
      return [];
    }

    return (this.teams().find((team) => team.id === teamId)?.duties ?? []).map((duty) => ({ label: duty.name, value: duty.id }));
  }

  protected addEventSlot(): void {
    this.eventForm.slots = [...this.eventForm.slots, this.createEmptySlot(this.eventForm.startsAt, this.eventForm.endsAt)];
  }

  protected removeEventSlot(index: number): void {
    this.eventForm.slots = this.eventForm.slots.filter((_, slotIndex) => slotIndex !== index);
  }

  protected updateSlotTeam(index: number, teamId: string): void {
    const defaultDutyId = this.slotDutyOptions(teamId)[0]?.value ?? '';
    this.eventForm.slots = this.eventForm.slots.map((slot, slotIndex) =>
      slotIndex === index
        ? { ...slot, teamId, dutyId: defaultDutyId }
        : slot
    );
  }

  protected updateSlotDuty(index: number, dutyId: string): void {
    this.eventForm.slots = this.eventForm.slots.map((slot, slotIndex) =>
      slotIndex === index
        ? { ...slot, dutyId }
        : slot
    );
  }

  private createEmptySlot(startsAt: Date | null, endsAt: Date | null): EventSlotForm {
    const defaultTeamId = this.teams()[0]?.id ?? null;
    const defaultDutyId = this.slotDutyOptions(defaultTeamId)[0]?.value ?? '';

    return {
      teamId: defaultTeamId,
      dutyId: defaultDutyId,
      startsAt,
      endsAt,
      required: true,
    };
  }

  protected readonly sortedEvents = computed(() =>
    [...this.events()].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  );

  protected membersForTeam(teamId: string): Array<{ id: string; fullName: string; email: string; role: string }> {
    return this.teams().find((team) => team.id === teamId)?.members ?? [];
  }

  protected isTargetSlot(slot: { teamName?: string; roleName?: string }): boolean {
    const params = this.route.snapshot.queryParamMap;
    const teamName = params.get('team');
    const roleName = params.get('role');
    return Boolean((!teamName || slot.teamName === teamName) && (!roleName || slot.roleName === roleName) && (teamName || roleName));
  }

  protected memberOptionsForTeam(teamId: string): Array<{ label: string; value: string }> {
    return this.membersForTeam(teamId).map((member) => ({ label: member.fullName, value: member.id }));
  }

  protected castNullable(value: unknown): string | null {
    return value ? String(value) : null;
  }

  constructor() {
    this.live.connect();
    this.loadData();
    this.route.queryParamMap.subscribe(() => {
      this.applyRouteContext(this.events());
    });
  }

  isEventFormValid(): boolean {
    return Boolean(
      this.eventForm.title.trim() &&
      this.eventForm.startsAt &&
      this.eventForm.endsAt &&
      this.eventForm.startsAt < this.eventForm.endsAt &&
      this.eventForm.slots.length &&
      this.eventForm.slots.every((slot) =>
        slot.teamId &&
        slot.dutyId.trim() &&
        slot.startsAt &&
        slot.endsAt &&
        slot.startsAt < slot.endsAt &&
        this.eventForm.startsAt &&
        this.eventForm.endsAt &&
        slot.startsAt >= this.eventForm.startsAt &&
        slot.endsAt <= this.eventForm.endsAt
      )
    );
  }

  openEventDialog(): void {
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    this.eventForm = {
      title: '',
      startsAt: now,
      endsAt: end,
      isRecurring: false,
      slots: [this.createEmptySlot(now, end)],
    };
    this.editingEventId.set(null);
    this.eventDialogVisible = true;
  }

  protected openEditEvent(event: CalendarEvent): void {
    this.editingEventId.set(event.id);
    this.eventForm = {
      title: event.title,
      startsAt: new Date(event.startsAt),
      endsAt: new Date(event.endsAt),
      isRecurring: event.type === 'recurring',
      slots: (event.slots ?? []).map((slot) => ({
        teamId: slot.teamId,
        dutyId: slot.dutyId ?? '',
        startsAt: new Date(slot.startsAt ?? event.startsAt),
        endsAt: new Date(slot.endsAt ?? event.endsAt),
        required: true,
      })),
    };
    if (!this.eventForm.slots.length) {
      this.eventForm.slots = [this.createEmptySlot(this.eventForm.startsAt, this.eventForm.endsAt)];
    }
    this.eventDialogVisible = true;
  }

  saveEvent(): void {
    if (!this.isEventFormValid()) {
      this.feedback.error('Evento non valido', 'Completa titolo, intervallo, team e mansione.');
      return;
    }

    const editingEventId = this.editingEventId();
    this.savingEvent.set(true);
    const payload = {
      title: this.eventForm.title.trim(),
      type: (this.eventForm.isRecurring ? 'recurring' : 'single') as 'recurring' | 'single',
      startsAt: toIsoDateTime(this.eventForm.startsAt),
      endsAt: toIsoDateTime(this.eventForm.endsAt),
      recurrenceRule: this.eventForm.isRecurring ? 'FREQ=WEEKLY' : undefined,
      recurrenceTz: this.eventForm.isRecurring ? 'Europe/Rome' : undefined,
      slots: this.eventForm.slots.map((slot) => ({
        teamId: slot.teamId!,
        dutyId: slot.dutyId.trim(),
        startsAt: toIsoDateTime(slot.startsAt),
        endsAt: toIsoDateTime(slot.endsAt),
        required: slot.required,
      })),
    };

    const request = editingEventId
      ? this.api.updateEvent(editingEventId, payload)
      : this.api.createEvent(payload);

    request.subscribe({
      next: () => {
        this.eventDialogVisible = false;
        this.editingEventId.set(null);
        this.savingEvent.set(false);
        this.loadData();
        this.feedback.success(editingEventId ? 'Evento aggiornato' : 'Evento creato', editingEventId ? 'Le modifiche evento sono state sincronizzate.' : 'Evento, slot e copertura iniziale sono stati sincronizzati.');
      },
      error: (error) => {
        this.savingEvent.set(false);
        this.feedback.error(editingEventId ? 'Aggiornamento evento non riuscito' : 'Creazione evento non riuscita', this.apiError.message(error, 'Impossibile salvare l\'evento.'));
      }
    });
  }

  renameEvent(eventId: string, title: string): void {
    if (!title.trim()) {
      return;
    }
    this.api.updateEvent(eventId, { title: title.trim() }).subscribe({
      next: () => {
        this.loadData();
        this.feedback.success('Evento aggiornato');
      },
      error: (error) => this.feedback.error('Aggiornamento non riuscito', this.apiError.message(error, 'Impossibile aggiornare l\'evento.'))
    });
  }

  deleteEvent(eventId: string): void {
    this.api.deleteEvent(eventId).subscribe({
      next: () => {
        this.loadData();
        this.feedback.success('Evento eliminato');
      },
      error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare l\'evento.'))
    });
  }

  selectEvent(event: CalendarEvent): void {
    this.selectedEvent.set(event);
  }

  openAssignmentBoard(): void {
    if (!this.selectedEvent() && this.events().length) {
      this.selectedEvent.set(this.events()[0]);
    }
    this.assignmentBoardVisible = true;
  }

  startDragging(volunteerId: string): void {
    this.draggedVolunteerId.set(volunteerId);
  }

  finishDragging(): void {
    this.draggedVolunteerId.set(null);
    this.dragHoverSlotId.set(null);
  }

  setDragHoverSlot(slotId: string): void {
    if (!this.draggedVolunteerId()) {
      return;
    }
    this.dragHoverSlotId.set(slotId);
  }

  clearDragHoverSlot(slotId: string): void {
    if (this.dragHoverSlotId() === slotId) {
      this.dragHoverSlotId.set(null);
    }
  }

  allowDrop(event: DragEvent, slotId?: string): void {
    event.preventDefault();
    if (slotId && this.draggedVolunteerId()) {
      this.dragHoverSlotId.set(slotId);
    }
  }

  dropVolunteer(slotId: string): void {
    if (!this.draggedVolunteerId()) {
      return;
    }

    const assigneeId = this.draggedVolunteerId()!;
    const slot = this.selectedEventSlots().find((item) => item.id === slotId);
    const assignee = slot ? this.membersForTeam(slot.teamId).find((member) => member.id === assigneeId) ?? null : null;

    this.dragHoverSlotId.set(slotId);
    this.api.assignVolunteer({ slotId, assigneeId, status: 'assigned' }).subscribe({
      next: (assignment) => {
        this.finishDragging();
        if (slot && assignee) {
          this.patchAssignedVolunteer(slotId, {
            id: assignment.id,
            assigneeId,
            status: assignment.status,
            replacementApproved: false,
            assignee: {
              id: assignee.id,
              fullName: assignee.fullName,
            },
          }, assignee.fullName);
        }
        this.feedback.success('Volontario assegnato');
      },
      error: (error) => {
        this.finishDragging();
        this.feedback.error('Assegnazione non riuscita', this.apiError.message(error, 'Impossibile assegnare il volontario allo slot.'));
      }
    });
  }

  autoAssign(): void {
    const selectedTeamId = this.selectedEvent()?.slots?.[0]?.teamId ?? this.eventForm.slots[0]?.teamId ?? undefined;
    this.scheduling.set(true);
    const now = new Date();
    const to = new Date(now);
    to.setDate(to.getDate() + 30);
    this.api.generateSchedulePreview({ from: now.toISOString(), to: to.toISOString(), teamId: selectedTeamId ?? undefined, apply: true }).subscribe({
      next: (result) => {
        this.previewSuggestions.set(result.suggestions ?? []);
        this.previewVisible = true;
        this.scheduling.set(false);
        this.loadData();
        this.feedback.success('Auto assegnazione completata', `Generate ${result.suggestions?.length ?? 0} proposte operative.`);
      },
      error: (error) => {
        this.scheduling.set(false);
        this.feedback.error('Scheduling non riuscito', this.apiError.message(error, 'Impossibile generare il piano automatico.'));
      }
    });
  }

  requestReplacement(assignmentId: string): void {
    if (this.hasPendingReplacement(assignmentId)) {
      return;
    }

    const assignment = this.findAssignmentById(assignmentId);

    this.api.createReplacement({ assignmentId, reason: this.replacementReason.trim() || undefined }).subscribe({
      next: (replacement) => {
        this.replacementReason = '';
        this.patchRequestedReplacement(replacement, assignment);
        this.feedback.success('Richiesta sostituzione inviata');
      },
      error: (error) => this.feedback.error('Richiesta non inviata', this.apiError.message(error, 'Impossibile richiedere la sostituzione.'))
    });
  }

  protected assignReplacement(slotId: string): void {
    const assigneeId = this.replacementAssigneeId();
    if (!assigneeId) {
      return;
    }

    const slot = this.selectedEventSlots().find((item) => item.id === slotId);
    const assignee = slot ? this.membersForTeam(slot.teamId).find((member) => member.id === assigneeId) ?? null : null;

    this.api.assignVolunteer({ slotId, assigneeId, status: 'assigned' }).subscribe({
      next: (assignment) => {
        this.replacementAssigneeId.set(null);
        if (slot && assignee) {
          this.patchAssignedVolunteer(slotId, {
            id: assignment.id,
            assigneeId,
            status: assignment.status,
            replacementApproved: false,
            assignee: {
              id: assignee.id,
              fullName: assignee.fullName,
            },
          }, assignee.fullName);
        }
        this.feedback.success('Sostituto assegnato allo slot');
      },
      error: (error) => this.feedback.error('Assegnazione non riuscita', this.apiError.message(error, 'Impossibile assegnare il sostituto.'))
    });
  }

  protected resolveApprovedReplacement(replacementId: string): void {
    const assigneeId = this.replacementAssigneeId();
    this.api.resolveReplacement(replacementId, { status: 'APPROVED', replacementAssigneeId: assigneeId || undefined }).subscribe({
      next: () => {
        const replacement = this.replacements().find((item) => item.id === replacementId) ?? null;
        const replacementAssignee = assigneeId ? this.findMemberById(assigneeId) : null;
        if (assigneeId) {
          this.locallyReservedSuggestionIds.update((ids) => Array.from(new Set([...ids, assigneeId])));
        }
        this.patchReplacementState(replacementId, 'APPROVED', assigneeId, replacementAssignee);
        if (replacement?.assignmentId && assigneeId) {
          this.patchAssignmentAssignee(replacement.assignmentId, assigneeId, replacementAssignee?.fullName ?? replacement.replacementAssignee?.fullName ?? 'Sostituto');
        }
        this.replacementAssigneeId.set(null);
        this.feedback.success('Sostituzione confermata');
      },
      error: (error) => this.feedback.error('Conferma non riuscita', this.apiError.message(error, 'Impossibile confermare il sostituto.'))
    });
  }

  protected approveReplacementWithSuggestion(replacement: ReplacementItem): void {
    if (!replacement.suggestedReplacement?.id) {
      return;
    }

    this.api.resolveReplacement(replacement.id, { status: 'APPROVED', replacementAssigneeId: replacement.suggestedReplacement.id }).subscribe({
      next: () => {
        this.locallyReservedSuggestionIds.update((ids) => Array.from(new Set([...ids, replacement.suggestedReplacement!.id])));
        this.patchReplacementState(replacement.id, 'APPROVED', replacement.suggestedReplacement!.id, replacement.suggestedReplacement);
        this.patchAssignmentAssignee(replacement.assignmentId, replacement.suggestedReplacement!.id, replacement.suggestedReplacement!.fullName);
        this.feedback.success('Sostituzione approvata con suggerito');
      },
      error: (error) => this.feedback.error('Conferma non riuscita', this.apiError.message(error, 'Impossibile approvare con il sostituto suggerito.'))
    });
  }

  protected openReplacementAssistant(replacement: ReplacementItem): void {
    this.assistantReplacement.set(replacement);
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
        ? `La copertura calendario e gia confermata con ${replacement.replacementAssignee.fullName}.`
        : 'La richiesta e approvata: verifica che lo slot riceva il sostituto definitivo.';
    }

    if (replacement.status === 'DECLINED') {
      return 'La richiesta e stata chiusa senza sostituzione: controlla rapidamente lo slot per evitare buchi di copertura.';
    }

    if (replacement.suggestedReplacement?.fullName) {
      return `Per proteggere la copertura dello slot, ${replacement.suggestedReplacement.fullName} e la prima scelta da confermare.`;
    }

    return 'Non c e un suggerimento automatico forte: verifica disponibilita e conflitti direttamente dal calendario.';
  }

  canRequestReplacement(assignment: { id: string; assignee?: { id?: string | null } | null }): boolean {
    const currentUserId = this.session.getCurrentUser()?.id;
    return Boolean(currentUserId && assignment.assignee?.id === currentUserId);
  }

  hasPendingReplacement(assignmentId: string): boolean {
    return this.replacements().some((replacement) => replacement.assignmentId === assignmentId && replacement.status === 'PENDING');
  }

  replacementForAssignment(assignmentId: string): ReplacementItem | null {
    return this.replacements().find((replacement) => replacement.assignmentId === assignmentId) ?? null;
  }

  replacementTone(status: ReplacementItem['status']): 'success' | 'warn' | 'info' {
    if (status === 'APPROVED') {
      return 'success';
    }

    if (status === 'DECLINED') {
      return 'warn';
    }

    return 'info';
  }

  private loadData(): void {
    this.loading.set(true);
    this.api.events().subscribe({
      next: (events) => {
        this.events.set(events);
        this.applyRouteContext(events);
        if (this.selectedEvent()) {
          const fresh = events.find((event) => event.id === this.selectedEvent()?.id);
          this.selectedEvent.set(fresh ?? null);
        }
      },
      error: (error) => this.feedback.error('Eventi non caricati', this.apiError.message(error, 'Impossibile recuperare gli eventi.'))
    });
    this.api.teams().subscribe({
      next: (teams) => {
        this.teams.set(teams as unknown as TeamOption[]);
        if (!this.eventForm.slots.length) {
          this.eventForm.slots = [this.createEmptySlot(this.eventForm.startsAt, this.eventForm.endsAt)];
          return;
        }

        const defaultTeamId = teams[0]?.id ?? null;
        this.eventForm.slots = this.eventForm.slots.map((slot) => {
          const normalizedTeamId = slot.teamId ?? defaultTeamId;
          const availableDuties = (teams.find((team) => team.id === normalizedTeamId)?.duties ?? []);
          const normalizedDutyId = availableDuties.some((duty) => duty.id === slot.dutyId)
            ? slot.dutyId
            : (availableDuties[0]?.id ?? '');

          return {
            ...slot,
            teamId: normalizedTeamId,
            dutyId: normalizedDutyId,
          };
        });
      },
      error: (error) => this.feedback.error('Team non caricati', this.apiError.message(error, 'Impossibile recuperare i team.'))
    });
    this.api.replacements().subscribe({
      next: (items) => {
        this.replacements.set(items);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.feedback.error('Sostituzioni non caricate', this.apiError.message(error, 'Impossibile recuperare le sostituzioni.'));
      }
    });
  }

  private applyRouteContext(events: CalendarEvent[]): void {
    const params = this.route.snapshot.queryParamMap;
    const eventId = params.get('eventId');
    const teamName = params.get('team');
    const roleName = params.get('role');
    const status = params.get('status');

    let target = eventId ? events.find((event) => event.id === eventId) ?? null : null;
    if (!target && (teamName || roleName || status)) {
      target = events.find((event) =>
        (event.assignments ?? []).some((assignment: any) =>
          (!teamName || assignment.team === teamName) &&
          (!roleName || assignment.roleName === roleName) &&
          (!status || assignment.status === status)
        )
      ) ?? null;
    }

    if (target) {
      this.selectedEvent.set(target);
    }
  }

  private patchReplacementState(
    replacementId: string,
    status: ReplacementItem['status'],
    replacementAssigneeId: string | null,
    replacementAssignee: NonNullable<ReplacementItem['replacementAssignee']> | NonNullable<ReplacementItem['suggestedReplacement']> | null
  ): void {
    const resolvedAt = new Date().toISOString();
    this.replacements.update((items) =>
      items.map((item) =>
        item.id === replacementId
          ? {
              ...item,
              status,
              resolvedAt,
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
            resolvedAt,
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
  }

  private patchAssignmentAssignee(assignmentId: string, assigneeId: string, fullName: string): void {
    this.events.update((events) =>
      events.map((event) => ({
        ...event,
        slots: event.slots?.map((slot) => ({
          ...slot,
          assignments: slot.assignments?.map((assignment) =>
            assignment.id === assignmentId
              ? {
                  ...assignment,
                  assigneeId,
                  status: 'assigned',
                  replacementApproved: true,
                  assignee: {
                    id: assigneeId,
                    fullName,
                  },
                }
              : assignment
          ),
        })),
        assignments: event.assignments?.map((assignment) =>
          assignment.id === assignmentId
            ? {
                ...assignment,
                status: 'assigned',
                assignee: fullName,
              }
            : assignment
        ),
      }))
    );

    const selectedEvent = this.selectedEvent();
    if (selectedEvent) {
      this.selectedEvent.set(this.events().find((event) => event.id === selectedEvent.id) ?? selectedEvent);
    }
  }

  private patchAssignedVolunteer(slotId: string, assignment: AssignmentRecord, fullName: string): void {
    this.events.update((events) =>
      events.map((event) => ({
        ...event,
        slots: event.slots?.map((slot) =>
          slot.id === slotId
            ? {
                ...slot,
                assignments: this.upsertSlotAssignment(slot.assignments ?? [], assignment),
              }
            : slot
        ),
        assignments: event.assignments?.some((item) => item.id === assignment.id)
          ? event.assignments.map((item) =>
              item.id === assignment.id
                ? {
                    ...item,
                    assignee: fullName,
                    status: assignment.status,
                  }
                : item
            )
          : [
              ...(event.assignments ?? []),
              {
                id: assignment.id,
                eventId: event.id,
                slotId,
                roleName: event.slots?.find((slot) => slot.id === slotId)?.roleName,
                team: event.slots?.find((slot) => slot.id === slotId)?.teamName,
                assignee: fullName,
                status: assignment.status,
              },
            ],
      }))
    );

    const selectedEvent = this.selectedEvent();
    if (selectedEvent) {
      this.selectedEvent.set(this.events().find((event) => event.id === selectedEvent.id) ?? selectedEvent);
    }
  }

  private upsertSlotAssignment(assignments: AssignmentRecord[], assignment: AssignmentRecord): AssignmentRecord[] {
    return assignments.some((item) => item.id === assignment.id)
      ? assignments.map((item) => (item.id === assignment.id ? assignment : item))
      : [...assignments, assignment];
  }

  private findAssignmentById(assignmentId: string): { event: CalendarEvent; slot: NonNullable<CalendarEvent['slots']>[number]; assignment: AssignmentRecord } | null {
    for (const event of this.events()) {
      for (const slot of event.slots ?? []) {
        const assignment = (slot.assignments ?? []).find((item) => item.id === assignmentId);
        if (assignment) {
          return { event, slot, assignment };
        }
      }
    }

    return null;
  }

  private patchRequestedReplacement(replacement: ReplacementItem, context: { event: CalendarEvent; slot: NonNullable<CalendarEvent['slots']>[number]; assignment: AssignmentRecord } | null): void {
    this.replacements.update((items) => [replacement, ...items]);

    if (!context) {
      return;
    }

    const selectedEvent = this.selectedEvent();
    if (selectedEvent) {
      this.selectedEvent.set(this.events().find((event) => event.id === selectedEvent.id) ?? selectedEvent);
    }
  }

  private findMemberById(memberId: string): NonNullable<TeamOption['members']>[number] | null {
    return this.teams()
      .flatMap((team) => team.members ?? [])
      .find((member) => member.id === memberId) ?? null;
  }
}
