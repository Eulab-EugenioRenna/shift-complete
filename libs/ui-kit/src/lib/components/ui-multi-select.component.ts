import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MultiSelectModule } from 'primeng/multiselect';

@Component({
  selector: 'ui-multi-select',
  standalone: true,
  imports: [CommonModule, FormsModule, MultiSelectModule],
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-width: 0;
    }
  `],
  template: `
    <div class="grid gap-2">
      <label *ngIf="label" class="text-sm font-medium text-[color:var(--text-2)]">{{ label }}</label>
      <p-multiSelect
        [options]="options"
        [optionLabel]="optionLabel"
        [optionValue]="optionValue"
        [placeholder]="placeholder"
        [appendTo]="appendTo"
        [display]="display"
        [selectedItemsLabel]="selectedItemsLabel"
        [maxSelectedLabels]="maxSelectedLabels"
        [(ngModel)]="value"
        (ngModelChange)="valueChange.emit($event)"
      ></p-multiSelect>
    </div>
  `
})
export class UiMultiSelectComponent {
  @Input() label?: string;
  @Input() placeholder = 'Seleziona';
  @Input() appendTo: 'body' | HTMLElement = 'body';
  @Input() options: Array<Record<string, unknown>> = [];
  @Input() optionLabel = 'label';
  @Input() optionValue = 'value';
  @Input() display: 'comma' | 'chip' = 'chip';
  @Input() selectedItemsLabel = '{0} selezionati';
  @Input() maxSelectedLabels = 2;
  @Input() value: unknown[] = [];
  @Output() valueChange = new EventEmitter<unknown[]>();
}
