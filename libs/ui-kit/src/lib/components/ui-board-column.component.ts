import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-board-column',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="flex h-full min-h-0 flex-col gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-2)] p-3" [ngClass]="columnClass">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--text-3)]">{{ title }}</p>
        <span *ngIf="count !== undefined" class="text-xs text-[color:var(--text-3)]">{{ count }}</span>
      </div>
      <div class="flex min-h-0 flex-1 flex-col gap-2">
        <ng-content></ng-content>
      </div>
    </section>
  `
})
export class UiBoardColumnComponent {
  @Input({ required: true }) title!: string;
  @Input() count?: string | number;
  @Input() columnClass = '';
}
