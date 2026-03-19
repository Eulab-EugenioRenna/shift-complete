import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="flex flex-col rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] shadow-[var(--shadow-soft)]" [ngClass]="surfaceClass">
      <div *ngIf="title || subtitle" class="mb-4 shrink-0" [ngClass]="headerClass">
        <p *ngIf="eyebrow" class="text-[11px] uppercase tracking-[0.28em] text-[color:var(--text-3)]">{{ eyebrow }}</p>
        <h3 *ngIf="title" class="mt-1 text-lg font-semibold tracking-tight text-[color:var(--text-1)]">{{ title }}</h3>
        <p *ngIf="subtitle" class="mt-1 text-sm text-[color:var(--text-2)]">{{ subtitle }}</p>
      </div>
      <div class="min-h-0 flex-1" [ngClass]="bodyClass">
        <ng-content />
      </div>
    </section>
  `
})
export class UiCardComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() eyebrow?: string;
  @Input() surfaceClass = 'p-5';
  @Input() headerClass = '';
  @Input() bodyClass = '';
}
