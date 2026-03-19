import { HttpEventType } from '@angular/common/http';
import { Injectable, effect, signal } from '@angular/core';
import { AppApiService } from '../../shared/services/app-api.service';
import { LiveNotificationsService } from './live-notifications.service';

type TransferKind = 'upload' | 'download';
type TransferStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface ResourceTransferItem {
  id: string;
  jobId?: string;
  kind: TransferKind;
  status: TransferStatus;
  name: string;
  teamId?: string | null;
  progress: number;
  error?: string;
  resourceId?: string;
  downloadUrl?: string;
  autoOpened?: boolean;
}

export interface CompletedUploadEvent {
  id: string;
  resourceId?: string;
}

@Injectable({ providedIn: 'root' })
export class ResourceTransferQueueService {
  private readonly queueSignal = signal<ResourceTransferItem[]>([]);
  private readonly completedUploadSignal = signal<CompletedUploadEvent | null>(null);
  private submissionInFlight = false;
  private readonly pendingSubmissions: Array<() => void> = [];
  private lastProcessedRealtimeUpdate?: { type: string; payload: any };

  readonly items = this.queueSignal.asReadonly();
  readonly lastCompletedUpload = this.completedUploadSignal.asReadonly();

  constructor(
    private readonly api: AppApiService,
    private readonly live: LiveNotificationsService
  ) {
    this.live.connect();
    this.syncFromBackend();
    setInterval(() => this.syncFromBackend(), 10000);

    effect(() => {
      const latestUpdate = this.live.feed().find((item) => item.type === 'resource.transfer.updated');
      if (!latestUpdate || latestUpdate === this.lastProcessedRealtimeUpdate) {
        return;
      }

      this.lastProcessedRealtimeUpdate = latestUpdate;
      this.applyRealtimeUpdate(latestUpdate.payload as { jobId: string; status: string; progress: number; resourceId?: string; teamId?: string | null; result?: { downloadUrl?: string } });
    });
  }

  enqueueUploads(files: File[], teamId?: string | null) {
    const additions = files.map((file) => ({
      id: crypto.randomUUID(),
      kind: 'upload' as const,
      status: 'queued' as const,
      name: file.name,
      teamId: teamId ?? null,
      progress: 0
    }));

    this.queueSignal.update((items) => [...additions, ...items]);
    additions.forEach((item, index) => {
      this.pendingSubmissions.push(() => {
        this.api.uploadResourceAsync(files[index], item.teamId ?? undefined).subscribe({
          next: (job) => {
            this.patch(item.id, { jobId: job.id, progress: job.progress ?? 0, status: job.status ?? 'queued' });
            this.completeSubmission();
          },
          error: (error) => {
            this.patch(item.id, { status: 'failed', progress: 0, error: error?.error?.message ?? error?.message ?? 'Upload fallito' });
            this.completeSubmission();
          }
        });
      });
    });

    this.processPendingSubmissions();
  }

  enqueueDownload(resource: { id: string; name: string; team?: { id?: string | null } | null }) {
    const localId = crypto.randomUUID();
    this.queueSignal.update((items) => [{
      id: localId,
      kind: 'download',
      status: 'queued',
      name: resource.name,
      resourceId: resource.id,
      teamId: resource.team?.id ?? null,
      progress: 0
    }, ...items]);

    this.pendingSubmissions.push(() => {
      this.api.prepareResourceDownload(resource.id).subscribe({
        next: (job) => {
          this.patch(localId, { jobId: job.id, progress: job.progress ?? 0, status: job.status ?? 'queued' });
          this.completeSubmission();
        },
        error: (error) => {
          this.patch(localId, { status: 'failed', progress: 0, error: error?.error?.message ?? error?.message ?? 'Download fallito' });
          this.completeSubmission();
        }
      });
    });

    this.processPendingSubmissions();
  }

  dismiss(itemId: string) {
    this.queueSignal.update((items) => items.filter((item) => item.id !== itemId));
  }

  clearAll() {
    this.queueSignal.set([]);
  }

  private applyRealtimeUpdate(payload: { jobId: string; status: string; progress: number; resourceId?: string; teamId?: string | null; result?: { downloadUrl?: string } }) {
    const item = this.queueSignal().find((entry) => entry.jobId === payload.jobId);
    if (!item) {
      return;
    }

    const nextStatus = payload.status === 'completed'
      ? 'completed'
      : payload.status === 'failed'
        ? 'failed'
        : 'running';

    const patch: Partial<ResourceTransferItem> = {
      status: nextStatus,
      progress: payload.progress,
      resourceId: payload.resourceId ?? item.resourceId,
      teamId: payload.teamId ?? item.teamId
    };

    this.patch(item.id, patch);

    if (item.kind === 'download' && nextStatus === 'completed' && !item.autoOpened) {
      this.patch(item.id, { autoOpened: true });
      if (item.resourceId) {
        this.startAuthenticatedDownload(item.id, item.resourceId, item.name);
      }
    }
  }

  private syncFromBackend() {
    this.api.jobs().subscribe({
      next: (jobs) => {
        const resourceJobs = jobs.filter((job) => job.kind === 'resource_upload' || job.kind === 'resource_download');
        let newlyCompletedUpload: CompletedUploadEvent | null = null;
        this.queueSignal.update((items) => {
          const localPendingItems = items.filter((item) => !item.jobId);
          const mapped = resourceJobs.map((job) => {
            const existing = items.find((item) => item.jobId === job.id);
            const nextItem = {
              id: existing?.id ?? crypto.randomUUID(),
              jobId: job.id,
              kind: job.kind === 'resource_download' ? 'download' : 'upload',
              status: job.status === 'queued' || job.status === 'running' ? job.status : job.status === 'completed' ? 'completed' : 'failed',
              name: job.result?.resource?.name ?? job.payload?.originalname ?? job.payload?.name ?? existing?.name ?? 'Trasferimento',
              teamId: job.teamId ?? existing?.teamId ?? null,
              progress: job.progress ?? existing?.progress ?? 0,
              resourceId: job.entityId ?? job.result?.resourceId ?? existing?.resourceId,
              error: job.error ?? existing?.error,
              autoOpened: existing?.autoOpened ?? false,
              downloadUrl: existing?.downloadUrl
            } as ResourceTransferItem;

            if (nextItem.kind === 'upload' && nextItem.status === 'completed' && existing?.status !== 'completed') {
              newlyCompletedUpload = {
                id: nextItem.jobId ?? nextItem.id,
                resourceId: nextItem.resourceId
              };
            }

            return nextItem;
          });
          return [...localPendingItems, ...mapped];
        });

        if (newlyCompletedUpload) {
          this.completedUploadSignal.set(newlyCompletedUpload);
        }
      }
    });
  }

  private processPendingSubmissions() {
    if (this.submissionInFlight) {
      return;
    }

    const nextSubmission = this.pendingSubmissions.shift();
    if (!nextSubmission) {
      return;
    }

    this.submissionInFlight = true;
    nextSubmission();
  }

  private completeSubmission() {
    this.submissionInFlight = false;
    this.processPendingSubmissions();
  }

  private startAuthenticatedDownload(itemId: string, resourceId: string, fileName: string) {
    this.api.downloadResourceWithProgress(resourceId).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.DownloadProgress) {
          const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 100;
          this.patch(itemId, { status: 'running', progress });
          return;
        }

        if (event.type === HttpEventType.Response && event.body) {
          const blobUrl = URL.createObjectURL(event.body);
          const anchor = document.createElement('a');
          anchor.href = blobUrl;
          anchor.download = fileName;
          anchor.click();
          URL.revokeObjectURL(blobUrl);
          this.patch(itemId, { status: 'completed', progress: 100, autoOpened: true });
        }
      },
      error: (error) => {
        this.patch(itemId, {
          status: 'failed',
          progress: 0,
          autoOpened: false,
          error: error?.error?.message ?? error?.message ?? 'Download fallito'
        });
      }
    });
  }

  private patch(itemId: string, partial: Partial<ResourceTransferItem>) {
    this.queueSignal.update((items) => items.map((item) => {
      if (item.id !== itemId) {
        return item;
      }

      const nextItem = { ...item, ...partial };
      if (item.kind === 'upload' && item.status !== 'completed' && nextItem.status === 'completed') {
        this.completedUploadSignal.set({
          id: nextItem.jobId ?? nextItem.id,
          resourceId: nextItem.resourceId
        });
      }

      return nextItem;
    }));
  }
}
