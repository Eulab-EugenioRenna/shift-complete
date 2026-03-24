import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="ui-surface p-5" [ngClass]="surfaceClass">
      <p class="ui-eyebrow" [ngClass]="eyebrowClass">{{ label }}</p>
      <p class="mt-3 text-2xl font-semibold text-[color:var(--text-1)]" [ngClass]="valueClass">{{ value }}</p>
      <p *ngIf="detail" class="mt-2 text-xs text-[color:var(--text-2)]" [ngClass]="detailClass">{{ detail }}</p>
      <ng-content></ng-content>
    </section>
  `
})
export class UiStatCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string | number;
  @Input() detail?: string;
  @Input() surfaceClass = '';
  @Input() eyebrowClass = '';
  @Input() valueClass = '';
  @Input() detailClass = '';
}
