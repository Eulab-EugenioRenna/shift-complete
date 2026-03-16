import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppFeedbackCenterComponent } from './core/layout/app-feedback-center.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppFeedbackCenterComponent],
  template: '<router-outlet /><app-feedback-center />'
})
export class AppComponent {}
