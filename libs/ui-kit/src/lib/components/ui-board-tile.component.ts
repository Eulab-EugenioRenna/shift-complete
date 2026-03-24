import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-board-tile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-3 py-3 text-sm shadow-[var(--shadow-soft)]" [ngClass]="tileClass">
      <ng-content></ng-content>
    </article>
  `
})
export class UiBoardTileComponent {
  @Input() tileClass = '';
}
