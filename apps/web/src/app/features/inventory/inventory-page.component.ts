import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AppApiService } from '../../shared/services/app-api.service';

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [CommonModule, CardModule, ProgressBarModule, TableModule, TagModule],
  template: `
    <section class="grid gap-6">
      <header>
        <p class="text-sm uppercase tracking-[0.3em] text-teal-700">Inventario</p>
        <h2 class="text-3xl font-semibold text-slate-900">Strumenti, manutenzioni, assegnazioni e disponibilita per team.</h2>
      </header>
      <div class="grid gap-4 md:grid-cols-3">
        <p-card styleClass="metric-tile border-0 shadow-none"><p class="text-sm text-slate-500">Asset censiti</p><p class="mt-2 text-4xl font-semibold">{{ summary()?.assets ?? 0 }}</p><p-progressBar class="mt-4" [value]="80"></p-progressBar></p-card>
        <p-card styleClass="metric-tile border-0 shadow-none"><p class="text-sm text-slate-500">In prestito</p><p class="mt-2 text-4xl font-semibold">{{ summary()?.checkedOut ?? 0 }}</p><p-progressBar class="mt-4" [value]="45"></p-progressBar></p-card>
        <p-card styleClass="metric-tile border-0 shadow-none"><p class="text-sm text-slate-500">Da revisionare</p><p class="mt-2 text-4xl font-semibold text-red-700">{{ summary()?.maintenanceDue ?? 0 }}</p><p-progressBar class="mt-4" [value]="25"></p-progressBar></p-card>
      </div>
      <p-card styleClass="metric-tile border-0 shadow-none">
        <ng-template pTemplate="title">Dettaglio asset</ng-template>
        <p-table [value]="summary()?.items || []">
          <ng-template pTemplate="header">
            <tr><th>Nome</th><th>Seriale</th><th>Stato</th><th>Manutenzione</th></tr>
          </ng-template>
          <ng-template pTemplate="body" let-item>
            <tr>
              <td>{{ item.name }}</td>
              <td>{{ item.serialNumber || 'n/d' }}</td>
              <td><p-tag [severity]="item.status === 'checked_out' ? 'warn' : 'success'" [value]="item.status"></p-tag></td>
              <td>{{ item.maintenanceDueAt ? (item.maintenanceDueAt | date:'shortDate') : 'ok' }}</td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>
    </section>
  `
})
export class InventoryPageComponent {
  private readonly api = inject(AppApiService);
  protected readonly summary = signal<any | null>(null);

  constructor() {
    this.api.inventorySummary().subscribe({ next: (summary) => this.summary.set(summary) });
  }
}
