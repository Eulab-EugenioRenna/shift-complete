import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ui-textarea',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <textarea
      class="ui-input ui-input--textarea"
      [placeholder]="placeholder"
      [disabled]="disabled"
      [readonly]="readonly"
      [rows]="rows"
      [ngModel]="value"
      (ngModelChange)="valueChange.emit($event)"
    ></textarea>
  `
})
export class UiTextareaComponent {
  @Input() value = '';
  @Input() placeholder = '';
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() rows = 4;
  @Output() valueChange = new EventEmitter<string>();
}
