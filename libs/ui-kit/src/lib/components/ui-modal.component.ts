import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { UiDialogShellComponent } from './ui-dialog-shell.component';

@Component({
  selector: 'ui-modal',
  standalone: true,
  imports: [CommonModule, DialogModule, UiDialogShellComponent],
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="visibleChange.emit($event)"
      [modal]="true"
      [appendTo]="'body'"
      [baseZIndex]="baseZIndex"
      [blockScroll]="true"
      [dismissableMask]="dismissableMask"
      [closeOnEscape]="closeOnEscape"
      [focusOnShow]="false"
      [showHeader]="false"
      [closable]="false"
      [style]="{ width: width, maxWidth: maxWidth, maxHeight: maxHeight }"
      [contentStyle]="{ background: 'transparent', padding: '0', overflow: 'hidden' }"
      [draggable]="false"
      [resizable]="false"
    >
      <ui-dialog-shell
        [title]="title"
        [eyebrow]="eyebrow"
        [subtitle]="subtitle"
        [icon]="icon"
        [tone]="tone"
        [hasFooter]="hasFooter"
        [closable]="closable"
        (closeRequested)="closeRequested.emit()"
      >
        <div dialog-body>
          <ng-content select=":not([dialog-footer])"></ng-content>
        </div>
        <div dialog-footer-slot>
          <ng-content select="[dialog-footer]"></ng-content>
        </div>
      </ui-dialog-shell>
    </p-dialog>
  `
})
export class UiModalComponent {
  @Input() visible = false;
  @Input() title = 'Dialog';
  @Input() eyebrow?: string;
  @Input() subtitle?: string;
  @Input() icon?: string;
  @Input() tone: 'default' | 'info' | 'success' | 'warn' | 'danger' = 'default';
  @Input() hasFooter = false;
  @Input() closable = true;
  @Input() dismissableMask = true;
  @Input() closeOnEscape = true;
  @Input() width = '48rem';
  @Input() maxWidth = '96vw';
  @Input() maxHeight = '90vh';
  @Input() baseZIndex = 1200;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() closeRequested = new EventEmitter<void>();
}
