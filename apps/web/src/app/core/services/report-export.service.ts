import { Injectable } from '@angular/core';
import type { ReportDocument } from '../../shared/components/report-modal.component';

@Injectable({ providedIn: 'root' })
export class ReportExportService {
  export(report: ReportDocument): void {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
    if (!printWindow) {
      return;
    }

    const html = this.buildDocument(report);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    const runPrint = () => {
      printWindow.print();
      printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
    };

    if (printWindow.document.readyState === 'complete') {
      runPrint();
      return;
    }

    printWindow.addEventListener('load', runPrint, { once: true });
  }

  private buildDocument(report: ReportDocument): string {
    const sections = report.sections.map((section) => {
      const metrics = section.metrics?.length
        ? `
          <div class="metric-grid">
            ${section.metrics
              .map(
                (metric) => `
                  <article class="metric-card">
                    <span class="metric-label">${this.escape(metric.label)}</span>
                    <strong class="metric-value">${this.escape(metric.value)}</strong>
                  </article>`
              )
              .join('')}
          </div>`
        : '';

      const facts = section.facts?.length
        ? `
          <div class="fact-grid">
            ${section.facts
              .map(
                (fact) => `
                  <div class="fact-row">
                    <span class="fact-label">${this.escape(fact.label)}</span>
                    <span class="fact-value">${this.escape(fact.value)}</span>
                  </div>`
              )
              .join('')}
          </div>`
        : '';

      const table = section.table
        ? `
          <div class="table-shell">
            <table>
              <thead>
                <tr>${section.table.columns.map((column) => `<th>${this.escape(column)}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${section.table.rows
                  .map(
                    (row) => `
                      <tr>${row.map((cell) => `<td>${this.escape(cell)}</td>`).join('')}</tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>`
        : '';

      const note = section.note ? `<p class="section-note">${this.escape(section.note)}</p>` : '';
      const description = section.description ? `<p class="section-description">${this.escape(section.description)}</p>` : '';

      return `
        <section class="section-block">
          <div class="section-head">
            <h2>${this.escape(section.title)}</h2>
            ${description}
          </div>
          ${metrics}
          ${facts}
          ${table}
          ${note}
        </section>`;
    }).join('');

    return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${this.escape(report.title)}</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #122033;
        --muted: #58677a;
        --line: #d6dee8;
        --panel: #f6f8fb;
        --panel-strong: #eef3f8;
        --brand: #1f6d5a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Georgia", "Times New Roman", serif;
        color: var(--ink);
        background: linear-gradient(180deg, #ffffff 0%, #f5f8fb 100%);
      }
      .page {
        width: min(1120px, calc(100vw - 48px));
        margin: 0 auto;
        padding: 32px 0 48px;
      }
      .hero {
        padding: 28px 32px;
        border: 1px solid var(--line);
        background: linear-gradient(135deg, #ffffff 0%, #edf5f1 100%);
        border-radius: 24px;
      }
      .eyebrow {
        margin: 0 0 8px;
        font: 700 11px/1.2 "Arial", sans-serif;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: var(--brand);
      }
      h1 {
        margin: 0;
        font-size: 32px;
        line-height: 1.1;
      }
      .subtitle, .meta, .section-description, .section-note {
        color: var(--muted);
      }
      .subtitle { margin: 10px 0 0; font-size: 15px; }
      .meta { margin: 16px 0 0; font: 600 12px/1.4 "Arial", sans-serif; }
      .section-block {
        margin-top: 20px;
        padding: 22px 24px;
        border: 1px solid var(--line);
        border-radius: 22px;
        background: rgba(255, 255, 255, 0.92);
      }
      .section-head h2 {
        margin: 0;
        font-size: 20px;
      }
      .section-description { margin: 8px 0 0; font-size: 14px; }
      .metric-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        margin-top: 16px;
      }
      .metric-card {
        padding: 14px 16px;
        border-radius: 18px;
        background: var(--panel);
        border: 1px solid var(--line);
      }
      .metric-label, .fact-label, th {
        display: block;
        font: 700 11px/1.3 "Arial", sans-serif;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .metric-value {
        display: block;
        margin-top: 8px;
        font-size: 20px;
      }
      .fact-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        margin-top: 16px;
      }
      .fact-row {
        padding: 14px 16px;
        border-radius: 18px;
        background: var(--panel);
        border: 1px solid var(--line);
      }
      .fact-value {
        display: block;
        margin-top: 8px;
        white-space: pre-wrap;
        font-size: 15px;
      }
      .table-shell {
        margin-top: 16px;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 18px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      thead { background: var(--panel-strong); }
      th, td {
        padding: 12px 14px;
        text-align: left;
        vertical-align: top;
        border-bottom: 1px solid var(--line);
      }
      td {
        font-size: 14px;
        line-height: 1.45;
      }
      tbody tr:last-child td { border-bottom: none; }
      .section-note {
        margin: 14px 0 0;
        padding-top: 12px;
        border-top: 1px dashed var(--line);
        font-size: 13px;
      }
      @media print {
        body { background: #ffffff; }
        .page { width: auto; padding: 0; }
        .section-block, .hero { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="hero">
        ${report.eyebrow ? `<p class="eyebrow">${this.escape(report.eyebrow)}</p>` : ''}
        <h1>${this.escape(report.title)}</h1>
        ${report.subtitle ? `<p class="subtitle">${this.escape(report.subtitle)}</p>` : ''}
        <p class="meta">Generato il ${this.escape(report.generatedAt)}</p>
      </header>
      ${sections}
    </main>
  </body>
</html>`;
  }

  private escape(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
