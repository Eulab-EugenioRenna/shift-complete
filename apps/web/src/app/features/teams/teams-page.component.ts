import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ReplacementItem, TeamAccessRequestItem, TeamListItem, UserProfile } from '@shift-complete/shared-types';
import {
  UiCardComponent,
  UiDialogShellComponent,
  UiLabelComponent,
  UiSelectComponent,
  UiSidebarPanelComponent,
  UiTableShellComponent,
} from '@shift-complete/ui-kit';
import { AuthApiService } from '../../core/services/auth-api.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { AppApiService } from '../../shared/services/app-api.service';

type TeamDuty = NonNullable<TeamListItem['duties']>[number];

@Component({
  selector: 'app-teams-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    UiCardComponent,
    UiTableShellComponent,
    UiLabelComponent,
    UiSelectComponent,
    UiSidebarPanelComponent,
    UiDialogShellComponent,
  ],
  template: `
    <section class="max-w-7xl mx-auto flex flex-col gap-6">
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between py-2">
        <div>
          <p class="text-sm font-semibold uppercase tracking-widest text-orange-500">Team e mansioni</p>
          <h2 class="mt-1 text-2xl font-semibold tracking-tight text-slate-800">Workspace team, duty inline e richieste di sostituzione in arrivo.</h2>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button type="button" class="rounded-md bg-[#4979e6] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition flex items-center gap-2" (click)="openTeamDialog()">
            <i class="pi pi-plus text-xs"></i> Nuovo team
          </button>
          <button type="button" class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition flex items-center gap-2" (click)="openDutyDialog()">
            <i class="pi pi-briefcase text-xs"></i> Nuova mansione
          </button>
        </div>
      </header>

      <!-- Team Selector Strip -->
      <div class="bg-white rounded-lg border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-2 flex-wrap" *ngIf="teams().length">
        <span class="text-xs font-semibold uppercase tracking-widest text-slate-400 mr-2">Team:</span>
        <button *ngFor="let team of teams()" type="button"
          class="px-3 py-1.5 rounded-full text-sm font-medium border transition"
          [class.bg-[#4979e6]]="selectedTeam()?.id === team.id"
          [class.text-white]="selectedTeam()?.id === team.id"
          [class.border-[#4979e6]]="selectedTeam()?.id === team.id"
          [class.bg-white]="selectedTeam()?.id !== team.id"
          [class.text-slate-700]="selectedTeam()?.id !== team.id"
          [class.border-slate-300]="selectedTeam()?.id !== team.id"
          [class.hover:bg-slate-50]="selectedTeam()?.id !== team.id"
          (click)="selectTeam(team)">
          {{ team.name }}
          <span class="ml-1 text-xs opacity-70">({{ team.memberCount || 0 }})</span>
        </button>
        <button *ngIf="selectedTeam()" type="button" class="ml-auto text-xs text-slate-400 hover:text-slate-600 transition" (click)="selectedTeam.set(null)">
          <i class="pi pi-times mr-1"></i>Deseleziona
        </button>
      </div>

      <div class="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <!-- LEFT COLUMN: Team list -->
        <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div class="border-b border-slate-100 px-5 py-4">
            <h3 class="text-base font-semibold text-slate-800">Team attivi</h3>
            <p class="text-sm text-slate-500 mt-0.5">{{ teams().length }} team con mansioni e leadership assegnata</p>
          </div>
          <div class="divide-y divide-slate-100">
            <div *ngFor="let team of teams()" class="px-5 py-4 hover:bg-slate-50 transition cursor-pointer"
              [class.bg-blue-50]="selectedTeam()?.id === team.id"
              [class.border-l-2]="selectedTeam()?.id === team.id"
              [class.border-[#4979e6]]="selectedTeam()?.id === team.id"
              (click)="selectTeam(team)">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1">
                  <p class="font-semibold text-slate-800">{{ team.name }}</p>
                  <p class="text-xs text-slate-500 mt-0.5">Leader: {{ team.leader?.fullName || 'Da nominare' }}</p>
                  <p class="text-xs text-slate-400 mt-0.5" *ngIf="team.description">{{ team.description }}</p>
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      {{ team.memberCount || 0 }} volontari
                    </span>
                    <span *ngFor="let duty of (team.duties || []).slice(0, 3)"
                      class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      {{ duty.name }}
                    </span>
                    <span *ngIf="(team.duties || []).length > 3"
                      class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200">
                      +{{ (team.duties || []).length - 3 }} altri
                    </span>
                    <span *ngIf="!(team.duties || []).length" class="text-xs text-slate-400 italic">Nessuna mansione</span>
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button type="button" class="p-1.5 rounded-md text-slate-400 hover:text-[#4979e6] hover:bg-blue-50 transition" title="Modifica" (click)="editTeam(team); $event.stopPropagation()">
                    <i class="pi pi-pencil text-xs"></i>
                  </button>
                  <button type="button" class="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition" title="Elimina" (click)="deleteTeam(team.id); $event.stopPropagation()">
                    <i class="pi pi-trash text-xs"></i>
                  </button>
                </div>
              </div>
            </div>
            <div *ngIf="!teams().length" class="px-5 py-12 text-center text-slate-400 text-sm">
              <i class="pi pi-users text-3xl mb-2 block opacity-40"></i>
              Nessun team ancora creato.
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Team management panel -->
        <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden sticky top-4 self-start">
          <ng-container *ngIf="selectedTeam() as team; else noTeam">
            <!-- Panel header -->
            <div class="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <div class="flex-1">
                <p class="text-xs font-semibold uppercase tracking-widest text-slate-400">Inline management</p>
                <h3 class="text-base font-semibold text-slate-800 mt-0.5">{{ team.name }}</h3>
                <p class="text-xs text-slate-500 mt-0.5">Leader: {{ team.leader?.fullName || 'Da nominare' }}</p>
              </div>
              <button type="button" class="rounded-md border border-[#4979e6] px-3 py-1.5 text-xs font-medium text-[#4979e6] hover:bg-blue-50 transition flex items-center gap-1.5" (click)="openDutyDialog(team)">
                <i class="pi pi-plus text-[10px]"></i> Mansione
              </button>
            </div>

            <!-- Members Section -->
            <div class="px-5 py-4 border-b border-slate-100">
              <div class="flex items-center justify-between mb-3">
                <p class="text-sm font-semibold text-slate-700">Persone nel team</p>
                <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  {{ team.members?.length || 0 }} membri
                </span>
              </div>
              <p class="text-xs text-slate-500 mb-2">Aggiungi persone disponibili al workspace del team.</p>
              <div class="flex gap-2">
                <select class="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white focus:border-[#4979e6] focus:outline-none focus:ring-1 focus:ring-[#4979e6] transition"
                  (change)="selectedMemberOption.set({ value: $any($event.target).value, label: '' })">
                  <option value="">— seleziona utente —</option>
                  <option *ngFor="let opt of availableUserOptions(team.id)" [value]="opt['value']">{{ opt['label'] }}</option>
                </select>
                <button type="button" class="rounded-md bg-[#4979e6] px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
                  (click)="addMemberToSelectedTeam()" [disabled]="!selectedMemberUserId()">
                  <i class="pi pi-user-plus"></i>
                </button>
              </div>
              <!-- Member chips -->
              <div class="mt-3 flex flex-wrap gap-1.5">
                <div *ngFor="let member of team.members || []"
                  class="group inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  <span>{{ member.fullName }}</span>
                  <button type="button" class="text-slate-400 hover:text-red-600 transition rounded-full p-0.5" (click)="removeMemberFromSelectedTeam(member.id)" title="Rimuovi">
                    <i class="pi pi-times text-[9px]"></i>
                  </button>
                </div>
                <span *ngIf="!(team.members || []).length" class="text-xs text-slate-400 italic">Nessuna persona assegnata.</span>
              </div>
            </div>

            <!-- Duties Section -->
            <div class="px-5 py-4 border-b border-slate-100">
              <p class="text-sm font-semibold text-slate-700 mb-3">Mansioni team</p>
              <div class="overflow-x-auto -mx-1">
                <table class="min-w-full text-sm">
                  <thead class="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nome</th>
                      <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Colore</th>
                      <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let duty of team.duties || []" class="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td class="px-3 py-2 font-medium text-slate-800">{{ duty.name }}</td>
                      <td class="px-3 py-2">
                        <span *ngIf="duty.color" class="inline-block h-3 w-3 rounded-full border border-slate-200" [style.background]="duty.color || '#e2e8f0'"></span>
                        <span *ngIf="!duty.color" class="text-slate-400 text-xs">—</span>
                      </td>
                      <td class="px-3 py-2 text-right">
                        <button type="button" class="text-xs text-[#4979e6] hover:underline mr-2" (click)="editDuty(team, duty)">Modifica</button>
                        <button type="button" class="text-xs text-red-600 hover:underline" (click)="deleteDuty(duty.id)">Elimina</button>
                      </td>
                    </tr>
                    <tr *ngIf="!(team.duties || []).length">
                      <td colspan="3" class="px-3 py-5 text-center text-xs text-slate-400">Nessuna mansione ancora collegata.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Join Request Section -->
            <div class="px-5 py-4">
              <p class="text-sm font-semibold text-slate-700">Invita utente nel team</p>
              <p class="text-xs text-slate-500 mt-0.5 mb-2">Richiedi che un utente del workspace entri nel team.</p>
              <div class="flex gap-2">
                <select class="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white focus:border-[#4979e6] focus:outline-none focus:ring-1 focus:ring-[#4979e6] transition"
                  (change)="selectedJoinRequestOption.set({ value: $any($event.target).value, label: '' })">
                  <option value="">— seleziona utente —</option>
                  <option *ngFor="let opt of availableUserOptions(team.id)" [value]="opt['value']">{{ opt['label'] }}</option>
                </select>
                <button type="button" class="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition disabled:opacity-50"
                  (click)="requestJoinForSelectedTeam()" [disabled]="!selectedJoinRequestUserId()">
                  <i class="pi pi-send"></i>
                </button>
              </div>
            </div>
          </ng-container>

          <ng-template #noTeam>
            <div class="px-5 py-12 text-center text-slate-400">
              <i class="pi pi-users text-3xl mb-3 block opacity-40"></i>
              <p class="text-sm font-medium">Nessun team selezionato</p>
              <p class="text-xs mt-1">Seleziona un team per gestirne le mansioni e i membri.</p>
            </div>
          </ng-template>
        </div>
      </div>

      <div class="grid gap-6 md:grid-cols-3">
        <div class="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <p class="text-sm font-semibold text-slate-700">Replacement pending</p>
          <p class="mt-3 text-3xl font-light tracking-tight text-slate-800">{{ pendingReplacements() }}</p>
          <p class="mt-1 text-xs text-slate-500">richieste che aspettano una decisione</p>
        </div>
        <div class="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <p class="text-sm font-semibold text-slate-700">Coperture recuperate</p>
          <p class="mt-3 text-3xl font-light tracking-tight text-emerald-700">{{ recoveredReplacements() }}</p>
          <p class="mt-1 text-xs text-slate-500">replacement approvate con sostituto assegnato</p>
        </div>
        <div class="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <p class="text-sm font-semibold text-slate-700">Azioni team aperte</p>
          <p class="mt-3 text-3xl font-light tracking-tight text-orange-600">{{ pendingReplacements() + pendingTeamRequests() }}</p>
          <p class="mt-1 text-xs text-slate-500">somma tra richieste team e sostituzioni aperte</p>
        </div>
      </div>

      <ui-card title="Richieste sostituzione" subtitle="Workflow operativo per team leader e amministratore">
        <div class="mb-4 flex items-center gap-2">
          <ui-label [tone]="highlightedTab() === 'replacements' ? 'info' : 'neutral'">Replacement</ui-label>
          <ui-label [tone]="highlightedTab() === 'requests' ? 'info' : 'neutral'">Team requests</ui-label>
        </div>
        <div class="grid gap-4 xl:grid-cols-[1fr_320px]">
          <ui-table-shell>
            <table class="min-w-full text-sm">
              <thead class="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th class="px-4 py-3">Evento</th>
                  <th class="px-4 py-3">Richiedente</th>
                  <th class="px-4 py-3">Mansione</th>
                  <th class="px-4 py-3">Stato</th>
                  <th class="px-4 py-3">Azione</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let replacement of replacements()" class="border-t border-slate-100">
                  <td class="px-4 py-3">{{ replacement.assignment?.slot?.event?.title || '-' }}</td>
                  <td class="px-4 py-3">{{ replacement.requestedBy?.fullName || replacement.assignment?.assignee?.fullName || '-' }}</td>
                  <td class="px-4 py-3">{{ replacement.assignment?.slot?.duty?.name || '-' }}</td>
                  <td class="px-4 py-3">
                    <ui-label [tone]="replacement.status === 'APPROVED' ? 'success' : (replacement.status === 'DECLINED' ? 'warn' : 'info')">{{ replacement.status }}</ui-label>
                  </td>
                  <td class="px-4 py-3">
                    <div class="mb-2 flex items-center gap-2 text-xs text-slate-500" *ngIf="replacement.suggestedReplacement">
                      <span>Suggerito: {{ replacement.suggestedReplacement?.fullName }} · score {{ replacement.suggestedReplacement?.score }}</span>
                      <button type="button" class="font-medium text-[#4979e6]" (click)="openReplacementAssistant(replacement)">Assistant</button>
                    </div>
                    <ui-select *ngIf="replacement.status === 'PENDING'" [options]="replacementOptions(replacement)" [value]="replacementAssigneeSelection[replacement.id]" (valueChange)="replacementAssigneeSelection[replacement.id] = castString($event)"></ui-select>
                    <button type="button" class="text-sm text-emerald-700" (click)="resolveReplacement(replacement.id, 'APPROVED')" [disabled]="replacement.status !== 'PENDING'">Approva</button>
                    <button type="button" class="ml-3 text-sm text-[#4979e6]" (click)="approveReplacementWithSuggestion(replacement)" [disabled]="!replacement.suggestedReplacement?.id || locallyReservedSuggestionIds().includes(replacement.suggestedReplacement.id) || replacement.status !== 'PENDING'">Approva con suggerito</button>
                    <button type="button" class="ml-3 text-sm text-red-600" (click)="resolveReplacement(replacement.id, 'DECLINED')" [disabled]="replacement.status !== 'PENDING'">Rifiuta</button>
                    <div class="mt-2 text-xs text-slate-500" *ngIf="replacement.replacementAssignee?.fullName">Sostituto: {{ replacement.replacementAssignee?.fullName }}</div>
                  </td>
                </tr>
                <tr *ngIf="!replacements().length">
                  <td colspan="5" class="px-4 py-6 text-center text-sm text-slate-400">Nessuna richiesta di sostituzione aperta.</td>
                </tr>
              </tbody>
            </table>
          </ui-table-shell>

          <ui-sidebar-panel title="Replacement assistant" eyebrow="Team workspace">
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
              <p class="text-sm text-slate-500">Apri una replacement con suggerimento per vedere stato, priorita operativa, ranking candidati e azione consigliata.</p>
            </ng-template>
          </ui-sidebar-panel>
        </div>
      </ui-card>

      <ui-card #teamRequestsSection title="Richieste team" subtitle="Approvazioni signup e inserimenti nel team">
        <ui-table-shell>
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-left text-slate-500">
              <tr>
                <th class="px-4 py-3">Team</th>
                <th class="px-4 py-3">Persona</th>
                <th class="px-4 py-3">Tipo</th>
                <th class="px-4 py-3">Stato</th>
                <th class="px-4 py-3">Azione</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let request of teamRequests()" class="border-t border-slate-100">
                <td class="px-4 py-3">{{ request.team?.name || '-' }}</td>
                <td class="px-4 py-3">{{ request.targetUser?.fullName || request.fullName || request.email || '-' }}</td>
                <td class="px-4 py-3">{{ request.kind }}</td>
                <td class="px-4 py-3"><ui-label [tone]="request.status === 'APPROVED' ? 'success' : (request.status === 'DECLINED' ? 'warn' : 'info')">{{ request.status }}</ui-label></td>
                <td class="px-4 py-3">
                  <button type="button" class="text-sm text-emerald-700" (click)="approveTeamRequest(request)" [disabled]="request.status !== 'PENDING'">Approva</button>
                  <button type="button" class="ml-3 text-sm text-red-600" (click)="declineTeamRequest(request)" [disabled]="request.status !== 'PENDING'">Rifiuta</button>
                </td>
              </tr>
              <tr *ngIf="!teamRequests().length">
                <td colspan="5" class="px-4 py-6 text-center text-sm text-slate-400">Nessuna richiesta team disponibile.</td>
              </tr>
            </tbody>
          </table>
        </ui-table-shell>
      </ui-card>

      <p-dialog [(visible)]="teamDialogVisible" [modal]="true" [appendTo]="'body'" [baseZIndex]="1200" [blockScroll]="true" [dismissableMask]="true" [closeOnEscape]="true" [focusOnShow]="false" [style]="{ width: '38rem', maxWidth: '95vw' }" [contentStyle]="{ background: 'transparent', padding: '0', overflow: 'visible' }" [draggable]="false" [resizable]="false">
        <ui-dialog-shell title="Team" eyebrow="Workspace config" subtitle="Configura identita, descrizione e responsabilita del team." icon="pi pi-users" tone="info" [hasFooter]="true">
          <div class="grid gap-4">
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">Nome team</label>
              <input class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="teamForm.name" placeholder="Nome team" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">Descrizione</label>
              <textarea class="min-h-28 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="teamForm.description" placeholder="Descrizione"></textarea>
            </div>
            <ui-select label="Leader servizio" [options]="leaderOptions()" [value]="teamForm.leaderId" (valueChange)="teamForm.leaderId = castNullable($event)"></ui-select>
          </div>
          <div dialog-footer class="flex justify-end gap-2">
            <button pButton type="button" label="Annulla" [text]="true" (click)="teamDialogVisible = false"></button>
            <button pButton type="button" [label]="editingTeamId() ? 'Salva' : 'Crea'" (click)="saveTeam()" [disabled]="!teamForm.name.trim()"></button>
          </div>
        </ui-dialog-shell>
      </p-dialog>

      <p-dialog [(visible)]="dutyDialogVisible" [modal]="true" [appendTo]="'body'" [baseZIndex]="1200" [blockScroll]="true" [dismissableMask]="true" [closeOnEscape]="true" [focusOnShow]="false" [style]="{ width: '40rem', maxWidth: '95vw' }" [contentStyle]="{ background: 'transparent', padding: '0', overflow: 'visible' }" [draggable]="false" [resizable]="false">
        <ui-dialog-shell title="Mansione team" eyebrow="Duty CRUD" subtitle="Definisci ruolo operativo, colore e semantica visiva della mansione." icon="pi pi-briefcase" tone="info" [hasFooter]="true">
          <div class="grid gap-4">
            <ui-select label="Team" [options]="teamOptions()" [value]="dutyForm.teamId" (valueChange)="dutyForm.teamId = castString($event)"></ui-select>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">Nome mansione</label>
              <input class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="dutyForm.name" placeholder="Es. Audio, Luci, Accoglienza" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">Descrizione</label>
              <input class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="dutyForm.description" placeholder="Descrizione operativa" />
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="grid gap-2">
                <label class="text-sm font-medium text-slate-700">Colore</label>
                <input class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="dutyForm.color" placeholder="#0f766e" />
              </div>
              <div class="grid gap-2">
                <label class="text-sm font-medium text-slate-700">Icona</label>
                <input class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="dutyForm.icon" placeholder="pi pi-volume-up" />
              </div>
            </div>
          </div>
          <div dialog-footer class="flex justify-end gap-2">
            <button pButton type="button" label="Annulla" [text]="true" (click)="dutyDialogVisible = false"></button>
            <button pButton type="button" [label]="editingDutyId() ? 'Salva mansione' : 'Crea mansione'" (click)="saveDuty()" [disabled]="!dutyForm.teamId || !dutyForm.name.trim()"></button>
          </div>
        </ui-dialog-shell>
      </p-dialog>
    </section>
  `,
})
export class TeamsPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly authApi = inject(AuthApiService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly route = inject(ActivatedRoute);

  protected readonly teams = signal<TeamListItem[]>([]);
  protected readonly leaders = signal<UserProfile[]>([]);
  protected readonly people = signal<UserProfile[]>([]);
  protected readonly replacements = signal<ReplacementItem[]>([]);
  protected readonly teamRequests = signal<TeamAccessRequestItem[]>([]);
  protected readonly selectedTeam = signal<TeamListItem | null>(null);
  protected readonly editingTeamId = signal<string | null>(null);
  protected readonly editingDutyId = signal<string | null>(null);
  protected readonly selectedMemberOption = signal<Record<string, unknown> | null>(null);
  protected readonly selectedJoinRequestOption = signal<Record<string, unknown> | null>(null);
  protected readonly leaderOptions = computed(() => this.leaders().map((user) => ({ label: user.fullName, value: user.id })));
  protected readonly teamOptions = computed(() => this.teams().map((team) => ({ label: team.name, value: team.id })));
  protected readonly pendingReplacements = computed(() => this.replacements().filter((replacement) => replacement.status === 'PENDING').length);
  protected readonly recoveredReplacements = computed(() => this.replacements().filter((replacement) => replacement.status === 'APPROVED' && replacement.replacementAssigneeId).length);
  protected readonly pendingTeamRequests = computed(() => this.teamRequests().filter((request) => request.status === 'PENDING').length);

  protected teamDialogVisible = false;
  protected dutyDialogVisible = false;
  protected teamForm = { name: '', description: '', leaderId: null as string | null };
  protected dutyForm = { teamId: '', name: '', description: '', color: '', icon: '' };
  protected replacementAssigneeSelection: Record<string, string> = {};
  protected readonly locallyReservedSuggestionIds = signal<string[]>([]);
  protected readonly highlightedTab = signal<'replacements' | 'requests'>('replacements');
  protected readonly assistantReplacement = signal<ReplacementItem | null>(null);
  @ViewChild('teamRequestsSection') private teamRequestsSection?: ElementRef<HTMLElement>;

  constructor() {
    this.loadData();
    this.route.queryParamMap.subscribe((params) => {
      this.highlightedTab.set(params.get('tab') === 'requests' ? 'requests' : 'replacements');
      if (params.get('tab') === 'requests') {
        setTimeout(() => this.teamRequestsSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }
    });
  }

  protected castNullable(value: unknown): string | null {
    return value ? String(value) : null;
  }

  protected castString(value: unknown): string {
    return value ? String(value) : '';
  }

  protected asRecord(value: unknown): Record<string, unknown> | null {
    return (value as Record<string, unknown> | null) ?? null;
  }

  protected selectedMemberUserId(): string {
    return String(this.selectedMemberOption()?.['value'] ?? '');
  }

  protected selectedJoinRequestUserId(): string {
    return String(this.selectedJoinRequestOption()?.['value'] ?? '');
  }

  protected availableUserOptions(teamId: string): Array<{ label: string; value: string }> {
    const memberIds = new Set((this.teams().find((team) => team.id === teamId)?.members ?? []).map((member) => member.id));
    return this.people()
      .filter((user) => !memberIds.has(user.id))
      .map((user) => ({ label: `${user.fullName} · ${user.role}`, value: user.id }));
  }

  protected openTeamDialog(): void {
    this.editingTeamId.set(null);
    this.teamForm = { name: '', description: '', leaderId: null };
    this.teamDialogVisible = true;
  }

  protected openDutyDialog(team?: TeamListItem): void {
    this.editingDutyId.set(null);
    this.dutyForm = {
      teamId: team?.id ?? this.selectedTeam()?.id ?? '',
      name: '',
      description: '',
      color: '',
      icon: '',
    };
    this.dutyDialogVisible = true;
  }

  protected selectTeam(team: TeamListItem): void {
    this.selectedTeam.set(team);
    this.selectedMemberOption.set(null);
    this.selectedJoinRequestOption.set(null);
  }

  protected editTeam(team: TeamListItem): void {
    this.editingTeamId.set(team.id);
    this.teamForm = {
      name: team.name,
      description: team.description ?? '',
      leaderId: team.leader?.id ?? null,
    };
    this.teamDialogVisible = true;
  }

  protected renameTeam(teamId: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    this.api.updateTeam(teamId, { name: trimmed }).subscribe({
      next: () => this.loadData(),
    });
  }

  protected saveTeam(): void {
    const payload = {
      name: this.teamForm.name.trim(),
      description: this.teamForm.description.trim() || undefined,
      leaderId: this.teamForm.leaderId || undefined,
    };

    const request = this.editingTeamId()
      ? this.api.updateTeam(this.editingTeamId() as string, payload)
      : this.api.createTeam(payload);

    request.subscribe({
      next: () => {
        this.teamDialogVisible = false;
        this.loadData();
        this.feedback.success(this.editingTeamId() ? 'Team aggiornato' : 'Team creato');
      },
      error: (error) => this.feedback.error('Operazione team non riuscita', this.apiError.message(error, 'Impossibile salvare il team.')),
    });
  }

  protected deleteTeam(teamId: string): void {
    this.api.deleteTeam(teamId).subscribe({
      next: () => {
        if (this.selectedTeam()?.id === teamId) {
          this.selectedTeam.set(null);
        }
        this.loadData();
        this.feedback.success('Team eliminato');
      },
      error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare il team.')),
    });
  }

  protected editDuty(team: TeamListItem, duty: TeamDuty): void {
    this.selectedTeam.set(team);
    this.editingDutyId.set(duty.id);
    this.dutyForm = {
      teamId: team.id,
      name: duty.name,
      description: '',
      color: duty.color ?? '',
      icon: duty.icon ?? '',
    };
    this.dutyDialogVisible = true;
  }

  protected saveDuty(): void {
    const payload = {
      teamId: this.dutyForm.teamId,
      name: this.dutyForm.name.trim(),
      description: this.dutyForm.description.trim() || undefined,
      color: this.dutyForm.color.trim() || undefined,
      icon: this.dutyForm.icon.trim() || undefined,
    };

    const request = this.editingDutyId()
      ? this.api.updateDuty(this.editingDutyId() as string, {
          name: payload.name,
          description: payload.description,
          color: payload.color,
          icon: payload.icon,
        })
      : this.api.createDuty(payload);

    request.subscribe({
      next: () => {
        this.dutyDialogVisible = false;
        this.loadData();
        this.feedback.success(this.editingDutyId() ? 'Mansione aggiornata' : 'Mansione creata');
      },
      error: (error) => this.feedback.error('Operazione mansione non riuscita', this.apiError.message(error, 'Impossibile salvare la mansione.')),
    });
  }

  protected deleteDuty(dutyId: string): void {
    this.api.deleteDuty(dutyId).subscribe({
      next: () => {
        this.loadData();
        this.feedback.success('Mansione eliminata');
      },
      error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare la mansione.')),
    });
  }

  protected resolveReplacement(replacementId: string, status: 'APPROVED' | 'DECLINED'): void {
    const replacementAssigneeId = this.replacementAssigneeSelection[replacementId] || undefined;
    const replacementAssignee = replacementAssigneeId ? this.findMemberById(replacementAssigneeId) : null;

    this.api.resolveReplacement(replacementId, { status, replacementAssigneeId }).subscribe({
      next: () => {
        if (status === 'APPROVED' && replacementAssigneeId) {
          this.locallyReservedSuggestionIds.update((ids) => Array.from(new Set([...ids, replacementAssigneeId])));
        }
        this.patchReplacementState(replacementId, status, replacementAssigneeId ?? null, replacementAssignee);
        this.feedback.success(status === 'APPROVED' ? 'Sostituzione approvata' : 'Sostituzione rifiutata');
      },
      error: (error) => this.feedback.error('Sostituzione non aggiornata', this.apiError.message(error, 'Impossibile aggiornare la richiesta di sostituzione.')),
    });
  }

  protected approveReplacementWithSuggestion(replacement: ReplacementItem): void {
    if (!replacement.suggestedReplacement?.id) {
      return;
    }

    this.replacementAssigneeSelection[replacement.id] = replacement.suggestedReplacement.id;
    this.resolveReplacement(replacement.id, 'APPROVED');
  }

  protected openReplacementAssistant(replacement: ReplacementItem): void {
    this.assistantReplacement.set(replacement);
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
        ? `La copertura del team e gia confermata con ${replacement.replacementAssignee.fullName}.`
        : 'La richiesta e approvata: verifica il passaggio operativo del sostituto con il team leader.';
    }

    if (replacement.status === 'DECLINED') {
      return 'La richiesta e stata chiusa senza sostituzione: valuta un contatto diretto con il team per coprire il turno.';
    }

    if (replacement.suggestedReplacement?.fullName) {
      return `Per velocizzare il workspace team, ${replacement.suggestedReplacement.fullName} e la prima scelta da confermare.`;
    }

    return 'Non c e un suggerimento automatico forte: valuta disponibilita e seniority dei membri del team.';
  }

  protected replacementOptions(replacement: ReplacementItem): Array<{ label: string; value: string }> {
    const teamId = replacement.assignment?.slot?.team?.name
      ? this.teams().find((team) => team.name === replacement.assignment?.slot?.team?.name)?.id
      : null;
    const team = this.teams().find((item) => item.id === teamId);
    return (team?.members ?? []).map((member) => ({ label: member.fullName, value: member.id }));
  }

  protected addMemberToSelectedTeam(): void {
    const teamId = this.selectedTeam()?.id;
    const userId = this.selectedMemberUserId();
    if (!teamId || !userId) {
      return;
    }

    this.api.addTeamMember(teamId, userId).subscribe({
      next: () => {
        this.selectedMemberOption.set(null);
        this.loadData();
        this.feedback.success('Membro aggiunto al team');
      },
      error: (error) => this.feedback.error('Inserimento non riuscito', this.apiError.message(error, 'Impossibile aggiungere la persona al team.')),
    });
  }

  protected removeMemberFromSelectedTeam(userId: string): void {
    const teamId = this.selectedTeam()?.id;
    if (!teamId) {
      return;
    }

    this.api.removeTeamMember(teamId, userId).subscribe({
      next: () => {
        this.loadData();
        this.feedback.success('Membro rimosso dal team');
      },
      error: (error) => this.feedback.error('Rimozione non riuscita', this.apiError.message(error, 'Impossibile rimuovere la persona dal team.')),
    });
  }

  protected requestJoinForSelectedTeam(): void {
    const teamId = this.selectedTeam()?.id;
    const userId = this.selectedJoinRequestUserId();
    if (!teamId || !userId) {
      return;
    }

    this.api.createTeamJoinRequest(teamId, userId).subscribe({
      next: () => {
        this.selectedJoinRequestOption.set(null);
        this.loadData();
        this.feedback.success('Invito al team inviato');
      },
      error: (error) => this.feedback.error('Invito non inviato', this.apiError.message(error, 'Impossibile creare la richiesta di inserimento.')),
    });
  }

  protected approveTeamRequest(request: TeamAccessRequestItem): void {
    if (request.kind === 'SIGNUP') {
      this.authApi.resolveSignupRequest(request.id, 'APPROVED').subscribe({
        next: () => {
          this.loadData();
          this.feedback.success('Richiesta signup approvata');
        },
        error: (error) => this.feedback.error('Approvazione non riuscita', this.apiError.message(error, 'Impossibile approvare la richiesta signup.')),
      });
      return;
    }

    this.api.resolveTeamJoinRequest(request.id, 'APPROVED').subscribe({
      next: () => {
        this.loadData();
        this.feedback.success('Richiesta team approvata');
      },
      error: (error) => this.feedback.error('Approvazione non riuscita', this.apiError.message(error, 'Impossibile approvare la richiesta team.')),
    });
  }

  protected declineTeamRequest(request: TeamAccessRequestItem): void {
    if (request.kind === 'SIGNUP') {
      this.authApi.resolveSignupRequest(request.id, 'DECLINED').subscribe({
        next: () => {
          this.loadData();
          this.feedback.success('Richiesta signup rifiutata');
        },
        error: (error) => this.feedback.error('Rifiuto non riuscito', this.apiError.message(error, 'Impossibile rifiutare la richiesta signup.')),
      });
      return;
    }

    this.api.resolveTeamJoinRequest(request.id, 'DECLINED').subscribe({
      next: () => {
        this.loadData();
        this.feedback.success('Richiesta team rifiutata');
      },
      error: (error) => this.feedback.error('Rifiuto non riuscito', this.apiError.message(error, 'Impossibile rifiutare la richiesta team.')),
    });
  }

  private loadData(): void {
    this.api.teams().subscribe({
      next: (teams) => {
        this.teams.set(teams);
        const selectedTeamId = this.selectedTeam()?.id;
        const nextSelectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? null;
        this.selectedTeam.set(nextSelectedTeam);
      },
      error: (error) => this.feedback.error('Team non caricati', this.apiError.message(error, 'Impossibile recuperare i team.')),
    });

    this.api.users('service_leader').subscribe({
      next: (users) => this.leaders.set(users),
      error: (error) => this.feedback.error('Leader non caricati', this.apiError.message(error, 'Impossibile recuperare i leader.')),
    });

    this.api.users().subscribe({
      next: (users) => this.people.set(users),
      error: (error) => this.feedback.error('Persone non caricate', this.apiError.message(error, 'Impossibile recuperare gli utenti.')),
    });

    this.api.replacements().subscribe({
      next: (items) => this.replacements.set(items),
      error: (error) => this.feedback.error('Sostituzioni non caricate', this.apiError.message(error, 'Impossibile recuperare le sostituzioni.')),
    });

    this.api.teamJoinRequests().subscribe({
      next: (items) => this.teamRequests.set(items),
      error: (error) => this.feedback.error('Richieste team non caricate', this.apiError.message(error, 'Impossibile recuperare le richieste team.')),
    });
  }

  private patchReplacementState(
    replacementId: string,
    status: ReplacementItem['status'],
    replacementAssigneeId: string | null,
    replacementAssignee: NonNullable<ReplacementItem['replacementAssignee']> | null
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
              replacementAssignee: replacementAssigneeId ? replacementAssignee ?? item.replacementAssignee : item.replacementAssignee,
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
            replacementAssignee: replacementAssigneeId ? replacementAssignee ?? item.replacementAssignee : item.replacementAssignee,
          }
        : item
    );
  }

  private findMemberById(memberId: string): NonNullable<TeamListItem['members']>[number] | null {
    return this.teams()
      .flatMap((team) => team.members ?? [])
      .find((member) => member.id === memberId) ?? null;
  }
}
