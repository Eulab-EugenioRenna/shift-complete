import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toJsonValue } from '../../common/utils/json.util';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';
import { PingAiProviderDto } from './dto/ping-ai-provider.dto';
import { SmtpEmailProvider } from '../notifications/providers/smtp-email.provider';
import { WebhookNotificationProvider } from '../notifications/providers/webhook-notification.provider';

type ResourceTeamQuotaRule = {
  teamId: string;
  storageLimitBytes?: number;
};

@Injectable()
export class AiSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderRegistryService: AiProviderRegistryService,
    private readonly smtpEmailProvider: SmtpEmailProvider,
    private readonly webhookNotificationProvider: WebhookNotificationProvider
  ) {}

  async getSettings() {
    const settings = await this.ensureSettings();
    return this.toResponse(settings);
  }

  async updateSettings(payload: UpdateAiSettingsDto, actorId: string) {
    if (payload.provider !== 'disabled' && payload.provider !== 'ollama' && !payload.apiKey) {
      throw new BadRequestException('Per questo provider e richiesta una API key');
    }

    if (payload.provider === 'ollama' && !payload.ollamaUrl) {
      throw new BadRequestException('Per Ollama e richiesto un URL valido');
    }

    if (payload.smtpHost && !payload.smtpFromEmail) {
      throw new BadRequestException('Per SMTP e richiesto un mittente email predefinito');
    }

    if (payload.resourceStorageDriver === 's3') {
      if (!payload.resourceS3Endpoint || !payload.resourceS3Bucket || !payload.resourceS3AccessKey) {
        throw new BadRequestException('Per S3 sono richiesti endpoint, bucket e access key');
      }

      const current = await this.prisma.aiSetting.findUnique({ where: { id: 'global' } });
      const nextSecret = payload.resourceS3SecretKey || current?.resourceS3SecretKey || process.env.RESOURCE_S3_SECRET_KEY;
      if (!nextSecret) {
        throw new BadRequestException('Per S3 e richiesta una secret key');
      }
    }

    const updated = await this.prisma.aiSetting.upsert({
      where: { id: 'global' },
      update: {
        provider: payload.provider,
        apiKey: payload.apiKey,
        ollamaUrl: payload.ollamaUrl,
        model: payload.model,
        smtpHost: payload.smtpHost,
        smtpPort: payload.smtpPort,
        smtpSecure: payload.smtpSecure,
        smtpUser: payload.smtpUser,
        smtpPassword: payload.smtpPassword,
        smtpFromEmail: payload.smtpFromEmail,
        smtpFromName: payload.smtpFromName,
        smtpReplyTo: payload.smtpReplyTo,
        redisUrl: payload.redisUrl,
        webAppUrl: payload.webAppUrl,
        resourceStorageDriver: payload.resourceStorageDriver,
        totalStorageLimitBytes: payload.totalStorageLimitBytes,
        defaultTeamStorageLimitBytes: payload.defaultTeamStorageLimitBytes,
        resourceTeamQuotaRules: payload.resourceTeamQuotaRules ? toJsonValue(payload.resourceTeamQuotaRules) : undefined,
        resourceS3Endpoint: payload.resourceS3Endpoint,
        resourceS3Region: payload.resourceS3Region,
        resourceS3Bucket: payload.resourceS3Bucket,
        resourceS3AccessKey: payload.resourceS3AccessKey,
        resourceS3SecretKey: payload.resourceS3SecretKey || undefined,
        resourceS3ForcePathStyle: payload.resourceS3ForcePathStyle,
        resourceS3UseSsl: payload.resourceS3UseSsl,
        resourceJobConcurrency: payload.resourceJobConcurrency,
        notificationJobConcurrency: payload.notificationJobConcurrency,
        aiJobConcurrency: payload.aiJobConcurrency,
        inAppNotificationsEnabled: payload.inAppNotificationsEnabled,
        websocketNotificationsEnabled: payload.websocketNotificationsEnabled,
        emailNotificationsEnabled: payload.emailNotificationsEnabled,
        webhookEnabled: payload.webhookEnabled,
        webhookUrl: payload.webhookUrl,
        webhookSecret: payload.webhookSecret,
        agnostic: payload.agnostic,
        automationMode: payload.automationMode,
        remindersEnabled: payload.remindersEnabled,
        quietHours: payload.quietHours
      },
      create: {
        id: 'global',
        provider: payload.provider,
        apiKey: payload.apiKey,
        ollamaUrl: payload.ollamaUrl,
        model: payload.model,
        smtpHost: payload.smtpHost,
        smtpPort: payload.smtpPort ?? 587,
        smtpSecure: payload.smtpSecure ?? false,
        smtpUser: payload.smtpUser,
        smtpPassword: payload.smtpPassword,
        smtpFromEmail: payload.smtpFromEmail,
        smtpFromName: payload.smtpFromName,
        smtpReplyTo: payload.smtpReplyTo,
        redisUrl: payload.redisUrl,
        webAppUrl: payload.webAppUrl,
        resourceStorageDriver: payload.resourceStorageDriver ?? 'local',
        totalStorageLimitBytes: payload.totalStorageLimitBytes,
        defaultTeamStorageLimitBytes: payload.defaultTeamStorageLimitBytes,
        resourceTeamQuotaRules: payload.resourceTeamQuotaRules ? toJsonValue(payload.resourceTeamQuotaRules) : undefined,
        resourceS3Endpoint: payload.resourceS3Endpoint,
        resourceS3Region: payload.resourceS3Region ?? 'us-east-1',
        resourceS3Bucket: payload.resourceS3Bucket,
        resourceS3AccessKey: payload.resourceS3AccessKey,
        resourceS3SecretKey: payload.resourceS3SecretKey,
        resourceS3ForcePathStyle: payload.resourceS3ForcePathStyle ?? true,
        resourceS3UseSsl: payload.resourceS3UseSsl ?? false,
        resourceJobConcurrency: payload.resourceJobConcurrency ?? 3,
        notificationJobConcurrency: payload.notificationJobConcurrency ?? 5,
        aiJobConcurrency: payload.aiJobConcurrency ?? 2,
        inAppNotificationsEnabled: payload.inAppNotificationsEnabled ?? true,
        websocketNotificationsEnabled: payload.websocketNotificationsEnabled ?? true,
        emailNotificationsEnabled: payload.emailNotificationsEnabled ?? true,
        webhookEnabled: payload.webhookEnabled ?? false,
        webhookUrl: payload.webhookUrl,
        webhookSecret: payload.webhookSecret,
        agnostic: payload.agnostic ?? false,
        automationMode: payload.automationMode ?? 'balanced',
        remindersEnabled: payload.remindersEnabled ?? true,
        quietHours: payload.quietHours ?? true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'ai-settings.updated',
        entityType: 'aiSetting',
        entityId: updated.id,
        metadata: toJsonValue({
          ...payload,
          apiKey: payload.apiKey ? '***' : undefined,
          smtpPassword: payload.smtpPassword ? '***' : undefined,
          resourceS3SecretKey: payload.resourceS3SecretKey ? '***' : undefined,
          webhookSecret: payload.webhookSecret ? '***' : undefined
        })
      }
    });

    return this.toResponse(updated);
  }

  async pingProvider(payload: PingAiProviderDto) {
    return this.aiProviderRegistryService.get(payload.provider).ping(payload);
  }

  async getModels(provider: string, apiKey?: string, ollamaUrl?: string) {
    return { models: await this.aiProviderRegistryService.get(provider).listModels({ apiKey, ollamaUrl }) };
  }

  capabilities() {
    return this.aiProviderRegistryService.capabilities();
  }

  async testSmtp(payload: { to: string }) {
    return this.smtpEmailProvider.send({
      to: payload.to,
      subject: 'Shift Complete SMTP test',
      text: 'Test SMTP completato con successo.',
      html: '<p>Test SMTP completato con successo.</p>'
    });
  }

  async testWebhook() {
    return this.webhookNotificationProvider.send({
      event: 'settings.webhook.test',
      timestamp: new Date().toISOString(),
      payload: {
        source: 'settings',
        message: 'Webhook test completato'
      }
    });
  }

  private async ensureSettings() {
    return this.prisma.aiSetting.upsert({
      where: { id: 'global' },
      update: {},
      create: {
        id: 'global',
        provider: process.env.AI_PROVIDER ?? 'disabled',
        model: process.env.AI_MODEL ?? null,
        ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
        smtpHost: process.env.SMTP_HOST ?? null,
        smtpPort: Number(process.env.SMTP_PORT ?? 587),
        smtpSecure: process.env.SMTP_SECURE === 'true',
        smtpUser: process.env.SMTP_USER ?? null,
        smtpPassword: process.env.SMTP_PASSWORD ?? null,
        smtpFromEmail: process.env.SMTP_FROM_EMAIL ?? 'no-reply@shift.local',
        smtpFromName: process.env.SMTP_FROM_NAME ?? 'Shift Complete',
        smtpReplyTo: process.env.SMTP_REPLY_TO ?? null,
        redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
        webAppUrl: process.env.WEB_APP_URL ?? 'http://localhost:4200',
        resourceStorageDriver: process.env.RESOURCE_STORAGE_DRIVER ?? 'local',
        totalStorageLimitBytes: process.env.TOTAL_STORAGE_LIMIT_BYTES ? Number(process.env.TOTAL_STORAGE_LIMIT_BYTES) : null,
        defaultTeamStorageLimitBytes: process.env.DEFAULT_TEAM_STORAGE_LIMIT_BYTES ? Number(process.env.DEFAULT_TEAM_STORAGE_LIMIT_BYTES) : null,
        resourceTeamQuotaRules: null,
        resourceS3Endpoint: process.env.RESOURCE_S3_ENDPOINT ?? null,
        resourceS3Region: process.env.RESOURCE_S3_REGION ?? 'us-east-1',
        resourceS3Bucket: process.env.RESOURCE_S3_BUCKET ?? null,
        resourceS3AccessKey: process.env.RESOURCE_S3_ACCESS_KEY ?? null,
        resourceS3SecretKey: process.env.RESOURCE_S3_SECRET_KEY ?? null,
        resourceS3ForcePathStyle: process.env.RESOURCE_S3_FORCE_PATH_STYLE !== 'false',
        resourceS3UseSsl: process.env.RESOURCE_S3_USE_SSL === 'true',
        resourceJobConcurrency: Number(process.env.RESOURCE_JOB_CONCURRENCY ?? 3),
        notificationJobConcurrency: Number(process.env.NOTIFICATION_JOB_CONCURRENCY ?? 5),
        aiJobConcurrency: Number(process.env.AI_JOB_CONCURRENCY ?? 2),
        inAppNotificationsEnabled: process.env.IN_APP_NOTIFICATIONS_ENABLED !== 'false',
        websocketNotificationsEnabled: process.env.WEBSOCKET_NOTIFICATIONS_ENABLED !== 'false',
        emailNotificationsEnabled: process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'false',
        webhookEnabled: process.env.WEBHOOK_NOTIFICATIONS_ENABLED === 'true',
        webhookUrl: process.env.WEBHOOK_NOTIFICATIONS_URL ?? null,
        webhookSecret: process.env.WEBHOOK_NOTIFICATIONS_SECRET ?? null
      }
    });
  }

  async runtimeSettings() {
    const settings = await this.ensureSettings();
    return {
      provider: settings.provider,
      apiKey: settings.apiKey ?? undefined,
      ollamaUrl: settings.ollamaUrl ?? undefined,
      model: settings.model ?? undefined,
      smtpHost: settings.smtpHost ?? undefined,
      smtpPort: settings.smtpPort ?? 587,
      smtpSecure: settings.smtpSecure,
      smtpUser: settings.smtpUser ?? undefined,
      smtpPassword: settings.smtpPassword ?? undefined,
      smtpFromEmail: settings.smtpFromEmail ?? undefined,
      smtpFromName: settings.smtpFromName ?? undefined,
      smtpReplyTo: settings.smtpReplyTo ?? undefined,
      redisUrl: settings.redisUrl ?? undefined,
      webAppUrl: settings.webAppUrl ?? undefined,
      resourceStorageDriver: settings.resourceStorageDriver ?? undefined,
      totalStorageLimitBytes: settings.totalStorageLimitBytes ?? undefined,
      defaultTeamStorageLimitBytes: settings.defaultTeamStorageLimitBytes ?? undefined,
      resourceTeamQuotaRules: this.normalizeQuotaRules(settings.resourceTeamQuotaRules),
      resourceS3Endpoint: settings.resourceS3Endpoint ?? undefined,
      resourceS3Region: settings.resourceS3Region ?? undefined,
      resourceS3Bucket: settings.resourceS3Bucket ?? undefined,
      resourceS3AccessKey: settings.resourceS3AccessKey ?? undefined,
      resourceS3SecretKey: settings.resourceS3SecretKey ?? undefined,
      resourceS3ForcePathStyle: settings.resourceS3ForcePathStyle,
      resourceS3UseSsl: settings.resourceS3UseSsl,
      resourceJobConcurrency: settings.resourceJobConcurrency,
      notificationJobConcurrency: settings.notificationJobConcurrency,
      aiJobConcurrency: settings.aiJobConcurrency,
      inAppNotificationsEnabled: settings.inAppNotificationsEnabled,
      websocketNotificationsEnabled: settings.websocketNotificationsEnabled,
      emailNotificationsEnabled: settings.emailNotificationsEnabled,
      webhookEnabled: settings.webhookEnabled,
      webhookUrl: settings.webhookUrl ?? undefined,
      webhookSecret: settings.webhookSecret ?? undefined,
      agnostic: settings.agnostic,
      automationMode: settings.automationMode,
      remindersEnabled: settings.remindersEnabled,
      quietHours: settings.quietHours
    };
  }

  private toResponse(settings: {
    provider: string;
    apiKey: string | null;
    ollamaUrl: string | null;
    model: string | null;
    smtpHost: string | null;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string | null;
    smtpPassword: string | null;
    smtpFromEmail: string | null;
    smtpFromName: string | null;
    smtpReplyTo: string | null;
    redisUrl: string | null;
    webAppUrl: string | null;
     resourceStorageDriver: string | null;
      totalStorageLimitBytes: number | null;
      defaultTeamStorageLimitBytes: number | null;
      resourceTeamQuotaRules: unknown;
      resourceS3Endpoint: string | null;
    resourceS3Region: string | null;
    resourceS3Bucket: string | null;
    resourceS3AccessKey: string | null;
    resourceS3SecretKey: string | null;
    resourceS3ForcePathStyle: boolean;
    resourceS3UseSsl: boolean;
    resourceJobConcurrency: number;
    notificationJobConcurrency: number;
    aiJobConcurrency: number;
    inAppNotificationsEnabled: boolean;
    websocketNotificationsEnabled: boolean;
    emailNotificationsEnabled: boolean;
    webhookEnabled: boolean;
    webhookUrl: string | null;
    webhookSecret: string | null;
    agnostic: boolean;
    automationMode: string;
    remindersEnabled: boolean;
    quietHours: boolean;
  }) {
    return {
      provider: settings.provider,
      ollamaUrl: settings.ollamaUrl,
      model: settings.model,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpSecure: settings.smtpSecure,
      smtpUser: settings.smtpUser,
      smtpFromEmail: settings.smtpFromEmail,
      smtpFromName: settings.smtpFromName,
      smtpReplyTo: settings.smtpReplyTo,
      redisUrl: settings.redisUrl,
      webAppUrl: settings.webAppUrl,
      resourceStorageDriver: settings.resourceStorageDriver,
      totalStorageLimitBytes: settings.totalStorageLimitBytes,
      defaultTeamStorageLimitBytes: settings.defaultTeamStorageLimitBytes,
      resourceTeamQuotaRules: this.normalizeQuotaRules(settings.resourceTeamQuotaRules),
      resourceS3Endpoint: settings.resourceS3Endpoint,
      resourceS3Region: settings.resourceS3Region,
      resourceS3Bucket: settings.resourceS3Bucket,
      resourceS3AccessKey: settings.resourceS3AccessKey,
      resourceS3ForcePathStyle: settings.resourceS3ForcePathStyle,
      resourceS3UseSsl: settings.resourceS3UseSsl,
      resourceJobConcurrency: settings.resourceJobConcurrency,
      notificationJobConcurrency: settings.notificationJobConcurrency,
      aiJobConcurrency: settings.aiJobConcurrency,
      inAppNotificationsEnabled: settings.inAppNotificationsEnabled,
      websocketNotificationsEnabled: settings.websocketNotificationsEnabled,
      emailNotificationsEnabled: settings.emailNotificationsEnabled,
      hasResourceS3SecretKey: Boolean(settings.resourceS3SecretKey),
      hasSmtpPassword: Boolean(settings.smtpPassword),
      webhookEnabled: settings.webhookEnabled,
      webhookUrl: settings.webhookUrl,
      hasWebhookSecret: Boolean(settings.webhookSecret),
      agnostic: settings.agnostic,
      automationMode: settings.automationMode,
      remindersEnabled: settings.remindersEnabled,
      quietHours: settings.quietHours,
      hasApiKey: Boolean(settings.apiKey)
    };
  }

  private normalizeQuotaRules(value: unknown): ResourceTeamQuotaRule[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is ResourceTeamQuotaRule => Boolean(item && typeof item === 'object' && typeof (item as ResourceTeamQuotaRule).teamId === 'string'))
      .map((item) => ({
        teamId: item.teamId,
        storageLimitBytes: typeof item.storageLimitBytes === 'number' && item.storageLimitBytes > 0 ? item.storageLimitBytes : undefined,
      }));
  }
}
