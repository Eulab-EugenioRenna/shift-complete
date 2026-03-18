import { Component, inject } from '@angular/core';
import { PrimeNG } from 'primeng/config';
import { RouterOutlet } from '@angular/router';
import { AppFeedbackCenterComponent } from './core/layout/app-feedback-center.component';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppFeedbackCenterComponent],
  templateUrl: './app.component.html',
  host: {
    class: 'block min-h-screen'
  }
})
export class AppComponent {
  private readonly primeng = inject(PrimeNG);
  private readonly _theme = inject(ThemeService);

  constructor() {
    this.primeng.setTranslation({
      dayNames: ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato'],
      dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
      dayNamesMin: ['Do', 'Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa'],
      monthNames: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
      monthNamesShort: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
      today: 'Oggi',
      clear: 'Pulisci',
      firstDayOfWeek: 1,
      chooseDate: 'Scegli data',
      prevMonth: 'Mese precedente',
      nextMonth: 'Mese successivo',
      prevYear: 'Anno precedente',
      nextYear: 'Anno successivo'
    });
  }
}
