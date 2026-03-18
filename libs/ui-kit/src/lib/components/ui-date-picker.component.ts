import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';

@Component({
  selector: 'ui-date-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerModule],
  template: `
    <div class="grid gap-2">
      <label *ngIf="label" class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ label }}</label>
      <p-datepicker
        [(ngModel)]="value"
        (ngModelChange)="valueChange.emit($event)"
        [showTime]="showTime"
        [hourFormat]="hourFormat"
        [dateFormat]="dateFormat"
        [appendTo]="appendTo"
        [baseZIndex]="baseZIndex"
        [showIcon]="showIcon"
        [iconDisplay]="iconDisplay"
        [placeholder]="placeholder"
        [minDate]="minDate"
        [maxDate]="maxDate"
        [disabled]="disabled"
        [inputStyleClass]="inputStyleClass"
      ></p-datepicker>
      <p *ngIf="hint" class="text-xs text-slate-500 dark:text-slate-400">{{ hint }}</p>
    </div>
  `
})
export class UiDatePickerComponent {
  @Input() label?: string;
  @Input() hint?: string;
  @Input() placeholder?: string;
  @Input() showTime = false;
  @Input() hourFormat: '12' | '24' = '24';
  @Input() dateFormat = 'dd/mm/yy';
  @Input() appendTo: 'body' | HTMLElement = 'body';
  @Input() baseZIndex = 1300;
  @Input() showIcon = false;
  @Input() iconDisplay: 'button' | 'input' = 'input';
  @Input() minDate?: Date;
  @Input() maxDate?: Date;
  @Input() disabled = false;
  @Input() inputStyleClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
  @Input() value: Date | null = null;
  @Output() valueChange = new EventEmitter<Date | null>();
}
