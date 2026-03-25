import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { UiButtonComponent } from './ui-button.component';

@Component({
  selector: 'ui-filter-bar',
  standalone: true,
  imports: [CommonModule, UiButtonComponent],
  template: `
    <div class="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] shadow-[var(--shadow-soft)]" [ngClass]="[surfaceClass, compact ? 'ui-filter-bar--compact' : '']">
      <div class="flex flex-col gap-4 px-4 py-4 sm:px-5" [ngClass]="contentClass">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0" *ngIf="title || subtitle">
            <p *ngIf="title" class="text-sm font-semibold text-[color:var(--text-1)]">{{ title }}</p>
            <p *ngIf="subtitle" class="mt-1 text-xs text-[color:var(--text-2)]">{{ subtitle }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2" [class.hidden]="!hasActions && !showReset">
            <ng-content select="[filter-actions]"></ng-content>
            <ui-button *ngIf="showReset" tone="neutral" variant="outlined" size="sm" icon="pi pi-filter-slash" (buttonClick)="onResetClick()">{{ resetLabel }}</ui-button>
          </div>
        </div>
        <div class="grid gap-3" [ngClass]="fieldsClass">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
})
export class UiFilterBarComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() resetLabel = 'Rimuovi filtri';
  @Input() showReset = false;
  @Input() hasActions = false;
  @Input() compact = false;
  @Input() surfaceClass = '';
  @Input() contentClass = '';
  @Input() fieldsClass = 'md:grid-cols-2 xl:grid-cols-5';
  @Input() reset?: () => void;

  protected onResetClick(): void {
    this.reset?.();
  }
}
