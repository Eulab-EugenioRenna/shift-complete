import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { UiFeedbackService } from '../services/ui-feedback.service';

@Component({
  selector: 'app-feedback-center',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-feedback-center.component.html'
})
export class AppFeedbackCenterComponent {
  protected readonly feedback = inject(UiFeedbackService);
}
