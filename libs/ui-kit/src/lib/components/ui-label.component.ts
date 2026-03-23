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
      neutral: 'bg-slate-700 text-white dark:bg-slate-600 dark:text-white',
      info: 'bg-[#4979e6] text-white dark:bg-[#4979e6] dark:text-white',
      success: 'bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white',
      warn: 'bg-amber-600 text-white dark:bg-amber-600 dark:text-white'
    }[this.tone];
  }
}
