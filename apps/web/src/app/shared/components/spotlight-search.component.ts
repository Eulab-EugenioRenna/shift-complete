import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, HostListener, QueryList, ViewChildren, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SpotlightSearchService } from '../../core/services/spotlight-search.service';

@Component({
  selector: 'app-spotlight-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="visible" class="fixed inset-0 z-[1200]">
      <button type="button" class="spotlight-backdrop absolute inset-0 bg-[color:color-mix(in_srgb,var(--accent-1)_8%,transparent)] backdrop-blur-3xl backdrop-saturate-150" (click)="spotlight.closeSpotlight()" aria-label="Chiudi ricerca"></button>
      <div class="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div class="spotlight-panel w-[min(42rem,92vw)] overflow-hidden rounded-[28px] border border-[color:color-mix(in_srgb,var(--border-soft)_65%,white)] bg-[color:color-mix(in_srgb,var(--surface-1)_78%,transparent)] shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] backdrop-blur-2xl">
          <div class="border-b border-[color:var(--border-soft)] px-5 py-4">
            <div class="flex items-center gap-3">
              <i class="pi pi-search text-sm text-[color:var(--text-3)]"></i>
              <input
                class="w-full appearance-none border-0 bg-transparent px-0 py-0 text-sm text-[color:var(--text-1)] outline-none placeholder:text-[color:var(--text-3)] shadow-none"
                [ngModel]="spotlight.query()"
                (ngModelChange)="spotlight.setQuery($event)"
                placeholder="Cerca eventi, risorse, inventario, persone, team..."
                autofocus
              />
              <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-3)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text-1)]" (click)="spotlight.closeSpotlight()" aria-label="Chiudi ricerca">
                <i class="pi pi-times text-sm"></i>
              </button>
            </div>
          </div>

          <div class="max-h-[min(32rem,calc(100vh-9rem))] overflow-y-auto px-3 py-3 pb-6">
            <div *ngIf="spotlight.loading()" class="px-3 py-10 text-center text-sm text-[color:var(--text-3)]">Ricerca in corso...</div>
            <div *ngIf="!spotlight.loading() && !spotlight.results().length && spotlight.query().trim().length >= 2" class="px-3 py-10 text-center text-sm text-[color:var(--text-3)]">Nessun risultato</div>
            <div *ngIf="!spotlight.loading() && spotlight.query().trim().length < 2" class="px-3 py-10 text-center text-sm text-[color:var(--text-3)]">Digita almeno 2 caratteri per cercare.</div>
            <div *ngFor="let group of spotlight.groupedResults()" class="mb-4">
              <p class="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-3)]">{{ group.group }}</p>
              <button
                #resultButton
                type="button"
                *ngFor="let item of group.items"
                class="flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[color:var(--surface-2)]"
                [ngClass]="spotlight.results()[spotlight.activeIndex()]?.id === item.id ? 'bg-[color:var(--surface-3)] ring-1 ring-[color:var(--border-soft)]' : ''"
                (click)="spotlight.activate(item)"
                (mouseenter)="spotlight.setActiveById(item.id)"
              >
                <span>
                  <span class="block text-sm font-medium text-[color:var(--text-1)]">{{ item.title }}</span>
                  <span class="mt-1 block text-xs text-[color:var(--text-2)]">{{ item.subtitle }}</span>
                </span>
                <i class="pi pi-arrow-up-right text-xs text-[color:var(--text-3)]"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .spotlight-backdrop {
      animation: spotlightBackdropIn 180ms ease-out;
    }

    .spotlight-panel {
      animation: spotlightPanelIn 220ms cubic-bezier(0.22, 1, 0.36, 1);
      transform-origin: center top;
    }

    .spotlight-panel input {
      background: transparent;
      background-color: transparent;
    }

    .spotlight-panel input:-webkit-autofill,
    .spotlight-panel input:-webkit-autofill:hover,
    .spotlight-panel input:-webkit-autofill:focus {
      -webkit-text-fill-color: var(--text-1);
      -webkit-box-shadow: 0 0 0 1000px transparent inset;
      transition: background-color 9999s ease-out 0s;
    }

    @keyframes spotlightBackdropIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes spotlightPanelIn {
      from {
        opacity: 0;
        transform: translateY(18px) scale(0.985);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .spotlight-backdrop,
      .spotlight-panel {
        animation: none;
      }
    }
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
