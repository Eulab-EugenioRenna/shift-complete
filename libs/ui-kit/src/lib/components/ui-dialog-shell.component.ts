import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

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
    <section class="dialog-shell overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_24px_70px_-34px_rgba(15,23,42,0.34)]">
      <header class="border-b border-slate-200 px-6 py-5" [ngClass]="headerClass()">
        <div class="flex items-start gap-4">
          <div *ngIf="icon" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg" [ngClass]="iconClass()">
            <i [class]="icon"></i>
          </div>
          <div>
            <p *ngIf="eyebrow" class="text-[11px] uppercase tracking-[0.3em] text-slate-400">{{ eyebrow }}</p>
            <h3 class="mt-1 text-xl font-semibold text-slate-900">{{ title }}</h3>
            <p *ngIf="subtitle" class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>
          </div>
        </div>
      </header>
      <div class="p-6">
        <ng-content></ng-content>
      </div>
      <div *ngIf="hasFooter" class="border-t border-slate-200 bg-slate-50/80 px-6 py-4">
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

  protected headerClass() {
    switch (this.tone) {
      case 'info':
        return 'bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_55%,#f8fafc_100%)]';
      case 'success':
        return 'bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_55%,#f8fafc_100%)]';
      case 'warn':
        return 'bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_55%,#f8fafc_100%)]';
      case 'danger':
        return 'bg-[linear-gradient(135deg,#fef2f2_0%,#ffffff_55%,#f8fafc_100%)]';
      default:
        return 'bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_55%,#f8fafc_100%)]';
    }
  }

  protected iconClass() {
    switch (this.tone) {
      case 'info':
        return 'bg-blue-100 text-blue-700';
      case 'success':
        return 'bg-emerald-100 text-emerald-700';
      case 'warn':
        return 'bg-amber-100 text-amber-700';
      case 'danger':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }
}
