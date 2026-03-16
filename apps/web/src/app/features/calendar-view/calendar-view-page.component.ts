import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ReplacementItem } from '@shift-complete/shared-types';
import { ApiErrorService } from '../../core/services/api-error.service';
import { SessionService } from '../../core/services/session.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { fromIsoDateTime, toIsoDateTime } from '../../core/utils/date-picker.util';
import { AppApiService, DutyListItem } from '../../shared/services/app-api.service';
import { LiveNotificationsService } from '../../core/services/live-notifications.service';
import {
  UiDialogShellComponent,
  UiLabelComponent,
  UiSelectComponent,
  UiSidebarPanelComponent,
  UiTableShellComponent,
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
    assignments?: Array<{ id: string; assigneeId?: string | null; status: string; replacementApproved?: boolean; assignee?: { id?: string; fullName?: string | null } | null }>;
  }>;
  assignments?: Array<{ id: string; eventId: string; slotId: string; roleName?: string; team?: string; assignee?: string | null; status: string }>;
};

type AssignmentRecord = NonNullable<NonNullable<CalendarEvent['slots']>[number]['assignments']>[number];

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
  selector: 'app-calendar-view-page',
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
    UiTableShellComponent,
    UiLabelComponent,
    RouterLink,
  ],
  template: `
    <section class="grid gap-6">
      <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-teal-700">Calendario</p>
          <h2 class="text-3xl font-semibold tracking-tight text-slate-900">Vista calendario e consultazione operativa degli eventi.</h2>
          <p class="mt-2 max-w-3xl text-sm text-slate-500">Usa questa vista per navigare mese, settimana e agenda. Per creare o gestire eventi completi vai nella workspace eventi.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="rounded-2xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              *ngFor="let option of viewOptions"
              class="rounded-2xl px-4 py-2 text-sm transition"
              [ngClass]="currentView() === option.value ? 'bg-slate-950 text-white' : 'text-slate-600'"
              (click)="currentView.set(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <a routerLink="/events" class="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <i class="pi pi-arrow-right text-xs"></i>
            Apri workspace eventi
          </a>
        </div>
      </header>

      <div class="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div class="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div class="border-b border-slate-100 px-5 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="text-base font-semibold text-slate-800">{{ currentView() === 'month' ? 'Mese in calendario' : currentView() === 'week' ? 'Settimana in calendario' : 'Agenda cronologica' }}</h3>
              <p class="mt-0.5 text-sm text-slate-500">{{ currentView() === 'month' ? monthRangeLabel() : currentView() === 'week' ? weekRangeLabel() : 'Tutti gli eventi ordinati per data' }}</p>
            </div>
            <div class="flex items-center gap-2" *ngIf="currentView() !== 'agenda'">
              <button type="button" class="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-slate-600 hover:bg-slate-50" (click)="navigateCalendar(-1)"><i class="pi pi-chevron-left text-xs"></i></button>
              <button type="button" class="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white" (click)="jumpCalendarToToday()">Oggi</button>
              <span class="min-w-[9rem] text-center text-sm font-medium capitalize text-slate-700">{{ currentView() === 'month' ? monthTitle() : weekTitle() }}</span>
              <button type="button" class="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-slate-600 hover:bg-slate-50" (click)="navigateCalendar(1)"><i class="pi pi-chevron-right text-xs"></i></button>
            </div>
          </div>

          <div class="min-h-[42rem] p-3 sm:p-4" [ngSwitch]="currentView()">
            <ng-container *ngSwitchCase="'month'">
              <div class="overflow-x-auto pb-2">
                <div class="min-w-[42rem]">
                  <div class="mb-3 grid grid-cols-7 gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    <span *ngFor="let label of weekdayLabels">{{ label }}</span>
                  </div>
                  <div class="grid grid-cols-7 gap-2">
                    <div
                      *ngFor="let day of monthCells()"
                      class="min-h-[5.75rem] rounded-2xl border p-2 transition sm:min-h-[7.5rem] sm:p-2.5"
                      [ngClass]="day.inCurrentMonth ? 'border-slate-200 bg-slate-50 hover:bg-white' : 'border-slate-100 bg-white opacity-70'">
                      <div class="mb-2 flex items-center justify-between gap-2">
                        <p class="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold sm:h-7 sm:min-w-7 sm:px-2 sm:text-xs"
                          [ngClass]="day.isToday ? 'bg-blue-600 text-white' : 'text-slate-700'">
                          {{ day.dayNumber }}
                        </p>
                        <span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#4979e6] px-1.5 text-[10px] font-bold text-white" *ngIf="day.events.length">{{ day.events.length }}</span>
                      </div>
                      <div class="grid gap-1 sm:hidden">
                        <button
                          type="button"
                          *ngFor="let event of day.events | slice:0:1"
                          class="truncate rounded-lg border border-orange-200 bg-orange-50 px-1.5 py-1 text-left text-[10px] font-medium text-orange-800 transition hover:bg-orange-100"
                          (click)="selectEvent(event)">
                          {{ event.title }}
                        </button>
                        <div *ngIf="day.events.length > 1" class="px-0.5 text-[10px] font-medium text-slate-400">+{{ day.events.length - 1 }}</div>
                      </div>
                      <div class="hidden gap-1 sm:grid">
                        <button
                          type="button"
                          *ngFor="let event of day.events | slice:0:3"
                          class="truncate rounded-xl border border-orange-200 bg-orange-50 px-2 py-1 text-left text-[10px] font-medium text-orange-800 transition hover:bg-orange-100"
                          (click)="selectEvent(event)">
                          {{ event.title }}
                        </button>
                        <div *ngIf="day.events.length > 3" class="px-1 text-[10px] font-medium text-slate-400">+{{ day.events.length - 3 }} altri</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <ng-container *ngSwitchCase="'week'">
              <div class="overflow-x-auto pb-2">
                <div class="min-w-[42rem]">
                  <div class="mb-3 grid grid-cols-7 gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    <span *ngFor="let label of weekdayLabels">{{ label }}</span>
                  </div>
                  <div class="grid grid-cols-7 gap-2">
                    <div *ngFor="let day of weekDays()" class="flex min-h-[24rem] flex-col rounded-2xl border border-slate-200 bg-slate-50 sm:min-h-[32rem]">
                      <div class="border-b border-slate-200 px-2 py-3 text-center sm:px-3">
                        <p class="text-sm font-semibold text-slate-800">{{ day.dayNumber }}</p>
                        <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400">{{ day.monthLabel }}</p>
                      </div>
                      <div class="flex flex-1 flex-col gap-2 p-2 sm:p-3">
                        <button
                          *ngFor="let event of day.events"
                          type="button"
                          class="rounded-2xl border border-orange-200 bg-orange-50 px-2 py-2 text-left text-[11px] font-medium text-orange-800 transition hover:bg-orange-100 sm:px-3 sm:text-xs"
                          (click)="selectEvent(event)">
                          <p class="truncate font-semibold">{{ event.title }}</p>
                          <p class="mt-1 text-[10px] text-orange-600">{{ event.startsAt | date:'shortTime' }} – {{ event.endsAt | date:'shortTime' }}</p>
                        </button>
                        <div *ngIf="!day.events.length" class="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-xs text-slate-300">—</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <ng-container *ngSwitchDefault>
              <div class="divide-y divide-slate-100 rounded-[20px] border border-slate-100">
                <div *ngFor="let event of sortedEvents()"
                  class="group flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition cursor-pointer"
                  (click)="selectEvent(event)">
                  <div class="flex min-w-12 flex-col items-center justify-center rounded-xl bg-[#4979e6] px-2 py-2 text-center text-white">
                    <span class="text-lg font-light leading-none">{{ event.startsAt | date:'d' }}</span>
                    <span class="mt-0.5 text-[9px] font-semibold uppercase tracking-widest">{{ event.startsAt | date:'MMM' }}</span>
                  </div>
                  <div class="flex-1">
                    <p class="text-sm font-semibold text-slate-800 transition group-hover:text-[#4979e6]">{{ event.title }}</p>
                    <p class="mt-0.5 text-xs text-slate-500">{{ event.startsAt | date:'shortTime' }} – {{ event.endsAt | date:'shortTime' }}</p>
                    <div class="mt-2 flex flex-wrap gap-1.5">
                      <span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{{ event.type }}</span>
                      <span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium"
                        [class.bg-emerald-50]="(event.assignments?.length || 0) > 0"
                        [class.text-emerald-700]="(event.assignments?.length || 0) > 0"
                        [class.border-emerald-200]="(event.assignments?.length || 0) > 0"
                        [class.bg-amber-50]="(event.assignments?.length || 0) === 0"
                        [class.text-amber-700]="(event.assignments?.length || 0) === 0"
                        [class.border-amber-200]="(event.assignments?.length || 0) === 0">
                        {{ (event.assignments?.length || 0) > 0 ? 'Coperto' : 'Da coprire' }}
                      </span>
                    </div>
                  </div>
                  <i class="pi pi-chevron-right mt-1 text-slate-300 transition group-hover:text-[#4979e6]"></i>
                </div>
                <div *ngIf="!events().length" class="px-5 py-12 text-center text-sm text-slate-400">
                  <i class="pi pi-calendar mb-2 block text-3xl opacity-40"></i>
                  Nessun evento in agenda.
                </div>
              </div>
            </ng-container>
          </div>
        </div>

        <div class="grid gap-4">
          <ui-sidebar-panel title="Dettaglio evento" eyebrow="Vista consultazione">
            <div *ngIf="selectedEvent() as event; else noEvent" class="grid gap-4">
            <div>
              <p class="text-sm font-medium text-slate-900">{{ event.title }}</p>
              <p class="mt-1 text-xs text-slate-500">Per modificare evento, assegnazioni o replacement apri la workspace eventi dedicata.</p>
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
            <a routerLink="/events" [queryParams]="{ eventId: event.id }" class="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              <i class="pi pi-calendar text-xs"></i>
              Gestisci evento
            </a>
            </div>
            <ng-template #noEvent>
              <p class="text-sm text-slate-500">Seleziona un evento dal calendario oppure apri la workspace eventi per gestire il CRUD completo.</p>
            </ng-template>
          </ui-sidebar-panel>

          <ui-sidebar-panel title="Replacement assistant" eyebrow="Calendar board">
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
              <div class="flex gap-2">
                <a routerLink="/events" class="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">Apri workspace eventi</a>
                <button type="button" class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600" (click)="assistantReplacement.set(null)">Chiudi</button>
              </div>
            </div>
            <ng-template #noReplacementAssistant>
              <p class="text-sm text-slate-500">Apri una replacement dalla timeline o dalla board per vedere stato, priorita operativa, ranking candidati e azione consigliata.</p>
            </ng-template>
          </ui-sidebar-panel>
        </div>
      </div>

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
        <ui-dialog-shell title="Board assegnazioni" eyebrow="Drag and drop" subtitle="Gestisci assegnazioni, replacement e copertura del servizio in un'unica board." icon="pi pi-directions-alt" tone="info">
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
export class CalendarViewPageComponent {
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
  protected readonly duties = signal<DutyListItem[]>([]);
  protected readonly selectedEvent = signal<CalendarEvent | null>(null);
  protected readonly assistantReplacement = signal<ReplacementItem | null>(null);
  protected readonly loading = signal(false);
  protected readonly savingEvent = signal(false);
  protected readonly scheduling = signal(false);
  protected readonly selectedDutyOption = signal<Record<string, unknown> | null>(null);
  protected readonly locallyReservedSuggestionIds = signal<string[]>([]);
  protected readonly currentView = signal('month');
  protected readonly calendarCursor = signal(this.startOfDay(new Date()));
  protected previewVisible = false;
  protected assignmentBoardVisible = false;
  protected eventDialogVisible = false;
  protected eventForm = { title: '', startsAt: null as Date | null, endsAt: null as Date | null, teamId: null as string | null, dutyId: '', isRecurring: false };
  protected replacementReason = '';
  protected readonly replacementAssigneeId = signal<string | null>(null);
  protected readonly draggedVolunteerId = signal<string | null>(null);
  protected readonly dragHoverSlotId = signal<string | null>(null);
  protected readonly viewOptions = [
    { label: 'Mese', value: 'month' },
    { label: 'Settimana', value: 'week' },
    { label: 'Agenda', value: 'agenda' },
  ];
  protected readonly weekdayLabels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  protected readonly teamOptions = computed(() => this.teams().map((team) => ({ label: team.name, value: team.id })));
  protected readonly dutyOptions = computed(() =>
    this.duties().map((duty) => ({
      label: duty.name,
      value: duty.id,
      teamId: duty.teamId,
      icon: duty.icon,
      color: duty.color,
    }))
  );
  protected readonly eventsByDate = computed(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    for (const event of this.events()) {
      const key = this.dateKey(new Date(event.startsAt));
      grouped[key] ??= [];
      grouped[key].push(event);
    }
    return grouped;
  });
  protected readonly monthTitle = computed(() =>
    this.formatMonthYear(this.calendarCursor())
  );
  protected readonly monthRangeLabel = computed(() => {
    const cursor = this.calendarCursor();
    return `Distribuzione eventi e copertura di ${this.formatMonthYear(cursor)} · ${this.visibleMonthEventCount()} eventi visibili`;
  });
  protected readonly weekTitle = computed(() => {
    const weekStart = this.startOfWeek(this.calendarCursor());
    const weekEnd = this.addDays(weekStart, 6);
    return `${weekStart.getDate()} ${this.formatMonthShort(weekStart)} - ${weekEnd.getDate()} ${this.formatMonthShort(weekEnd)}`;
  });
  protected readonly weekRangeLabel = computed(() => `Panoramica operativa dei 7 giorni correnti · ${this.visibleWeekEventCount()} eventi visibili`);
  protected readonly monthCells = computed(() => {
    const monthStart = this.startOfMonth(this.calendarCursor());
    const gridStart = this.startOfWeek(monthStart);
    return Array.from({ length: 42 }, (_, index) => {
      const date = this.addDays(gridStart, index);
      const key = this.dateKey(date);
      return {
        date,
        dayNumber: date.getDate(),
        inCurrentMonth: date.getMonth() === monthStart.getMonth(),
        isToday: this.isSameDate(date, new Date()),
        events: this.eventsByDate()[key] ?? [],
      };
    });
  });
  protected readonly weekDays = computed(() => {
    const weekStart = this.startOfWeek(this.calendarCursor());
    return Array.from({ length: 7 }, (_, index) => {
      const date = this.addDays(weekStart, index);
      return {
        date,
        dayNumber: date.getDate(),
        monthLabel: this.formatMonthShort(date),
        events: this.eventsByDate()[this.dateKey(date)] ?? [],
      };
    });
  });
  protected readonly selectedEventSlots = computed(() => this.selectedEvent()?.slots ?? []);
  protected reasonTone(reason: string): 'success' | 'warn' | 'neutral' {
    return reason.includes(':+') ? 'success' : reason.includes(':-') ? 'warn' : 'neutral';
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

  protected navigateCalendar(direction: -1 | 1): void {
    if (this.currentView() === 'month') {
      this.calendarCursor.update((current) => this.addMonths(current, direction));
      return;
    }

    if (this.currentView() === 'week') {
      this.calendarCursor.update((current) => this.addDays(current, direction * 7));
    }
  }

  protected jumpCalendarToToday(): void {
    this.calendarCursor.set(this.startOfDay(new Date()));
  }

  private dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private startOfWeek(date: Date): Date {
    const normalized = this.startOfDay(date);
    const day = normalized.getDay() || 7;
    normalized.setDate(normalized.getDate() - day + 1);
    return normalized;
  }

  private addDays(date: Date, amount: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  private addMonths(date: Date, amount: number): Date {
    const next = new Date(date);
    next.setMonth(next.getMonth() + amount, 1);
    return next;
  }

  private isSameDate(left: Date, right: Date): boolean {
    return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  }

  private formatMonthYear(date: Date): string {
    return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(date);
  }

  private formatMonthShort(date: Date): string {
    return new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(date).replace('.', '');
  }

  private eventsInCurrentMonth(): CalendarEvent[] {
    const cursor = this.calendarCursor();
    return this.events().filter((event) => {
      const date = new Date(event.startsAt);
      return date.getMonth() === cursor.getMonth() && date.getFullYear() === cursor.getFullYear();
    });
  }

  private eventsInCurrentWeek(): CalendarEvent[] {
    const start = this.startOfWeek(this.calendarCursor());
    const end = this.addDays(start, 7);
    return this.events().filter((event) => {
      const date = new Date(event.startsAt);
      return date >= start && date < end;
    });
  }

  protected readonly visibleMonthEventCount = computed(() => this.eventsInCurrentMonth().length);
  protected readonly visibleWeekEventCount = computed(() => this.eventsInCurrentWeek().length);

  constructor() {
    this.live.connect();
    this.loadData();
    this.route.queryParamMap.subscribe(() => {
      this.applyRouteContext(this.events());
    });
  }

  isEventFormValid(): boolean {
    return Boolean(this.eventForm.title.trim() && this.eventForm.startsAt && this.eventForm.endsAt && this.eventForm.teamId && this.eventForm.dutyId.trim() && this.eventForm.startsAt < this.eventForm.endsAt);
  }

  openEventDialog(): void {
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const firstTeam = this.teams()[0]?.id ?? null;
    this.eventForm = {
      title: '',
      startsAt: now,
      endsAt: end,
      teamId: firstTeam,
      dutyId: '',
      isRecurring: false,
    };
    this.selectedDutyOption.set(null);
    if (firstTeam) {
      this.loadDuties(firstTeam);
    }
    this.eventDialogVisible = true;
  }

  onTeamChange(teamId: unknown): void {
    this.eventForm.teamId = String(teamId || '');
    this.eventForm.dutyId = '';
    this.selectedDutyOption.set(null);
    if (this.eventForm.teamId) {
      this.loadDuties(this.eventForm.teamId);
    }
  }

  onDutySelected(option: unknown): void {
    const selected = (option as Record<string, unknown> | null) ?? null;
    this.selectedDutyOption.set(selected);
    this.eventForm.dutyId = String(selected?.['value'] ?? '');
  }

  saveEvent(): void {
    if (!this.isEventFormValid()) {
      this.feedback.error('Evento non valido', 'Completa titolo, intervallo, team e mansione.');
      return;
    }

    this.savingEvent.set(true);
    this.api.createEvent({
      title: this.eventForm.title.trim(),
      type: this.eventForm.isRecurring ? 'recurring' : 'single',
      startsAt: toIsoDateTime(this.eventForm.startsAt),
      endsAt: toIsoDateTime(this.eventForm.endsAt),
      recurrenceRule: this.eventForm.isRecurring ? 'FREQ=WEEKLY' : undefined,
      recurrenceTz: this.eventForm.isRecurring ? 'Europe/Rome' : undefined,
      slots: [
        {
          teamId: this.eventForm.teamId!,
          dutyId: this.eventForm.dutyId.trim(),
          startsAt: toIsoDateTime(this.eventForm.startsAt),
          endsAt: toIsoDateTime(this.eventForm.endsAt),
          required: true,
        },
      ],
    }).subscribe({
      next: () => {
        this.eventDialogVisible = false;
        this.savingEvent.set(false);
        this.loadData();
        this.feedback.success('Evento creato', 'Evento, slot e copertura iniziale sono stati sincronizzati.');
      },
      error: (error) => {
        this.savingEvent.set(false);
        this.feedback.error('Creazione evento non riuscita', this.apiError.message(error, 'Impossibile creare l\'evento.'));
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
    const selectedTeamId = this.selectedEvent()?.slots?.[0]?.teamId ?? this.eventForm.teamId ?? undefined;
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
        const activeTeamId = this.eventForm.teamId ?? teams[0]?.id;
        if (activeTeamId) {
          this.loadDuties(activeTeamId);
        }
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

  private loadDuties(teamId: string): void {
    this.api.duties(teamId).subscribe({
      next: (duties) => this.duties.set(duties),
      error: (error) => this.feedback.error('Mansioni non caricate', this.apiError.message(error, 'Impossibile recuperare le mansioni del team.'))
    });
  }

  private applyRouteContext(events: CalendarEvent[]): void {
    const params = this.route.snapshot.queryParamMap;
    const eventId = params.get('eventId');
    const teamName = params.get('team');
    const roleName = params.get('role');
    const status = params.get('status');

    if (status === 'open') {
      this.currentView.set('agenda');
    }

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
      this.currentView.set('agenda');
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
