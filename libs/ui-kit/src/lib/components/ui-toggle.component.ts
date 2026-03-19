import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ui-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="inline-flex items-center gap-3 rounded-full border px-3 py-2 text-sm transition"
      [ngClass]="value ? 'border-[color:var(--accent-1)] bg-[color:var(--accent-1)] text-white dark:text-[color:var(--text-inverse)]' : 'border-[color:var(--border-soft)] bg-[color:var(--surface-1)] text-[color:var(--text-2)]'"
      (click)="toggle()"
    >
      <span class="relative h-5 w-9 rounded-full" [ngClass]="value ? 'bg-white/20' : 'bg-[color:var(--surface-3)]'">
        <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition dark:bg-[color:var(--surface-1)]" [ngClass]="value ? 'left-4' : 'left-0.5'"></span>
      </span>
      <span>{{ label }}</span>
    </button>
  `
})
export class UiToggleComponent {
  @Input() label = 'Toggle';
  @Input() value = false;
  @Output() valueChange = new EventEmitter<boolean>();

  toggle() {
    this.valueChange.emit(!this.value);
  }
}
