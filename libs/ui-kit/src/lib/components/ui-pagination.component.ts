import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ui-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-3 text-sm text-[color:var(--text-2)] shadow-[var(--shadow-soft)]">
      <span>Pagina {{ page }} di {{ totalPages }}</span>
      <div class="flex gap-2">
        <button type="button" class="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-2)] px-3 py-2 text-[color:var(--text-2)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-1)] disabled:cursor-not-allowed disabled:opacity-50" (click)="change(page - 1)" [disabled]="page <= 1">Prec</button>
        <button type="button" class="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-2)] px-3 py-2 text-[color:var(--text-2)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-1)] disabled:cursor-not-allowed disabled:opacity-50" (click)="change(page + 1)" [disabled]="page >= totalPages">Succ</button>
      </div>
    </div>
  `
})
export class UiPaginationComponent {
  @Input() page = 1;
  @Input() totalPages = 1;
  @Output() pageChange = new EventEmitter<number>();

  change(page: number) {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.pageChange.emit(page);
  }
}
