import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AppApiService } from '../../shared/services/app-api.service';

@Component({
  selector: 'app-resources-page',
  standalone: true,
  imports: [CommonModule, CardModule, TableModule, TagModule],
  template: `
    <section class="grid gap-6">
      <header>
        <p class="text-sm uppercase tracking-[0.3em] text-orange-600">File manager</p>
        <h2 class="text-3xl font-semibold text-slate-900">Documenti, checklist, allegati evento e repository per team.</h2>
      </header>
      <p-card styleClass="metric-tile border-0 shadow-none">
        <ng-template pTemplate="title">Archivio risorse</ng-template>
        <p-table [value]="resources()">
          <ng-template pTemplate="header">
            <tr><th>Nome</th><th>Team</th><th>Tipo</th><th>Dimensione</th></tr>
          </ng-template>
          <ng-template pTemplate="body" let-resource>
            <tr>
              <td>{{ resource.name }}</td>
              <td><p-tag [value]="resource.team?.name || 'tutti'" severity="info"></p-tag></td>
              <td>{{ resource.mimeType }}</td>
              <td>{{ resource.sizeBytes }} bytes</td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>
    </section>
  `
})
export class ResourcesPageComponent {
  private readonly api = inject(AppApiService);
  protected readonly resources = signal<any[]>([]);

  constructor() {
    this.api.resources().subscribe({ next: (resources) => this.resources.set(resources) });
  }
}
