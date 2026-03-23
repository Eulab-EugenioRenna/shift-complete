import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ui-inline-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="inline-flex min-w-48 items-center gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-3 py-2 text-[color:var(--text-2)] shadow-[var(--shadow-soft)]">
      <input class="w-full bg-transparent text-sm text-[color:var(--text-1)] outline-none placeholder:text-[color:var(--text-3)]" [(ngModel)]="draft" [placeholder]="placeholder" />
      <button type="button" class="text-xs font-medium text-[color:var(--text-2)] transition hover:text-[color:var(--accent-1)]" (click)="save()">Salva</button>
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
