import { Directive, HostBinding, Input } from '@angular/core';

@Directive({
  selector: '[uiTooltip]',
  standalone: true,
})
export class UiTooltipDirective {
  @Input('uiTooltip') text = '';

  @HostBinding('attr.title')
  get title() {
    return this.text;
  }
}
