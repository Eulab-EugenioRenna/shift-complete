import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-surface',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="ui-surface" [ngClass]="surfaceClass">
      <ng-content></ng-content>
    </section>
  `
})
export class UiSurfaceComponent {
  @Input() surfaceClass = '';
}
