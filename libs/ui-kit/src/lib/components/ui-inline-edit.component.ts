import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ui-inline-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="inline-flex min-w-48 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <input class="w-full bg-transparent text-sm text-slate-800 outline-none" [(ngModel)]="draft" [placeholder]="placeholder" />
      <button type="button" class="text-xs font-medium text-slate-500" (click)="save()">Salva</button>
    </div>
  `
})
export class UiInlineEditComponent {
  @Input() value = '';
  @Input() placeholder = 'Modifica valore';
  @Output() valueChange = new EventEmitter<string>();

  get draft() {
    return this.value;
  }

  set draft(value: string) {
    this.value = value;
  }

  save() {
    this.valueChange.emit(this.value.trim());
  }
}
