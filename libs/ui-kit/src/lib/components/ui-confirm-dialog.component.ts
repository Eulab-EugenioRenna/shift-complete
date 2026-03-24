import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UiButtonComponent } from './ui-button.component';
import { UiModalComponent } from './ui-modal.component';
import { UiSurfaceComponent } from './ui-surface.component';

@Component({
  selector: 'ui-confirm-dialog',
  standalone: true,
  imports: [CommonModule, UiButtonComponent, UiModalComponent, UiSurfaceComponent],
  template: `
    <ui-modal
      [visible]="visible"
      (visibleChange)="handleVisibleChange($event)"
      [title]="title"
      [eyebrow]="eyebrow"
      [subtitle]="subtitle"
      [icon]="resolvedIcon()"
      [tone]="modalTone()"
      [hasFooter]="true"
      [width]="width"
      [maxWidth]="maxWidth"
      [dismissableMask]="!busy"
      [closeOnEscape]="!busy"
      [closable]="!busy"
      (closeRequested)="handleCancel()"
    >
      <div class="grid gap-4">
        <p class="text-sm font-semibold text-[color:var(--text-1)]">{{ message }}</p>
        <ui-surface *ngIf="detail" [surfaceClass]="detailClass()">
          <p class="text-sm text-[color:var(--text-2)]">{{ detail }}</p>
        </ui-surface>
      </div>
      <div dialog-footer class="flex items-center justify-end gap-3">
        <ui-button tone="neutral" variant="outlined" [disabled]="busy" (buttonClick)="handleCancel()">{{ cancelLabel }}</ui-button>
        <ui-button [tone]="buttonTone()" [disabled]="busy || confirmDisabled" (buttonClick)="confirm.emit()">{{ busy ? busyLabel : confirmLabel }}</ui-button>
      </div>
    </ui-modal>
  `,
})
export class UiConfirmDialogComponent {
  @Input() visible = false;
  @Input() title = 'Confermare azione?';
  @Input() eyebrow = 'Conferma';
  @Input() subtitle = 'Verifica l operazione prima di continuare.';
  @Input() message = '';
  @Input() detail?: string;
  @Input() tone: 'confirm' | 'danger' = 'confirm';
  @Input() icon?: string;
  @Input() confirmLabel = 'Conferma';
  @Input() cancelLabel = 'Annulla';
  @Input() busyLabel = 'Operazione in corso...';
  @Input() confirmDisabled = false;
  @Input() busy = false;
  @Input() width = '34rem';
  @Input() maxWidth = '94vw';
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  protected modalTone(): 'success' | 'danger' {
    return this.tone === 'danger' ? 'danger' : 'success';
  }

  protected buttonTone(): 'success' | 'danger' {
    return this.tone === 'danger' ? 'danger' : 'success';
  }

  protected resolvedIcon(): string {
    if (this.icon) {
      return this.icon;
    }

    return this.tone === 'danger' ? 'pi pi-exclamation-triangle' : 'pi pi-check-circle';
  }

  protected detailClass(): string {
    return this.tone === 'danger'
      ? 'border border-red-200 bg-red-50 p-4'
      : 'border border-emerald-200 bg-emerald-50 p-4';
  }

  protected handleVisibleChange(nextVisible: boolean): void {
    this.visibleChange.emit(nextVisible);
    if (!nextVisible && this.visible) {
      this.cancel.emit();
    }
  }

  protected handleCancel(): void {
    this.visibleChange.emit(false);
    this.cancel.emit();
  }
}
