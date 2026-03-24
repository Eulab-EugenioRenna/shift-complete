import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-replacement-timeline-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-2)] p-3" [ngClass]="cardClass">
      <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-3)]">{{ title }}</p>
      <div class="mt-2 grid gap-2 text-xs text-[color:var(--text-2)]">
        <div class="flex items-center justify-between gap-3" [ngClass]="rowClass">
          <span>{{ originLabel }}</span>
          <span class="font-medium text-[color:var(--text-1)]">{{ originValue }}</span>
        </div>
        <div class="flex items-center justify-between gap-3" *ngIf="confirmedValue" [ngClass]="rowClass">
          <span>{{ confirmedLabel }}</span>
          <span class="font-medium text-emerald-700">{{ confirmedValue }}</span>
        </div>
        <div class="flex items-center justify-between gap-3" *ngIf="suggestedValue" [ngClass]="rowClass">
          <span>{{ suggestedLabel }}</span>
          <span class="font-medium text-[#4979e6]">{{ suggestedValue }}</span>
        </div>
      </div>
    </section>
  `
})
export class UiReplacementTimelineCardComponent {
  @Input() title = 'Timeline';
  @Input() originLabel = 'Originario';
  @Input({ required: true }) originValue!: string;
  @Input() confirmedLabel = 'Sostituto';
  @Input() confirmedValue?: string | null;
  @Input() suggestedLabel = 'Suggerito';
  @Input() suggestedValue?: string | null;
  @Input() cardClass = '';
  @Input() rowClass = '';
}
