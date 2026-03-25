import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-sidebar-panel',
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
    <aside class="rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] p-5 text-[color:var(--text-2)] shadow-[var(--shadow-soft)]" [class.h-full]="fullHeight" [class.flex]="fullHeight" [class.flex-col]="fullHeight">
      <p *ngIf="eyebrow" class="text-[11px] uppercase tracking-[0.28em] text-[color:var(--text-3)]">{{ eyebrow }}</p>
      <h3 *ngIf="title" class="mt-1 text-lg font-semibold tracking-tight text-[color:var(--text-1)]">{{ title }}</h3>
      <div class="mt-4" [class.min-h-0]="fullHeight" [class.flex-1]="fullHeight">
        <ng-content />
      </div>
    </aside>
  `
})
export class UiSidebarPanelComponent {
  @Input() title?: string;
  @Input() eyebrow?: string;
  @Input() fullHeight = false;
}
