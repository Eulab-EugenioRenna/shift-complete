import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="flex flex-col rounded-[24px] border border-slate-200/80 bg-white shadow-[0_18px_50px_-34px_rgba(15,23,42,0.22)] dark:border-slate-700 dark:bg-slate-900/85 dark:shadow-[0_24px_60px_-40px_rgba(2,6,23,0.7)]" [ngClass]="surfaceClass">
      <div *ngIf="title || subtitle" class="mb-4 shrink-0" [ngClass]="headerClass">
        <p *ngIf="eyebrow" class="text-[11px] uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">{{ eyebrow }}</p>
        <h3 *ngIf="title" class="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{{ title }}</h3>
        <p *ngIf="subtitle" class="mt-1 text-sm text-slate-500 dark:text-slate-300">{{ subtitle }}</p>
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
