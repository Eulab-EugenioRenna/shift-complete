import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { UiFeedbackService } from '../services/ui-feedback.service';

@Component({
  selector: 'app-feedback-center',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
      <article
        *ngFor="let item of feedback.items()"
        class="pointer-events-auto overflow-hidden rounded-2xl border shadow-lg backdrop-blur"
        [class.border-emerald-200]="item.type === 'success'"
        [ngClass]="{
          'bg-emerald-50': item.type === 'success',
          'bg-red-50': item.type === 'error',
          'bg-white': item.type === 'info'
        }"
        [class.border-red-200]="item.type === 'error'"
        [class.border-slate-200]="item.type === 'info'"
      >
        <div class="flex items-start gap-3 px-4 py-3">
          <div class="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full"
            [class.bg-emerald-100]="item.type === 'success'"
            [class.text-emerald-700]="item.type === 'success'"
            [class.bg-red-100]="item.type === 'error'"
            [class.text-red-700]="item.type === 'error'"
            [class.bg-slate-100]="item.type === 'info'"
            [class.text-slate-700]="item.type === 'info'"
          >
            <i class="pi"
              [class.pi-check]="item.type === 'success'"
              [class.pi-times]="item.type === 'error'"
              [class.pi-info]="item.type === 'info'"></i>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-slate-900">{{ item.title }}</p>
            <p *ngIf="item.message" class="mt-1 text-sm text-slate-600">{{ item.message }}</p>
          </div>
          <button type="button" class="text-slate-400 transition hover:text-slate-700" (click)="feedback.dismiss(item.id)">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </article>
    </div>
  `
})
export class AppFeedbackCenterComponent {
  protected readonly feedback = inject(UiFeedbackService);
}
