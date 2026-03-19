import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, HostListener, QueryList, ViewChildren, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { SpotlightSearchService } from '../../core/services/spotlight-search.service';

@Component({
  selector: 'app-spotlight-search',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [dismissableMask]="true"
      [draggable]="false"
      [resizable]="false"
      [showHeader]="false"
      [style]="{ width: '48rem', maxWidth: '94vw', maxHeight: '90vh' }"
      [contentStyle]="{ padding: '0', overflow: 'hidden', borderRadius: '24px' }"
      (onHide)="spotlight.closeSpotlight()"
    >
      <div class="flex max-h-[90vh] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/70">
            <i class="pi pi-search text-sm text-slate-400"></i>
            <input
              class="w-full bg-transparent text-sm text-slate-900 outline-none dark:text-slate-100"
              [ngModel]="spotlight.query()"
              (ngModelChange)="spotlight.setQuery($event)"
              placeholder="Cerca eventi, risorse, inventario, persone, team..."
              autofocus
            />
            <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100" (click)="spotlight.closeSpotlight()" aria-label="Chiudi ricerca">
              <i class="pi pi-times text-sm"></i>
            </button>
          </div>
        </div>

        <div class="max-h-[calc(90vh-6.5rem)] overflow-y-auto px-3 py-3 pb-6">
          <div *ngIf="spotlight.loading()" class="px-3 py-10 text-center text-sm text-slate-400 dark:text-slate-500">Ricerca in corso...</div>
          <div *ngIf="!spotlight.loading() && !spotlight.results().length && spotlight.query().trim().length >= 2" class="px-3 py-10 text-center text-sm text-slate-400 dark:text-slate-500">Nessun risultato</div>
          <div *ngIf="!spotlight.loading() && spotlight.query().trim().length < 2" class="px-3 py-10 text-center text-sm text-slate-400 dark:text-slate-500">Digita almeno 2 caratteri per cercare.</div>
          <div *ngFor="let group of spotlight.groupedResults()" class="mb-4">
            <p class="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">{{ group.group }}</p>
            <button
              #resultButton
              type="button"
              *ngFor="let item of group.items"
              class="flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
              [ngClass]="spotlight.results()[spotlight.activeIndex()]?.id === item.id ? 'bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700' : ''"
              (click)="spotlight.activate(item)"
              (mouseenter)="spotlight.setActiveById(item.id)"
            >
              <span>
                <span class="block text-sm font-medium text-slate-900 dark:text-slate-100">{{ item.title }}</span>
                <span class="mt-1 block text-xs text-slate-500 dark:text-slate-400">{{ item.subtitle }}</span>
              </span>
              <i class="pi pi-arrow-up-right text-xs text-slate-300 dark:text-slate-600"></i>
            </button>
          </div>
        </div>
      </div>
    </p-dialog>
  `,
})
export class SpotlightSearchComponent implements AfterViewChecked {
  protected readonly spotlight = inject(SpotlightSearchService);
  @ViewChildren('resultButton') private readonly resultButtons?: QueryList<ElementRef<HTMLButtonElement>>;

  get visible(): boolean {
    return this.spotlight.open();
  }

  set visible(value: boolean) {
    if (!value) {
      this.spotlight.closeSpotlight();
    }
  }

  ngAfterViewChecked(): void {
    const index = this.spotlight.activeIndex();
    const button = this.resultButtons?.get(index)?.nativeElement;
    if (button) {
      button.scrollIntoView({ block: 'nearest' });
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.spotlight.openSpotlight();
      return;
    }

    if (!this.spotlight.open()) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.spotlight.closeSpotlight();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.spotlight.moveActive(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.spotlight.moveActive(-1);
      return;
    }

    if (event.key === 'Enter') {
      const item = this.spotlight.activeItem();
      if (item) {
        event.preventDefault();
        void this.spotlight.activate(item);
      }
    }
  }
}
