import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-table-shell',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      :host {
        display: block;
      }
    `
  ],
  template: `
    <section class="overflow-hidden rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)]" [class.flex]="fullHeight" [class.flex-col]="fullHeight" [class.h-full]="fullHeight">
      <div *ngIf="title" class="border-b border-[color:var(--border-soft)] px-5 py-4">
        <h3 class="text-base font-semibold text-[color:var(--text-1)]">{{ title }}</h3>
      </div>
      <div class="overflow-auto" [class.min-h-0]="fullHeight" [class.flex-1]="fullHeight">
        <ng-content />
      </div>
    </section>
  `
})
export class UiTableShellComponent {
  @Input() title?: string;
  @Input() fullHeight = false;
}
