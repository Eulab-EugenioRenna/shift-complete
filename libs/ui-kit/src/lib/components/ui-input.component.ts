import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ui-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-width: 0;
    }
  `],
  template: `
    <input
      class="ui-input"
      [ngClass]="{
        'ui-input--mono': mono
      }"
      [type]="type"
      [placeholder]="placeholder"
      [disabled]="disabled"
      [readonly]="readonly"
      [autocomplete]="autocomplete"
      [ngModel]="value"
      (ngModelChange)="valueChange.emit($event)"
    />
  `
})
export class UiInputComponent {
  @Input() value = '';
  @Input() type = 'text';
  @Input() placeholder = '';
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() mono = false;
  @Input() autocomplete?: string;
  @Output() valueChange = new EventEmitter<string>();
}
