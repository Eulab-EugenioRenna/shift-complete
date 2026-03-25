import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ui-dialog-shell',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      :host {
        display: block;
      }

      .dialog-shell {
        animation: dialog-shell-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
        transform-origin: top center;
      }

      @keyframes dialog-shell-enter {
        from {
          opacity: 0;
          transform: translateY(10px) scale(0.985);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `
  ],
  template: `
    <section class="dialog-shell flex max-h-[90vh] flex-col overflow-hidden rounded-[28px] border border-[color:var(--border-soft)] bg-[linear-gradient(180deg,var(--surface-1)_0%,var(--surface-2)_100%)] shadow-[var(--shadow-soft)]">
      <header class="shrink-0 border-b border-[color:var(--border-soft)] px-6 py-5" [ngClass]="headerClass()">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-4">
            <div *ngIf="icon" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg" [ngClass]="iconClass()">
              <i [class]="icon"></i>
            </div>
            <div>
              <p *ngIf="eyebrow" class="text-[11px] uppercase tracking-[0.3em] text-[color:var(--text-3)]">{{ eyebrow }}</p>
              <h3 class="mt-1 text-xl font-semibold text-[color:var(--text-1)]">{{ title }}</h3>
              <p *ngIf="subtitle" class="mt-1 text-sm text-[color:var(--text-2)]">{{ subtitle }}</p>
            </div>
          </div>
          <button *ngIf="closable" type="button" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] text-[color:var(--text-2)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-1)]" (click)="closeRequested.emit()" aria-label="Chiudi dialog">
            <i class="pi pi-times text-sm"></i>
          </button>
        </div>
      </header>
      <div *ngIf="hasFooter" class="order-3 sticky bottom-0 shrink-0 border-t border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-6 py-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div class="flex items-center justify-end gap-2">
          <ng-content select="[dialog-footer-slot]"></ng-content>
        </div>
      </div>
      <div class="order-2 min-h-0 flex-1 overflow-y-auto px-6 py-6 text-[color:var(--text-2)]" [ngClass]="hasFooter ? 'pb-6' : 'pb-10'">
        <ng-content select="[dialog-body]"></ng-content>
      </div>
    </section>
  `
})
export class UiDialogShellComponent {
  @Input() title = 'Dialog';
  @Input() eyebrow?: string;
  @Input() subtitle?: string;
  @Input() icon?: string;
  @Input() tone: 'default' | 'info' | 'success' | 'warn' | 'danger' = 'default';
  @Input() hasFooter = false;
  @Input() closable = true;
  @Output() closeRequested = new EventEmitter<void>();

  protected headerClass() {
    switch (this.tone) {
      case 'info':
        return 'bg-[linear-gradient(135deg,color-mix(in_srgb,#dbeafe_78%,var(--surface-1))_0%,var(--surface-1)_55%,var(--surface-2)_100%)]';
      case 'success':
        return 'bg-[linear-gradient(135deg,color-mix(in_srgb,#d1fae5_74%,var(--surface-1))_0%,var(--surface-1)_55%,var(--surface-2)_100%)]';
      case 'warn':
        return 'bg-[linear-gradient(135deg,color-mix(in_srgb,#fed7aa_68%,var(--surface-1))_0%,var(--surface-1)_55%,var(--surface-2)_100%)]';
      case 'danger':
        return 'bg-[linear-gradient(135deg,color-mix(in_srgb,#fecaca_66%,var(--surface-1))_0%,var(--surface-1)_55%,var(--surface-2)_100%)]';
      default:
        return 'bg-[linear-gradient(135deg,var(--surface-2)_0%,var(--surface-1)_55%,var(--surface-2)_100%)]';
    }
  }

  protected iconClass() {
    switch (this.tone) {
      case 'info':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-200';
      case 'success':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-200';
      case 'warn':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-200';
      case 'danger':
        return 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-200';
      default:
        return 'bg-[color:var(--surface-3)] text-[color:var(--text-2)]';
    }
  }
}
