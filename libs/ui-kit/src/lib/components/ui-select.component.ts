import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';

@Component({
  selector: 'ui-select',
  standalone: true,
  imports: [CommonModule, FormsModule, DropdownModule],
  template: `
    <div class="grid gap-2">
      <label *ngIf="label" class="text-sm font-medium text-slate-700">{{ label }}</label>
      <p-dropdown
        [options]="options"
        [optionLabel]="optionLabel"
        [optionValue]="optionValue"
        [placeholder]="placeholder"
        [appendTo]="appendTo"
        [(ngModel)]="value"
        (ngModelChange)="valueChange.emit($event)"
      ></p-dropdown>
    </div>
  `
})
export class UiSelectComponent {
  @Input() label?: string;
  @Input() placeholder = 'Seleziona';
  @Input() appendTo: 'body' | HTMLElement = 'body';
  @Input() options: Array<Record<string, unknown>> = [];
  @Input() optionLabel = 'label';
  @Input() optionValue = 'value';
  @Input() value: unknown;
  @Output() valueChange = new EventEmitter<unknown>();
}
