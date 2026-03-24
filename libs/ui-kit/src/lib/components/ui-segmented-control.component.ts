import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ui-segmented-control',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] p-1 shadow-[var(--shadow-soft)]" [ngClass]="controlClass">
      <button
        type="button"
        *ngFor="let option of options"
        class="rounded-2xl px-4 py-2 text-sm transition"
        [ngClass]="value === option.value ? activeClass : inactiveClass"
        (click)="valueChange.emit(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  `
})
export class UiSegmentedControlComponent {
  @Input() options: Array<{ label: string; value: string }> = [];
  @Input() value?: string;
  @Input() controlClass = '';
  @Input() activeClass = 'bg-[#4979e6] text-white';
  @Input() inactiveClass = 'text-[color:var(--text-2)] hover:text-[color:var(--text-1)]';
  @Output() valueChange = new EventEmitter<string>();
}
