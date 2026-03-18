import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-table-shell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="overflow-hidden rounded-[24px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/85">
      <div *ngIf="title" class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">{{ title }}</h3>
      </div>
      <div class="overflow-auto">
        <ng-content />
      </div>
    </section>
  `
})
export class UiTableShellComponent {
  @Input() title?: string;
}
