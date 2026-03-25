import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MeetingGroupItem, MeetingListItem } from '@shift-complete/shared-types';
import { UiLabelComponent, UiPageHeaderComponent, UiSurfaceComponent } from '@shift-complete/ui-kit';
import { ApiErrorService } from '../../core/services/api-error.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { AppApiService } from '../../shared/services/app-api.service';

type MeetingGroupDetail = MeetingGroupItem & {
  group?: { id: string; name: string | null; description?: string | null } | null;
  meetings?: MeetingListItem[];
};

@Component({
  selector: 'app-meeting-group-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, UiLabelComponent, UiPageHeaderComponent, UiSurfaceComponent],
  templateUrl: './meeting-group-detail-page.component.html',
})
export class MeetingGroupDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly detail = signal<MeetingGroupDetail | null>(null);
  protected readonly meetings = computed(() => this.detail()?.meetings ?? []);
  protected readonly upcomingMeetings = computed(() => this.meetings().filter((meeting) => new Date(meeting.endsAt).getTime() >= Date.now()).slice(0, 3));
  private readonly groupId = this.route.snapshot.paramMap.get('groupId');

  constructor() {
    if (!this.groupId) {
      return;
    }

    this.api.meetingGroup(this.groupId).subscribe({
      next: (detail) => this.detail.set(detail),
      error: (error) => this.feedback.error('Dettaglio gruppo riunione non disponibile', this.apiError.message(error, 'Impossibile recuperare il gruppo riunione.')),
    });
  }
}
