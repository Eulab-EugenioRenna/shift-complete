import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, QueryList, ViewChildren, inject, signal } from '@angular/core';
import {
  UiBadgeComponent,
  UiButtonComponent,
  UiCardComponent,
  UiChipComponent,
  UiConfirmDialogComponent,
  UiDialogShellComponent,
  UiFieldComponent,
  UiFormSectionComponent,
  UiInputComponent,
  UiLabelComponent,
  UiPageHeaderComponent,
  UiSurfaceComponent,
  UiTextareaComponent,
  UiTableShellComponent
} from '@shift-complete/ui-kit';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';

type Tone = 'neutral' | 'info' | 'success' | 'warn' | 'danger';

@Component({
  selector: 'app-design-manual-page',
  standalone: true,
  imports: [
    CommonModule,
    UiBadgeComponent,
    UiButtonComponent,
    UiCardComponent,
    UiChipComponent,
    UiConfirmDialogComponent,
    UiDialogShellComponent,
    UiFieldComponent,
    UiFormSectionComponent,
    UiInputComponent,
    UiLabelComponent,
    UiPageHeaderComponent,
    UiSurfaceComponent,
    UiTextareaComponent,
    UiTableShellComponent
  ],
  templateUrl: './design-manual-page.component.html'
})
export class DesignManualPageComponent {
  private readonly feedback = inject(UiFeedbackService);
  private readonly ngZone = inject(NgZone);
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;

  protected readonly tones: Tone[] = ['neutral', 'info', 'success', 'warn', 'danger'];
  protected readonly activeFilter = signal<Tone>('info');
  protected readonly activeSegment = signal<'tag' | 'filter' | 'feedback'>('tag');
  protected readonly masonrySpans = signal<Record<string, number>>({});
  protected readonly visibleCards = signal<Record<string, boolean>>({});

  @ViewChildren('masonryItem')
  private readonly masonryItems?: QueryList<ElementRef<HTMLElement>>;

  protected setFilter(tone: Tone): void {
    this.activeFilter.set(tone);
  }

  protected setSegment(segment: 'tag' | 'filter' | 'feedback'): void {
    this.activeSegment.set(segment);
  }

  protected triggerFeedback(tone: Tone): void {
    switch (tone) {
      case 'success':
        this.feedback.success('Operazione completata', 'Il pattern visuale puo essere riutilizzato in tutte le pagine.');
        break;
      case 'warn':
        this.feedback.info('Controllo richiesto', 'Usa warn per attenzione operativa, non per errori bloccanti.');
        break;
      case 'danger':
        this.feedback.error('Azione rifiutata', 'Danger resta riservato a errori, rifiuti ed eliminazioni.');
        break;
      case 'neutral':
        this.feedback.info('Aggiornamento neutro', 'Neutral serve per contesto e stato passivo.');
        break;
      default:
        this.feedback.info('Informazione disponibile', 'Info identifica suggerimenti, evidenze e azioni primarie.');
        break;
    }
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => this.measureMasonry());
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          const next = { ...this.visibleCards() };
          let changed = false;
          for (const entry of entries) {
            const key = (entry.target as HTMLElement).dataset['key'];
            if (!key || !entry.isIntersecting || next[key]) continue;
            next[key] = true;
            changed = true;
          }
          if (changed) {
            this.ngZone.run(() => this.visibleCards.set(next));
          }
        },
        { threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
      );

      queueMicrotask(() => {
        this.observeMasonryItems();
        this.measureMasonry();
      });

      this.masonryItems?.changes.subscribe(() => {
        this.observeMasonryItems();
        this.measureMasonry();
      });

      window.addEventListener('resize', this.measureMasonry, { passive: true });
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener('resize', this.measureMasonry);
  }

  protected masonrySpan(key: string): number {
    return this.masonrySpans()[key] ?? 1;
  }

  protected cardVisible(key: string): boolean {
    return Boolean(this.visibleCards()[key]);
  }

  private observeMasonryItems = (): void => {
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    for (const item of this.masonryItems?.toArray() ?? []) {
      this.resizeObserver?.observe(item.nativeElement);
      this.intersectionObserver?.observe(item.nativeElement);
    }
  };

  private measureMasonry = (): void => {
    const next: Record<string, number> = {};
    for (const item of this.masonryItems?.toArray() ?? []) {
      const element = item.nativeElement;
      const key = element.dataset['key'];
      if (!key) continue;
      const parent = element.parentElement;
      const computedStyle = parent ? getComputedStyle(parent) : null;
      const rowHeight = 10;
      const rowGap = computedStyle ? parseFloat(computedStyle.rowGap || '0') || 0 : 0;
      const height = element.getBoundingClientRect().height;
      next[key] = Math.max(1, Math.ceil((height + rowGap) / (rowHeight + rowGap)));
    }
    this.ngZone.run(() => this.masonrySpans.set(next));
  };
}
