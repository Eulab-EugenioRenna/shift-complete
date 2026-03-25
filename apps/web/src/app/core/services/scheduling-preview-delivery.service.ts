import { Injectable, effect, inject, signal } from '@angular/core';
import { SchedulePlanResponse } from '@shift-complete/shared-types';
import { AppApiService } from '../../shared/services/app-api.service';
import { LiveNotificationsService } from './live-notifications.service';

type DeliveryMode = 'polling' | 'websocket' | 'hybrid';

type TrackedJob = {
  attempts: number;
  onCompleted: (result: SchedulePlanResponse) => void;
  onFailed: (message: string) => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

@Injectable({ providedIn: 'root' })
export class SchedulingPreviewDeliveryService {
  private readonly api = inject(AppApiService);
  private readonly live = inject(LiveNotificationsService);
  private readonly settingsLoaded = signal(false);
  private readonly transport = signal<DeliveryMode>('hybrid');
  private readonly retryCount = signal(20);
  private readonly pollIntervalMs = signal(4000);
  private readonly trackedJobs = new Map<string, TrackedJob>();

  constructor() {
    effect(() => {
      const item = this.live.feed()[0];
      if (!item || item.type !== 'scheduling.preview.job.updated') {
        return;
      }

      const jobId = item.payload?.jobId;
      if (!jobId || !this.trackedJobs.has(jobId)) {
        return;
      }

      if (this.transport() === 'polling') {
        return;
      }

      this.fetchJob(jobId, false, false);
    });
  }

  trackJob(payload: { jobId: string; onCompleted: (result: SchedulePlanResponse) => void; onFailed: (message: string) => void }): void {
    this.ensureSettingsLoaded();
    this.stopTracking(payload.jobId);

    this.trackedJobs.set(payload.jobId, {
      attempts: 0,
      onCompleted: payload.onCompleted,
      onFailed: payload.onFailed,
      timeoutId: null,
    });

    if (this.transport() === 'polling' || this.transport() === 'hybrid') {
      this.schedulePoll(payload.jobId, this.transport() === 'hybrid' ? this.pollIntervalMs() : 0);
    }
  }

  stopTracking(jobId: string | null | undefined): void {
    if (!jobId) {
      return;
    }

    const tracked = this.trackedJobs.get(jobId);
    if (tracked?.timeoutId) {
      clearTimeout(tracked.timeoutId);
    }
    this.trackedJobs.delete(jobId);
  }

  private ensureSettingsLoaded(): void {
    if (this.settingsLoaded()) {
      return;
    }

    this.settingsLoaded.set(true);
    this.api.aiSettings().subscribe({
      next: (settings) => {
        const transport = settings?.schedulingPreviewTransport;
        this.transport.set(transport === 'polling' || transport === 'websocket' || transport === 'hybrid' ? transport : 'hybrid');
        this.retryCount.set(typeof settings?.schedulingPreviewRetryCount === 'number' ? settings.schedulingPreviewRetryCount : 20);
        this.pollIntervalMs.set(typeof settings?.schedulingPreviewPollIntervalMs === 'number' ? settings.schedulingPreviewPollIntervalMs : 4000);
      },
    });
  }

  private schedulePoll(jobId: string, delayMs: number): void {
    const tracked = this.trackedJobs.get(jobId);
    if (!tracked) {
      return;
    }

    tracked.timeoutId = window.setTimeout(() => this.fetchJob(jobId, true, true), delayMs);
  }

  private fetchJob(jobId: string, countAttempt: boolean, rescheduleOnPending: boolean): void {
    const tracked = this.trackedJobs.get(jobId);
    if (!tracked) {
      return;
    }

    this.api.job(jobId).subscribe({
      next: (job) => {
        if (job.status === 'completed' && job.result) {
          tracked.onCompleted(job.result as SchedulePlanResponse);
          this.stopTracking(jobId);
          return;
        }

        if (job.status === 'failed') {
          tracked.onFailed(job.error || 'Il job di pianificazione e fallito.');
          this.stopTracking(jobId);
          return;
        }

        if (rescheduleOnPending && (this.transport() === 'polling' || this.transport() === 'hybrid')) {
          if (countAttempt) {
            tracked.attempts += 1;
          }

          if (tracked.attempts < this.retryCount()) {
            this.schedulePoll(jobId, this.pollIntervalMs());
            return;
          }

          tracked.onFailed('Numero massimo di retry raggiunto per la preview scheduling.');
          this.stopTracking(jobId);
        }
      },
      error: () => {
        if (!rescheduleOnPending || (this.transport() !== 'polling' && this.transport() !== 'hybrid')) {
          return;
        }

        tracked.attempts += 1;
        if (tracked.attempts < this.retryCount()) {
          this.schedulePoll(jobId, this.pollIntervalMs());
          return;
        }

        tracked.onFailed('Impossibile sincronizzare il job scheduling dopo vari tentativi.');
        this.stopTracking(jobId);
      },
    });
  }
}
