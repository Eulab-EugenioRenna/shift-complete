import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { UiChipComponent } from '@shift-complete/ui-kit';
import { UiFeedbackService } from '../services/ui-feedback.service';
import { ActionFeedbackItem } from '@shift-complete/shared-types';

@Component({
  selector: 'app-feedback-center',
  standalone: true,
  imports: [CommonModule, UiChipComponent],
  templateUrl: './app-feedback-center.component.html'
})
export class AppFeedbackCenterComponent {
  protected readonly feedback = inject(UiFeedbackService);

  private toneClass(item: ActionFeedbackItem): string {
    switch (item.type) {
      case 'success':
        return 'ui-tone-success';
      case 'error':
        return 'ui-tone-danger';
      default:
        return 'ui-tone-info';
    }
  }

  protected cardClasses(item: ActionFeedbackItem): string {
    return `${this.toneClass(item)} border-[color:var(--ui-tone-border)] bg-[color:var(--ui-tone-soft)] text-[color:var(--ui-tone-text)]`;
  }

  protected iconClasses(item: ActionFeedbackItem): string {
    return `${this.toneClass(item)} bg-[color:var(--ui-tone-solid)] text-white`;
  }

  protected titleClasses(item: ActionFeedbackItem): string {
    return `${this.toneClass(item)} text-[color:var(--ui-tone-text)]`;
  }

  protected messageClasses(item: ActionFeedbackItem): string {
    return 'text-[color:var(--text-2)]';
  }

  protected dismissClasses(item: ActionFeedbackItem): string {
    return `${this.toneClass(item)} text-[color:var(--ui-tone-text)] opacity-70 hover:opacity-100`;
  }
}
