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
      [ngClass]="value ? 'border-slate-950 bg-slate-950 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950' : 'border-slate-300 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'"
      (click)="toggle()"
    >
      <span class="relative h-5 w-9 rounded-full" [ngClass]="value ? 'bg-white/20 dark:bg-slate-800' : 'bg-slate-200 dark:bg-slate-700'">
        <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition dark:bg-slate-100" [ngClass]="value ? 'left-4' : 'left-0.5'"></span>
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
