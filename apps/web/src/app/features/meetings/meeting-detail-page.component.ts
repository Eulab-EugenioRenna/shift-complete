import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MeetingListItem } from '@shift-complete/shared-types';
import { UiLabelComponent, UiPageHeaderComponent, UiSurfaceComponent } from '@shift-complete/ui-kit';
import { ApiErrorService } from '../../core/services/api-error.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { AppApiService } from '../../shared/services/app-api.service';

@Component({
  selector: 'app-meeting-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, UiLabelComponent, UiPageHeaderComponent, UiSurfaceComponent],
  templateUrl: './meeting-detail-page.component.html',
})
export class MeetingDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly detail = signal<MeetingListItem | null>(null);
  protected readonly ownerLabel = computed(() => this.detail()?.team?.name || this.detail()?.meetingGroup?.name || 'Origine non definita');
  protected readonly ownerTypeLabel = computed(() => this.detail()?.ownerType === 'team' ? 'Riunione del team' : 'Riunione del meeting group');
  protected readonly recurrenceLabel = computed(() => this.detail()?.type === 'recurring' ? 'Ricorrenza attiva' : 'Appuntamento singolo');
  private readonly meetingId = this.route.snapshot.paramMap.get('meetingId');

  constructor() {
    if (!this.meetingId) {
      return;
    }

    this.api.meeting(this.meetingId).subscribe({
      next: (detail) => this.detail.set(detail),
      error: (error) => this.feedback.error('Dettaglio riunione non disponibile', this.apiError.message(error, 'Impossibile recuperare la riunione.')),
    });
  }
}
