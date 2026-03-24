import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="ui-page-header" [ngClass]="headerClass">
      <div class="ui-page-header__copy">
        <p *ngIf="eyebrow" class="ui-eyebrow" [ngClass]="eyebrowClass">{{ eyebrow }}</p>
        <h1 class="ui-page-title" [ngClass]="titleClass">{{ title }}</h1>
        <p *ngIf="subtitle" class="ui-page-subtitle" [ngClass]="subtitleClass">{{ subtitle }}</p>
      </div>
      <div *ngIf="hasActions" class="ui-page-header__actions" [ngClass]="actionsClass">
        <ng-content select="[page-actions]"></ng-content>
      </div>
    </header>
  `
})
export class UiPageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() eyebrow?: string;
  @Input() subtitle?: string;
  @Input() hasActions = false;
  @Input() headerClass = '';
  @Input() eyebrowClass = '';
  @Input() titleClass = '';
  @Input() subtitleClass = '';
  @Input() actionsClass = '';
}
