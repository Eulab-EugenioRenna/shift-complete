import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ui-chip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="ui-chip"
      [ngClass]="chipClass"
      [disabled]="disabled || !interactive"
      [attr.aria-pressed]="selected"
      (click)="chipClick.emit()"
    >
      <span *ngIf="dot" class="ui-chip-dot"></span>
      <ng-content />
    </button>
  `
})
export class UiChipComponent {
  @Input() tone: 'neutral' | 'info' | 'success' | 'warn' | 'danger' = 'neutral';
  @Input() selected = false;
  @Input() disabled = false;
  @Input() interactive = true;
  @Input() dot = false;
  @Output() chipClick = new EventEmitter<void>();

  get chipClass(): string[] {
    return [
      this.selected ? 'ui-chip--active' : 'ui-chip--idle',
      `ui-tone-${this.tone}`,
      this.disabled ? 'ui-chip--disabled' : ''
    ].filter(Boolean);
  }
}
