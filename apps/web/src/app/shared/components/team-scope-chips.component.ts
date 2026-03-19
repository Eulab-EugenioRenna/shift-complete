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
        [ngClass]="!scope.teamId() ? 'border-[color:var(--border-strong)] bg-[color:var(--surface-3)] text-[color:var(--text-1)]' : 'border-[color:var(--border-soft)] bg-[color:var(--surface-1)] text-[color:var(--text-2)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-1)]'"
        (click)="scope.clear()"
      >
        Tutti
      </button>
      <button
        type="button"
        *ngFor="let team of teams"
        class="rounded-full border px-3 py-1.5 text-xs font-medium transition"
        [ngClass]="scope.teamId() === team.id ? 'border-[color:var(--accent-1)] bg-[color:var(--accent-1)] text-white dark:text-[color:var(--text-inverse)]' : 'border-[color:var(--border-soft)] bg-[color:var(--surface-1)] text-[color:var(--text-2)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-1)]'"
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
