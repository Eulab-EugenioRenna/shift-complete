import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { AppApiService } from '../../shared/services/app-api.service';

@Component({
  selector: 'app-teams-page',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, TableModule, TagModule, ButtonModule, DialogModule, DropdownModule, InputTextModule, TextareaModule],
  template: `
    <section class="grid gap-6">
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-orange-600">Team e ruoli</p>
          <h2 class="text-3xl font-semibold text-slate-900">CRUD team e assegnazioni base operative.</h2>
        </div>
        <div class="flex gap-2">
          <button pButton type="button" label="Nuovo team" icon="pi pi-plus" (click)="openTeamDialog()"></button>
          <button pButton type="button" label="Assegna volontario" icon="pi pi-user-plus" severity="contrast" [outlined]="true" (click)="openAssignmentDialog()"></button>
        </div>
      </header>

      <div class="grid gap-4 lg:grid-cols-2">
        <p-card styleClass="metric-tile border-0 shadow-none">
          <ng-template pTemplate="title">Team</ng-template>
          <ng-template pTemplate="subtitle">{{ teams().length }} attivi</ng-template>
          <div class="grid gap-3">
            <div class="rounded-2xl border border-slate-200 p-4" *ngFor="let team of teams()">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="font-medium">{{ team.name }}</p>
                  <p class="text-sm text-slate-500">Leader: {{ team.leader?.fullName || 'Da nominare' }}</p>
                  <p class="mt-1 text-sm text-slate-400">{{ team.description || 'Nessuna descrizione' }}</p>
                </div>
                <div class="flex gap-2">
                  <p-tag severity="info" [value]="team.memberCount + ' volontari'"></p-tag>
                  <button pButton type="button" icon="pi pi-pencil" [text]="true" (click)="editTeam(team)"></button>
                  <button pButton type="button" icon="pi pi-trash" severity="danger" [text]="true" (click)="deleteTeam(team.id)"></button>
                </div>
              </div>
            </div>
          </div>
        </p-card>

        <p-card styleClass="metric-tile border-0 shadow-none">
          <ng-template pTemplate="title">Matrice ruoli evento</ng-template>
          <ng-template pTemplate="subtitle">{{ assignments().length }} assegnazioni</ng-template>
          <p-table [value]="assignments()" [tableStyle]="{ 'min-width': '100%' }">
            <ng-template pTemplate="header">
              <tr><th>Ruolo</th><th>Team</th><th>Assegnato</th><th>Stato</th></tr>
            </ng-template>
            <ng-template pTemplate="body" let-assignment>
              <tr>
                <td>{{ assignment.roleName }}</td>
                <td>{{ assignment.team }}</td>
                <td>{{ assignment.assignee || 'Da assegnare' }}</td>
                <td><p-tag [severity]="assignment.status === 'open' ? 'warn' : 'success'" [value]="assignment.status"></p-tag></td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>
      </div>

      <p-dialog header="Team" [(visible)]="teamDialogVisible" [modal]="true" [style]="{ width: '36rem', maxWidth: '95vw' }">
        <div class="grid gap-4">
          <input pInputText [(ngModel)]="teamForm.name" placeholder="Nome team" />
          <textarea pTextarea [(ngModel)]="teamForm.description" rows="4" placeholder="Descrizione"></textarea>
          <p-dropdown [options]="leaderOptions()" optionLabel="label" optionValue="value" [(ngModel)]="teamForm.leaderId" placeholder="Leader servizio"></p-dropdown>
          <div class="flex justify-end gap-2">
            <button pButton type="button" label="Annulla" [text]="true" (click)="teamDialogVisible = false"></button>
            <button pButton type="button" [label]="editingTeamId() ? 'Salva' : 'Crea'" (click)="saveTeam()" [disabled]="!teamForm.name.trim()"></button>
          </div>
        </div>
      </p-dialog>

      <p-dialog header="Assegna volontario a uno slot" [(visible)]="assignmentDialogVisible" [modal]="true" [style]="{ width: '38rem', maxWidth: '95vw' }">
        <div class="grid gap-4">
          <p-dropdown [options]="slotOptions()" optionLabel="label" optionValue="value" [(ngModel)]="selectedSlotId" placeholder="Slot"></p-dropdown>
          <p-dropdown [options]="volunteerOptions()" optionLabel="label" optionValue="value" [(ngModel)]="selectedVolunteerId" placeholder="Volontario"></p-dropdown>
          <div class="flex justify-end gap-2">
            <button pButton type="button" label="Annulla" severity="secondary" [text]="true" (click)="assignmentDialogVisible = false"></button>
            <button pButton type="button" label="Conferma assegnazione" (click)="assignVolunteer()" [disabled]="!selectedSlotId || !selectedVolunteerId"></button>
          </div>
        </div>
      </p-dialog>
    </section>
  `
})
export class TeamsPageComponent {
  private readonly api = inject(AppApiService);

  protected readonly teams = signal<any[]>([]);
  protected readonly events = signal<any[]>([]);
  protected readonly volunteers = signal<any[]>([]);
  protected readonly leaders = signal<any[]>([]);
  protected readonly editingTeamId = signal<string | null>(null);
  protected assignmentDialogVisible = false;
  protected teamDialogVisible = false;
  protected selectedSlotId: string | null = null;
  protected selectedVolunteerId: string | null = null;
  protected teamForm = { name: '', description: '', leaderId: null as string | null };

  protected readonly assignments = computed(() => this.events().flatMap((event) => event.assignments ?? []).slice(0, 12));
  protected readonly slotOptions = computed(() =>
    this.events().flatMap((event) => event.slots ?? []).map((slot: any) => ({ label: `${slot.teamName} • ${slot.roleName}`, value: slot.id }))
  );
  protected readonly volunteerOptions = computed(() => this.volunteers().map((user) => ({ label: user.fullName, value: user.id })));
  protected readonly leaderOptions = computed(() => this.leaders().map((user) => ({ label: user.fullName, value: user.id })));

  constructor() {
    this.loadData();
  }

  openAssignmentDialog(): void {
    this.assignmentDialogVisible = true;
  }

  openTeamDialog(): void {
    this.editingTeamId.set(null);
    this.teamForm = { name: '', description: '', leaderId: null };
    this.teamDialogVisible = true;
  }

  editTeam(team: any): void {
    this.editingTeamId.set(team.id);
    this.teamForm = {
      name: team.name,
      description: team.description ?? '',
      leaderId: team.leader?.id ?? null
    };
    this.teamDialogVisible = true;
  }

  saveTeam(): void {
    const payload = {
      name: this.teamForm.name.trim(),
      description: this.teamForm.description?.trim() || undefined,
      leaderId: this.teamForm.leaderId || undefined
    };

    const request = this.editingTeamId()
      ? this.api.updateTeam(this.editingTeamId()!, payload)
      : this.api.createTeam(payload);

    request.subscribe({
      next: () => {
        this.teamDialogVisible = false;
        this.loadData();
      }
    });
  }

  deleteTeam(teamId: string): void {
    this.api.deleteTeam(teamId).subscribe({ next: () => this.loadData() });
  }

  assignVolunteer(): void {
    if (!this.selectedSlotId || !this.selectedVolunteerId) {
      return;
    }

    this.api.assignVolunteer({ slotId: this.selectedSlotId, assigneeId: this.selectedVolunteerId, status: 'assigned' }).subscribe({
      next: () => {
        this.assignmentDialogVisible = false;
        this.selectedSlotId = null;
        this.selectedVolunteerId = null;
        this.loadData();
      }
    });
  }

  private loadData(): void {
    this.api.teams().subscribe({ next: (teams) => this.teams.set(teams) });
    this.api.events().subscribe({ next: (events) => this.events.set(events) });
    this.api.users('volunteer').subscribe({ next: (users) => this.volunteers.set(users) });
    this.api.users('service_leader').subscribe({ next: (users) => this.leaders.set(users) });
  }
}
