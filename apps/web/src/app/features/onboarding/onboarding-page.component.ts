import { Component } from '@angular/core';

@Component({
  selector: 'app-onboarding-page',
  standalone: true,
  template: `
    <section class="mx-auto max-w-4xl grid gap-6">
      <header>
        <p class="text-sm uppercase tracking-[0.3em] text-orange-600">Onboarding</p>
        <h2 class="text-3xl font-semibold text-slate-900">Completa profilo, disponibilita, skill e preferenze prima della prima assegnazione.</h2>
      </header>
      <div class="grid gap-4 md:grid-cols-3">
        <article class="metric-tile"><p class="font-medium">1. Profilo</p><p class="mt-2 text-sm text-slate-500">Anagrafica, contatti e privacy.</p></article>
        <article class="metric-tile"><p class="font-medium">2. Disponibilita</p><p class="mt-2 text-sm text-slate-500">Fasce orarie, assenze ricorrenti, preferenze.</p></article>
        <article class="metric-tile"><p class="font-medium">3. Competenze</p><p class="mt-2 text-sm text-slate-500">Ruoli consentiti, certificazioni e strumenti assegnabili.</p></article>
      </div>
    </section>
  `
})
export class OnboardingPageComponent {}
