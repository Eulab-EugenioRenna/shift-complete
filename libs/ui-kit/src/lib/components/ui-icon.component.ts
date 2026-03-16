import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-icon',
  standalone: true,
  imports: [CommonModule],
  template: `<i class="pi" [ngClass]="name"></i>`
})
export class UiIconComponent {
  @Input() name = 'pi-circle';
}
