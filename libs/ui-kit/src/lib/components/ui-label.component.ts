import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-label',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium" [ngClass]="toneClass">
      <ng-content />
    </span>
  `
})
export class UiLabelComponent {
  @Input() tone: 'neutral' | 'info' | 'success' | 'warn' = 'neutral';

  get toneClass() {
    return {
      neutral: 'bg-slate-100 text-slate-700',
      info: 'bg-sky-100 text-sky-700',
      success: 'bg-emerald-100 text-emerald-700',
      warn: 'bg-amber-100 text-amber-700'
    }[this.tone];
  }
}
