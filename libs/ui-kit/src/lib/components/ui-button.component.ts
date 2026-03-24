import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ui-button',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host {
      display: inline-flex;
      min-width: 0;
    }
  `],
  template: `
    <button
      [type]="type"
      [disabled]="disabled"
      class="ui-button"
      [ngClass]="buttonClass"
      (click)="buttonClick.emit($event)"
    >
      <i *ngIf="icon && iconPosition === 'left'" [class]="icon" class="text-xs"></i>
      <ng-content></ng-content>
      <i *ngIf="icon && iconPosition === 'right'" [class]="icon" class="text-xs"></i>
    </button>
  `
})
export class UiButtonComponent {
  @Input() tone: 'neutral' | 'info' | 'success' | 'warn' | 'danger' = 'info';
  @Input() variant: 'solid' | 'outlined' | 'text' = 'solid';
  @Input() size: 'sm' | 'md' = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() icon?: string;
  @Input() iconPosition: 'left' | 'right' = 'left';
  @Output() buttonClick = new EventEmitter<Event>();

  get buttonClass(): string[] {
    return [
      `ui-button--${this.variant}`,
      `ui-button--${this.size}`,
      `ui-tone-${this.tone}`
    ];
  }
}
