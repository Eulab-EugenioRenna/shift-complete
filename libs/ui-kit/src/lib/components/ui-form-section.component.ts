import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-form-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="grid gap-4 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-2)] p-4">
      <div *ngIf="title || subtitle">
        <h3 *ngIf="title" class="text-sm font-semibold text-[color:var(--text-1)]">{{ title }}</h3>
        <p *ngIf="subtitle" class="mt-1 text-xs text-[color:var(--text-2)]">{{ subtitle }}</p>
      </div>
      <ng-content></ng-content>
    </section>
  `
})
export class UiFormSectionComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
}
