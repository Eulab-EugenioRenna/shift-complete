import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rounded-[24px] border border-slate-200/80 bg-white shadow-[0_18px_50px_-34px_rgba(15,23,42,0.22)]" [ngClass]="paddingClass">
      <div *ngIf="title || subtitle" class="mb-4">
        <p *ngIf="eyebrow" class="text-[11px] uppercase tracking-[0.28em] text-slate-400">{{ eyebrow }}</p>
        <h3 *ngIf="title" class="mt-1 text-lg font-semibold tracking-tight text-slate-900">{{ title }}</h3>
        <p *ngIf="subtitle" class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>
      </div>
      <ng-content />
    </section>
  `
})
export class UiCardComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() eyebrow?: string;
  @Input() paddingClass = 'p-5';
}
