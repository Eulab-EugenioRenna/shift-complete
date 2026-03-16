import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AppApiService } from '../../shared/services/app-api.service';
import { LiveNotificationsService } from '../../core/services/live-notifications.service';

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, SelectButtonModule, TagModule, DialogModule, TableModule, DropdownModule, InputTextModule, CheckboxModule],
  template: `
    <section class="grid gap-6">
      <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-teal-700">Calendario</p>
          <h2 class="text-3xl font-semibold text-slate-900">Calendario, eventi e turni con assegnazione manuale o automatica.</h2>
        </div>
        <div class="flex flex-wrap gap-2 text-sm">
          <p-selectButton [options]="viewOptions" optionLabel="label" optionValue="value" [(ngModel)]="currentView"></p-selectButton>
          <button pButton type="button" label="Nuovo evento" icon="pi pi-plus" (click)="openEventDialog()"></button>
          <button pButton type="button" label="Auto assegna" icon="pi pi-sparkles" severity="contrast" [outlined]="true" (click)="autoAssign()"></button>
          <button pButton type="button" label="Board assegnazioni" icon="pi pi-directions-alt" severity="secondary" [outlined]="true" (click)="openAssignmentBoard()"></button>
        </div>
      </header>

      <div class="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <p-card styleClass="metric-tile border-0 shadow-none min-h-[32rem]">
          <ng-template pTemplate="title">Calendario {{ currentView }}</ng-template>
          <div class="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.2em] text-slate-500">
            <span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span><span>Dom</span>
          </div>
          <div class="mt-3 grid grid-cols-7 gap-2">
            <div class="rounded-2xl border border-slate-200 p-3" *ngFor="let day of days">
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-medium">{{ day }}</p>
                <p-tag *ngIf="(eventsByDay()[day] || []).length" severity="contrast" [value]="String((eventsByDay()[day] || []).length)"></p-tag>
              </div>
              <ng-container *ngFor="let event of eventsByDay()[day] || []">
                <div class="mt-2 rounded-xl bg-orange-50 p-2 text-xs text-orange-700">
                  <div class="flex items-start justify-between gap-2">
                    <div (click)="selectEvent(event)">
                      <p class="font-medium">{{ event.title }}</p>
                      <p class="mt-1 text-[11px] text-orange-600">{{ event.type }}</p>
                    </div>
                    <button pButton type="button" icon="pi pi-trash" [text]="true" severity="danger" (click)="deleteEvent(event.id)"></button>
                  </div>
                </div>
              </ng-container>
            </div>
          </div>
        </p-card>

        <p-card styleClass="metric-tile border-0 shadow-none">
          <ng-template pTemplate="title">Evento selezionato</ng-template>
          <div *ngIf="selectedEvent() as event; else noEvent" class="grid gap-3 text-sm text-slate-600">
            <div class="rounded-2xl border border-slate-200 p-4">
              <p class="font-medium text-slate-900">{{ event.title }}</p>
              <p class="mt-1">{{ event.startsAt | date:'short' }} - {{ event.endsAt | date:'short' }}</p>
              <p class="mt-1">Slot: {{ event.slots?.length || 0 }}</p>
            </div>
            <div class="rounded-2xl border border-slate-200 p-4">
              <p class="font-medium text-slate-900">Realtime</p>
              <p class="mt-1">{{ live.connected() ? 'Connesso al gateway websocket' : 'In attesa connessione websocket' }}</p>
            </div>
          </div>
          <ng-template #noEvent>
            <p class="text-sm text-slate-500">Seleziona un evento o creane uno nuovo.</p>
          </ng-template>
        </p-card>
      </div>

      <p-dialog header="Nuovo evento" [(visible)]="eventDialogVisible" [modal]="true" [style]="{ width: '42rem', maxWidth: '95vw' }">
        <div class="grid gap-4">
          <input pInputText [(ngModel)]="eventForm.title" placeholder="Titolo evento" />
          <div class="grid gap-4 md:grid-cols-2">
            <input pInputText [(ngModel)]="eventForm.startsAt" placeholder="2026-03-20T18:00:00.000Z" />
            <input pInputText [(ngModel)]="eventForm.endsAt" placeholder="2026-03-20T20:00:00.000Z" />
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <p-dropdown [options]="teamOptions()" optionLabel="label" optionValue="value" [(ngModel)]="eventForm.teamId" placeholder="Team"></p-dropdown>
            <input pInputText [(ngModel)]="eventForm.roleName" placeholder="Ruolo slot" />
          </div>
          <div class="flex items-center gap-2 text-sm text-slate-600">
            <p-checkbox [(ngModel)]="eventForm.isRecurring" [binary]="true"></p-checkbox>
            <span>Evento ricorrente settimanale</span>
          </div>
          <div class="flex justify-end gap-2">
            <button pButton type="button" label="Annulla" [text]="true" (click)="eventDialogVisible = false"></button>
            <button pButton type="button" label="Crea evento" (click)="saveEvent()" [disabled]="!isEventFormValid()"></button>
          </div>
        </div>
      </p-dialog>

      <p-dialog header="Auto assegnazione turni" [(visible)]="previewVisible" [modal]="true" [style]="{ width: '70rem', maxWidth: '95vw' }">
        <p-table [value]="previewSuggestions()" [tableStyle]="{ 'min-width': '50rem' }">
          <ng-template pTemplate="header">
            <tr><th>Team</th><th>Ruolo</th><th>Inizio</th><th>Copertura</th><th>Volontario</th><th>Strategia</th></tr>
          </ng-template>
          <ng-template pTemplate="body" let-item>
            <tr>
              <td>{{ item.teamName }}</td>
              <td>{{ item.roleName }}</td>
              <td>{{ item.startsAt | date:'short' }}</td>
              <td><p-tag [severity]="item.coverageStatus === 'covered' ? 'success' : (item.coverageStatus === 'suggested' ? 'info' : 'warn')" [value]="item.coverageStatus"></p-tag></td>
              <td>{{ item.assigneeName || '-' }}</td>
              <td>{{ item.strategy }}</td>
            </tr>
          </ng-template>
        </p-table>
      </p-dialog>

      <p-dialog header="Board assegnazioni per slot" [(visible)]="assignmentBoardVisible" [modal]="true" [style]="{ width: '78rem', maxWidth: '98vw' }">
        <div class="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div class="rounded-2xl border border-slate-200 p-4">
            <p class="text-sm uppercase tracking-[0.2em] text-slate-500">Volontari</p>
            <div class="mt-4 grid gap-2">
              <div *ngFor="let volunteer of volunteers()" draggable="true" (dragstart)="startDragging(volunteer.id)" class="cursor-grab rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                <p class="font-medium">{{ volunteer.fullName }}</p>
                <p class="text-xs text-slate-500">{{ volunteer.email }}</p>
              </div>
            </div>
          </div>
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div *ngFor="let slot of selectedEventSlots()" class="rounded-2xl border border-dashed border-slate-300 p-4" (dragover)="allowDrop($event)" (drop)="dropVolunteer(slot.id)">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-medium">{{ slot.roleName }}</p>
                  <p class="text-sm text-slate-500">{{ slot.teamName }}</p>
                </div>
                <p-tag [severity]="slot.assignments?.length ? 'success' : 'warn'" [value]="slot.assignments?.length ? 'coperto' : 'vacante'"></p-tag>
              </div>
              <div class="mt-4 grid gap-2">
                <div class="rounded-xl bg-slate-100 px-3 py-2 text-sm" *ngFor="let assignment of slot.assignments">{{ assignment.assignee?.fullName || 'Assegnazione senza volontario' }}</div>
                <div class="rounded-xl bg-orange-50 px-3 py-3 text-sm text-orange-700" *ngIf="!slot.assignments?.length">Trascina qui un volontario per assegnarlo.</div>
              </div>
            </div>
          </div>
        </div>
      </p-dialog>
    </section>
  `
})
export class CalendarPageComponent {
  private readonly api = inject(AppApiService);
  protected readonly live = inject(LiveNotificationsService);

  protected readonly days = Array.from({ length: 35 }, (_, index) => index + 1);
  protected readonly events = signal<any[]>([]);
  protected readonly volunteers = signal<any[]>([]);
  protected readonly teams = signal<any[]>([]);
  protected readonly previewSuggestions = signal<any[]>([]);
  protected readonly selectedEvent = signal<any | null>(null);
  protected previewVisible = false;
  protected assignmentBoardVisible = false;
  protected eventDialogVisible = false;
  protected currentView = 'month';
  protected eventForm = { title: '', startsAt: '', endsAt: '', teamId: null as string | null, roleName: '', isRecurring: false };
  private draggedVolunteerId: string | null = null;
  protected readonly viewOptions = [
    { label: 'Mese', value: 'month' },
    { label: 'Settimana', value: 'week' },
    { label: 'Agenda', value: 'agenda' }
  ];

  protected readonly teamOptions = computed(() => this.teams().map((team) => ({ label: team.name, value: team.id })));
  protected readonly eventsByDay = computed(() => {
    const grouped: Record<number, any[]> = {};
    for (const event of this.events()) {
      const day = new Date(event.startsAt).getDate();
      grouped[day] ??= [];
      grouped[day].push(event);
    }
    return grouped;
  });
  protected readonly selectedEventSlots = computed(() => this.selectedEvent()?.slots ?? []);

  constructor() {
    this.live.connect();
    this.loadData();
  }

  isEventFormValid(): boolean {
    return Boolean(this.eventForm.title.trim() && this.eventForm.startsAt && this.eventForm.endsAt && this.eventForm.teamId && this.eventForm.roleName.trim());
  }

  openEventDialog(): void {
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    this.eventForm = {
      title: '',
      startsAt: now.toISOString(),
      endsAt: end.toISOString(),
      teamId: this.teams()[0]?.id ?? null,
      roleName: 'Volontario turno',
      isRecurring: false
    };
    this.eventDialogVisible = true;
  }

  saveEvent(): void {
    if (!this.isEventFormValid()) {
      return;
    }

    this.api.createEvent({
      title: this.eventForm.title.trim(),
      type: this.eventForm.isRecurring ? 'recurring' : 'single',
      startsAt: this.eventForm.startsAt,
      endsAt: this.eventForm.endsAt,
      recurrenceRule: this.eventForm.isRecurring ? 'FREQ=WEEKLY' : undefined,
      recurrenceTz: this.eventForm.isRecurring ? 'Europe/Rome' : undefined,
      slots: [
        {
          teamId: this.eventForm.teamId,
          roleName: this.eventForm.roleName.trim(),
          startsAt: this.eventForm.startsAt,
          endsAt: this.eventForm.endsAt,
          required: true
        }
      ]
    }).subscribe({
      next: () => {
        this.eventDialogVisible = false;
        this.loadData();
      }
    });
  }

  deleteEvent(eventId: string): void {
    this.api.deleteEvent(eventId).subscribe({ next: () => this.loadData() });
  }

  selectEvent(event: any): void {
    this.selectedEvent.set(event);
  }

  openAssignmentBoard(): void {
    if (!this.selectedEvent() && this.events().length) {
      this.selectedEvent.set(this.events()[0]);
    }
    this.assignmentBoardVisible = true;
  }

  startDragging(volunteerId: string): void {
    this.draggedVolunteerId = volunteerId;
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  dropVolunteer(slotId: string): void {
    if (!this.draggedVolunteerId) {
      return;
    }

    this.api.assignVolunteer({ slotId, assigneeId: this.draggedVolunteerId, status: 'assigned' }).subscribe({
      next: () => {
        this.draggedVolunteerId = null;
        this.loadData();
      }
    });
  }

  autoAssign(): void {
    const now = new Date();
    const to = new Date(now);
    to.setDate(to.getDate() + 30);
    this.api.generateSchedulePreview({ from: now.toISOString(), to: to.toISOString(), apply: true }).subscribe({
      next: (result) => {
        this.previewSuggestions.set(result.suggestions ?? []);
        this.previewVisible = true;
        this.loadData();
      }
    });
  }

  private loadData(): void {
    this.api.events().subscribe({
      next: (events) => {
        this.events.set(events);
        if (this.selectedEvent()) {
          const fresh = events.find((event) => event.id === this.selectedEvent()?.id);
          this.selectedEvent.set(fresh ?? null);
        }
      }
    });
    this.api.users('volunteer').subscribe({ next: (users) => this.volunteers.set(users) });
    this.api.teams().subscribe({ next: (teams) => this.teams.set(teams) });
  }
}
