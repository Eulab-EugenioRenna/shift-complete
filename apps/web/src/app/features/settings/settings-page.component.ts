import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { AppApiService } from '../../shared/services/app-api.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, SelectButtonModule, TagModule],
  template: `
    <section class="grid gap-6">
      <header>
        <p class="text-sm uppercase tracking-[0.3em] text-teal-700">Impostazioni</p>
        <h2 class="text-3xl font-semibold text-slate-900">AI agnostic, regole automatiche, notifiche, audit e dark mode.</h2>
      </header>
      <div class="grid gap-4 lg:grid-cols-2">
        <p-card styleClass="metric-tile border-0 shadow-none">
          <ng-template pTemplate="title">Provider AI</ng-template>
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm text-slate-500">Configurazione provider esterno o disattivazione completa.</p>
              <p class="mt-2 font-medium">{{ aiSettings()?.provider || 'disabled' }}</p>
            </div>
            <p-tag severity="contrast" [value]="aiSettings()?.agnostic ? 'agnostic' : 'bound'"></p-tag>
          </div>
        </p-card>
        <p-card styleClass="metric-tile border-0 shadow-none">
          <ng-template pTemplate="title">Automazioni</ng-template>
          <div class="grid gap-4">
            <p class="text-sm text-slate-500">Ciclo turni, sostituzioni, limiti, quiet hours, reminder e fallback manuale.</p>
            <p-selectButton [options]="automationModes" optionLabel="label" optionValue="value" [(ngModel)]="selectedAutomationMode"></p-selectButton>
          </div>
        </p-card>
      </div>
    </section>
  `
})
export class SettingsPageComponent {
  private readonly api = inject(AppApiService);
  protected readonly aiSettings = signal<any | null>(null);
  protected selectedAutomationMode = 'balanced';
  protected readonly automationModes = [
    { label: 'Bilanciato', value: 'balanced' },
    { label: 'Manuale', value: 'manual' },
    { label: 'Spinto', value: 'aggressive' }
  ];

  constructor() {
    this.api.aiSettings().subscribe({ next: (settings) => this.aiSettings.set(settings) });
  }
}
