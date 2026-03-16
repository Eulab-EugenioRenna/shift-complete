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

@Injectable({ providedIn: 'root' })
export class ResourceTransferQueueService {
  private readonly queueSignal = signal<ResourceTransferItem[]>([]);

  readonly items = this.queueSignal.asReadonly();

  constructor(
    private readonly api: AppApiService,
    private readonly live: LiveNotificationsService
  ) {
    this.live.connect();
    this.syncFromBackend();
    setInterval(() => this.syncFromBackend(), 10000);

    effect(() => {
      const updates = this.live.feed().filter((item) => item.type === 'resource.transfer.updated');
      for (const update of updates) {
        this.applyRealtimeUpdate(update.payload as { jobId: string; status: string; progress: number; resourceId?: string; teamId?: string | null; result?: { downloadUrl?: string } });
      }
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
      this.api.uploadResourceAsync(files[index], item.teamId ?? undefined).subscribe({
        next: (job) => this.patch(item.id, { jobId: job.id, progress: job.progress ?? 0, status: job.status ?? 'queued' }),
        error: (error) => this.patch(item.id, { status: 'failed', progress: 0, error: error?.error?.message ?? error?.message ?? 'Upload fallito' })
      });
    });
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

    this.api.prepareResourceDownload(resource.id).subscribe({
      next: (job) => this.patch(localId, { jobId: job.id, progress: job.progress ?? 0, status: job.status ?? 'queued' }),
      error: (error) => this.patch(localId, { status: 'failed', progress: 0, error: error?.error?.message ?? error?.message ?? 'Download fallito' })
    });
  }

  dismiss(itemId: string) {
    this.queueSignal.update((items) => items.filter((item) => item.id !== itemId));
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
      const downloadUrl = item.resourceId ? this.api.downloadResource(item.resourceId) : undefined;
      if (downloadUrl) {
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
        anchor.click();
        this.patch(item.id, { autoOpened: true, downloadUrl });
      }
    }
  }

  private syncFromBackend() {
    this.api.jobs().subscribe({
      next: (jobs) => {
        const resourceJobs = jobs.filter((job) => job.kind === 'resource_upload' || job.kind === 'resource_download');
        this.queueSignal.update((items) => {
          const mapped = resourceJobs.map((job) => {
            const existing = items.find((item) => item.jobId === job.id);
            return {
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
          });
          return mapped;
        });
      }
    });
  }

  private patch(itemId: string, partial: Partial<ResourceTransferItem>) {
    this.queueSignal.update((items) => items.map((item) => item.id === itemId ? { ...item, ...partial } : item));
  }
}
