import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="ui-badge" [ngClass]="'ui-tone-' + tone">
      <ng-content />
    </span>
  `
})
export class UiBadgeComponent {
  @Input() tone: 'neutral' | 'info' | 'success' | 'warn' | 'danger' = 'neutral';
}
