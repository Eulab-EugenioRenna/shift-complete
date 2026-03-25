import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject } from '@angular/core';
import { UiChipComponent } from '@shift-complete/ui-kit';
import { GlobalTeamScopeService } from '../../core/services/global-team-scope.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-team-scope-chips',
  standalone: true,
  imports: [CommonModule, UiChipComponent],
  template: `
    <div class="flex flex-wrap items-center gap-2" *ngIf="visible() && teams.length">
      <ui-chip tone="neutral" [selected]="!scope.teamId()" (chipClick)="scope.clear()">Tutti</ui-chip>
      <ui-chip
        *ngFor="let team of teams"
        tone="info"
        [selected]="scope.teamId() === team.id"
        (chipClick)="scope.setTeam(team.id)"
      >
        {{ team.name }}
      </ui-chip>
    </div>
  `,
})
export class TeamScopeChipsComponent {
  private readonly session = inject(SessionService);
  protected readonly scope = inject(GlobalTeamScopeService);

  @Input() teams: Array<{ id: string; name: string }> = [];

  protected readonly visible = computed(() => this.session.isAdministrator());
}
