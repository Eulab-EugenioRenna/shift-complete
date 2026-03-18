import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-sidebar-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_22px_56px_-36px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900/85 dark:shadow-[0_24px_60px_-40px_rgba(2,6,23,0.7)]">
      <p *ngIf="eyebrow" class="text-[11px] uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">{{ eyebrow }}</p>
      <h3 *ngIf="title" class="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{{ title }}</h3>
      <div class="mt-4">
        <ng-content />
      </div>
    </aside>
  `
})
export class UiSidebarPanelComponent {
  @Input() title?: string;
  @Input() eyebrow?: string;
}
