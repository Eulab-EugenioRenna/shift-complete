import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-field',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid gap-2">
      <label *ngIf="label" class="text-sm font-medium text-[color:var(--text-2)]">{{ label }}</label>
      <ng-content></ng-content>
      <p *ngIf="hint" class="text-xs text-[color:var(--text-3)]">{{ hint }}</p>
    </div>
  `
})
export class UiFieldComponent {
  @Input() label?: string;
  @Input() hint?: string;
}
