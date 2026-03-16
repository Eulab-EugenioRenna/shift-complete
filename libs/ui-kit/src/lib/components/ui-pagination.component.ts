import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ui-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
      <span>Pagina {{ page }} di {{ totalPages }}</span>
      <div class="flex gap-2">
        <button type="button" class="rounded-xl border border-slate-200 px-3 py-2" (click)="change(page - 1)" [disabled]="page <= 1">Prec</button>
        <button type="button" class="rounded-xl border border-slate-200 px-3 py-2" (click)="change(page + 1)" [disabled]="page >= totalPages">Succ</button>
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
