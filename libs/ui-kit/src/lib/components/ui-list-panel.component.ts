import { CommonModule } from '@angular/common';
import { Component, Directive, Input, contentChild } from '@angular/core';

@Directive({
  selector: '[uiListPanelHeaderActions]',
  standalone: true,
})
export class UiListPanelHeaderActionsDirective {}

@Directive({
  selector: '[uiListPanelFooter]',
  standalone: true,
})
export class UiListPanelFooterDirective {}

@Directive({
  selector: '[uiListPanelBody]',
  standalone: true,
})
export class UiListPanelBodyDirective {}

@Component({
  selector: 'ui-list-panel',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      :host {
        display: block;
        min-height: 0;
      }
    `
  ],
  template: `
    <section
      class="overflow-hidden rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] shadow-[var(--shadow-soft)]"
      [class.h-full]="fullHeight"
      [class.flex]="fullHeight || growBody"
      [class.flex-col]="fullHeight || growBody"
      [ngClass]="panelClass"
    >
      <div
        class="flex items-center justify-between gap-4 border-b border-[color:var(--border-soft)] px-5 py-4"
        [ngClass]="headerClass"
      >
        <div class="min-w-0">
          <h3 class="flex items-center gap-2 text-lg font-semibold text-[color:var(--text-1)]">
            <i *ngIf="icon" [class]="icon"></i>
            <span>{{ title }}</span>
          </h3>
          <p *ngIf="subtitle" class="mt-1 text-sm text-[color:var(--text-2)]">{{ subtitle }}</p>
        </div>
        <div *ngIf="headerActions()" class="shrink-0">
          <ng-content select="[uiListPanelHeaderActions]"></ng-content>
        </div>
      </div>

      <div class="min-h-0" [class.flex-1]="growBody" [class.overflow-y-auto]="scrollBody" [ngClass]="bodyClass">
        <ng-content select="[uiListPanelBody]"></ng-content>
      </div>

      <div
        *ngIf="footer()"
        class="border-t border-[color:var(--border-soft)] bg-[color:var(--surface-2)] px-5 py-3"
        [ngClass]="footerClass"
      >
        <ng-content select="[uiListPanelFooter]"></ng-content>
      </div>
    </section>
  `,
})
export class UiListPanelComponent {
  protected readonly headerActions = contentChild(UiListPanelHeaderActionsDirective);
  protected readonly footer = contentChild(UiListPanelFooterDirective);

  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() icon?: string;
  @Input() fullHeight = false;
  @Input() growBody = true;
  @Input() scrollBody = true;
  @Input() panelClass = '';
  @Input() headerClass = '';
  @Input() bodyClass = '';
  @Input() footerClass = '';
}
