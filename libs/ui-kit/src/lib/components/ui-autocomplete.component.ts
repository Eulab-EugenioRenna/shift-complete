import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteCompleteEvent, AutoCompleteModule } from 'primeng/autocomplete';

@Component({
  selector: 'ui-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule, AutoCompleteModule],
  template: `
    <div class="grid gap-2">
      <label *ngIf="label" class="text-sm font-medium text-slate-700">{{ label }}</label>
      <p-autoComplete
        [suggestions]="filteredOptions"
        [field]="field"
        [placeholder]="placeholder"
        [appendTo]="appendTo"
        [(ngModel)]="value"
        (ngModelChange)="valueChange.emit($event)"
        (completeMethod)="filter($event)"
      ></p-autoComplete>
    </div>
  `
})
export class UiAutocompleteComponent {
  @Input() label?: string;
  @Input() placeholder = 'Cerca';
  @Input() appendTo: 'body' | HTMLElement = 'body';
  @Input() field = 'label';
  @Input() options: Array<Record<string, unknown>> = [];
  @Input() value: unknown;
  @Output() valueChange = new EventEmitter<unknown>();

  filteredOptions: Array<Record<string, unknown>> = [];

  filter(event: AutoCompleteCompleteEvent) {
    const query = (event.query ?? '').toLowerCase();
    this.filteredOptions = this.options.filter((option) => String(option[this.field] ?? '').toLowerCase().includes(query));
  }
}
