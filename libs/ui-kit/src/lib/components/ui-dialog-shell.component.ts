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
    <section class="dialog-shell flex max-h-[90vh] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_24px_70px_-34px_rgba(15,23,42,0.34)] dark:border-slate-700 dark:bg-[linear-gradient(180deg,#0f172a_0%,#111c31_100%)]">
      <header class="shrink-0 border-b border-slate-200 px-6 py-5 dark:border-slate-700" [ngClass]="headerClass()">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-4">
            <div *ngIf="icon" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg" [ngClass]="iconClass()">
              <i [class]="icon"></i>
            </div>
            <div>
              <p *ngIf="eyebrow" class="text-[11px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">{{ eyebrow }}</p>
              <h3 class="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{{ title }}</h3>
              <p *ngIf="subtitle" class="mt-1 text-sm text-slate-500 dark:text-slate-300">{{ subtitle }}</p>
            </div>
          </div>
          <button *ngIf="closable" type="button" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100" (click)="closeRequested.emit()" aria-label="Chiudi dialog">
            <i class="pi pi-times text-sm"></i>
          </button>
        </div>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-6 pb-10 text-slate-700 dark:text-slate-200">
        <ng-content></ng-content>
      </div>
      <div *ngIf="hasFooter" class="sticky bottom-0 shrink-0 border-t border-slate-200 bg-slate-50/95 px-6 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-950/90">
        <ng-content select="[dialog-footer]"></ng-content>
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
        return 'bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_55%,#f8fafc_100%)] dark:bg-[linear-gradient(135deg,#12233f_0%,#0f172a_55%,#111c31_100%)]';
      case 'success':
        return 'bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_55%,#f8fafc_100%)] dark:bg-[linear-gradient(135deg,#0f2d25_0%,#0f172a_55%,#111c31_100%)]';
      case 'warn':
        return 'bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_55%,#f8fafc_100%)] dark:bg-[linear-gradient(135deg,#332114_0%,#0f172a_55%,#111c31_100%)]';
      case 'danger':
        return 'bg-[linear-gradient(135deg,#fef2f2_0%,#ffffff_55%,#f8fafc_100%)] dark:bg-[linear-gradient(135deg,#36171d_0%,#0f172a_55%,#111c31_100%)]';
      default:
        return 'bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_55%,#f8fafc_100%)] dark:bg-[linear-gradient(135deg,#132034_0%,#0f172a_55%,#111c31_100%)]';
    }
  }

  protected iconClass() {
    switch (this.tone) {
      case 'info':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200';
      case 'success':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200';
      case 'warn':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200';
      case 'danger':
        return 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
    }
  }
}
