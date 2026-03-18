import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject } from '@angular/core';
import { GlobalTeamScopeService } from '../../core/services/global-team-scope.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-team-scope-chips',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-wrap items-center gap-2" *ngIf="visible() && teams.length">
      <button
        type="button"
        class="rounded-full border px-3 py-1.5 text-xs font-medium transition"
        [ngClass]="!scope.teamId() ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100'"
        (click)="scope.clear()"
      >
        Tutti
      </button>
      <button
        type="button"
        *ngFor="let team of teams"
        class="rounded-full border px-3 py-1.5 text-xs font-medium transition"
        [ngClass]="scope.teamId() === team.id ? 'border-[#4979e6] bg-[#4979e6] text-white dark:border-blue-400 dark:bg-blue-500 dark:text-slate-950' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100'"
        (click)="scope.setTeam(team.id)"
      >
        {{ team.name }}
      </button>
    </div>
  `,
})
export class TeamScopeChipsComponent {
  private readonly session = inject(SessionService);
  protected readonly scope = inject(GlobalTeamScopeService);

  @Input() teams: Array<{ id: string; name: string }> = [];

  protected readonly visible = computed(() => this.session.hasAnyRole('administrator', 'service_leader'));
}
