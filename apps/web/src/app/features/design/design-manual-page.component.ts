import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import {
  UiBadgeComponent,
  UiCardComponent,
  UiChipComponent,
  UiDialogShellComponent,
  UiLabelComponent,
  UiSidebarPanelComponent,
  UiTableShellComponent
} from '@shift-complete/ui-kit';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';

type Tone = 'neutral' | 'info' | 'success' | 'warn' | 'danger';

@Component({
  selector: 'app-design-manual-page',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TagModule,
    UiBadgeComponent,
    UiCardComponent,
    UiChipComponent,
    UiDialogShellComponent,
    UiLabelComponent,
    UiSidebarPanelComponent,
    UiTableShellComponent
  ],
  templateUrl: './design-manual-page.component.html'
})
export class DesignManualPageComponent {
  private readonly feedback = inject(UiFeedbackService);

  protected readonly tones: Tone[] = ['neutral', 'info', 'success', 'warn', 'danger'];
  protected readonly activeFilter = signal<Tone>('info');
  protected readonly activeSegment = signal<'tag' | 'filter' | 'feedback'>('tag');

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
}
