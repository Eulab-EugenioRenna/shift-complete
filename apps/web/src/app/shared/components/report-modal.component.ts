import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { UiButtonComponent, UiModalComponent, UiSurfaceComponent } from '@shift-complete/ui-kit';
import { ReportExportService } from '../../core/services/report-export.service';

export interface ReportMetric {
  label: string;
  value: string;
}

export interface ReportFact {
  label: string;
  value: string;
}

export interface ReportTable {
  columns: string[];
  rows: string[][];
}

export interface ReportSection {
  title: string;
  description?: string;
  metrics?: ReportMetric[];
  facts?: ReportFact[];
  table?: ReportTable;
  note?: string;
}

export interface ReportDocument {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  fileName: string;
  generatedAt: string;
  sections: ReportSection[];
}

@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [CommonModule, UiButtonComponent, UiModalComponent, UiSurfaceComponent],
  template: `
    <ui-modal
      [visible]="visible"
      (visibleChange)="visibleChange.emit($event)"
      [title]="report?.title || 'Report'"
      [eyebrow]="report?.eyebrow || 'Report operativo'"
      [subtitle]="report?.subtitle || 'Anteprima HTML con esportazione PDF tramite stampa del browser.'"
      icon="pi pi-file-export"
      tone="info"
      width="76rem"
      maxWidth="98vw"
      [hasFooter]="true"
      (closeRequested)="visibleChange.emit(false)"
    >
      <div *ngIf="report as current; else noReport" class="grid gap-5">
        <ui-surface surfaceClass="overflow-hidden border border-[color:var(--border-soft)] bg-[linear-gradient(135deg,#fffdf8_0%,#eef7f3_100%)] p-0">
          <div class="grid gap-4 px-6 py-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">{{ current.eyebrow || 'Report operativo' }}</p>
              <h3 class="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--text-1)]">{{ current.title }}</h3>
              <p class="mt-2 max-w-3xl text-sm text-[color:var(--text-2)]">{{ current.subtitle }}</p>
            </div>
            <div class="rounded-[20px] border border-[color:var(--border-soft)] bg-white/80 px-4 py-3 text-right shadow-[var(--shadow-soft)]">
              <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-3)]">Generato</p>
              <p class="mt-1 text-sm font-medium text-[color:var(--text-1)]">{{ current.generatedAt }}</p>
              <p class="mt-2 text-xs text-[color:var(--text-3)]">Export: {{ current.fileName }}</p>
            </div>
          </div>
        </ui-surface>

        <section *ngFor="let section of current.sections" class="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] p-5 shadow-[var(--shadow-soft)]">
          <div>
            <h4 class="text-lg font-semibold text-[color:var(--text-1)]">{{ section.title }}</h4>
            <p *ngIf="section.description" class="mt-1 text-sm text-[color:var(--text-2)]">{{ section.description }}</p>
          </div>

          <div *ngIf="section.metrics?.length" class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article *ngFor="let metric of section.metrics" class="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--surface-2)] px-4 py-4">
              <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-3)]">{{ metric.label }}</p>
              <p class="mt-2 text-xl font-semibold text-[color:var(--text-1)]">{{ metric.value }}</p>
            </article>
          </div>

          <div *ngIf="section.facts?.length" class="mt-4 grid gap-3 md:grid-cols-2">
            <div *ngFor="let fact of section.facts" class="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--surface-2)] px-4 py-4">
              <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-3)]">{{ fact.label }}</p>
              <p class="mt-2 whitespace-pre-wrap text-sm font-medium text-[color:var(--text-1)]">{{ fact.value }}</p>
            </div>
          </div>

          <div *ngIf="section.table" class="mt-4 overflow-x-auto rounded-[20px] border border-[color:var(--border-soft)]">
            <table class="min-w-full text-sm">
              <thead class="bg-[color:var(--surface-2)] text-left text-[color:var(--text-2)]">
                <tr>
                  <th *ngFor="let column of section.table.columns" class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em]">{{ column }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of section.table.rows" class="border-t border-[color:var(--border-soft)] align-top">
                  <td *ngFor="let cell of row" class="px-4 py-3 whitespace-pre-wrap text-[color:var(--text-1)]">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p *ngIf="section.note" class="mt-4 border-t border-dashed border-[color:var(--border-soft)] pt-4 text-xs text-[color:var(--text-2)]">{{ section.note }}</p>
        </section>
      </div>

      <ng-template #noReport>
        <ui-surface surfaceClass="border-dashed bg-[color:var(--surface-2)] px-6 py-10 text-center text-sm text-[color:var(--text-2)]">
          Nessun report disponibile per la selezione corrente.
        </ui-surface>
      </ng-template>

      <div dialog-footer class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <ui-button tone="neutral" variant="outlined" (buttonClick)="visibleChange.emit(false)">Chiudi</ui-button>
        <ui-button tone="info" icon="pi pi-file-pdf" [disabled]="!report" (buttonClick)="exportPdf()">Export PDF</ui-button>
      </div>
    </ui-modal>
  `,
})
export class ReportModalComponent {
  private readonly exporter = inject(ReportExportService);

  @Input() visible = false;
  @Input() report: ReportDocument | null = null;
  @Output() readonly visibleChange = new EventEmitter<boolean>();

  protected exportPdf(): void {
    if (!this.report) {
      return;
    }

    this.exporter.export(this.report);
  }
}
