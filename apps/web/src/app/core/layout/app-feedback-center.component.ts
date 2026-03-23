import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { UiFeedbackService } from '../services/ui-feedback.service';
import { ActionFeedbackItem } from '@shift-complete/shared-types';

@Component({
  selector: 'app-feedback-center',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-feedback-center.component.html'
})
export class AppFeedbackCenterComponent {
  protected readonly feedback = inject(UiFeedbackService);

  protected cardClasses(item: ActionFeedbackItem): string {
    switch (item.type) {
      case 'success':
        return 'border-emerald-600 bg-emerald-600 text-white';
      case 'error':
        return 'border-red-600 bg-red-600 text-white';
      default:
        return 'border-[#4979e6] bg-[#4979e6] text-white';
    }
  }

  protected iconClasses(item: ActionFeedbackItem): string {
    switch (item.type) {
      case 'success':
        return 'bg-white/20 text-white';
      case 'error':
        return 'bg-white/20 text-white';
      default:
        return 'bg-white/20 text-white';
    }
  }

  protected titleClasses(item: ActionFeedbackItem): string {
    switch (item.type) {
      case 'success':
        return 'text-white';
      case 'error':
        return 'text-white';
      default:
        return 'text-white';
    }
  }

  protected messageClasses(item: ActionFeedbackItem): string {
    switch (item.type) {
      case 'success':
        return 'text-white/88';
      case 'error':
        return 'text-white/88';
      default:
        return 'text-white/88';
    }
  }

  protected dismissClasses(item: ActionFeedbackItem): string {
    switch (item.type) {
      case 'success':
        return 'text-white/70 hover:text-white';
      case 'error':
        return 'text-white/70 hover:text-white';
      default:
        return 'text-white/70 hover:text-white';
    }
  }
}
