import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-table-shell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="overflow-hidden rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)]">
      <div *ngIf="title" class="border-b border-[color:var(--border-soft)] px-5 py-4">
        <h3 class="text-base font-semibold text-[color:var(--text-1)]">{{ title }}</h3>
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
