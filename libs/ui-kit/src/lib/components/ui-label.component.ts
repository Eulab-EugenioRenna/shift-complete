import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-label',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="ui-tag" [ngClass]="toneClass">
      <ng-content />
    </span>
  `
})
export class UiLabelComponent {
  @Input() tone: 'neutral' | 'info' | 'success' | 'warn' | 'danger' = 'neutral';

  get toneClass() {
    return {
      neutral: 'ui-tone-neutral',
      info: 'ui-tone-info',
      success: 'ui-tone-success',
      warn: 'ui-tone-warn',
      danger: 'ui-tone-danger'
    }[this.tone];
  }
}
