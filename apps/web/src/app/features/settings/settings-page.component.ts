import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { ThemePreference, ThemeService } from '../../core/services/theme.service';
import { AppApiService } from '../../shared/services/app-api.service';
import { UiButtonComponent, UiChipComponent, UiInputComponent, UiPageHeaderComponent, UiSelectComponent, UiSurfaceComponent, UiTextareaComponent, UiToggleComponent } from '@shift-complete/ui-kit';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UiButtonComponent, UiChipComponent, UiInputComponent, UiPageHeaderComponent, UiSelectComponent, UiSurfaceComponent, UiTextareaComponent, UiToggleComponent],
  templateUrl: './settings-page.component.html'
})
export class SettingsPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);

  protected readonly activeTab = signal<'user' | 'ai' | 'backend' | 'observability'>('ai');
  protected readonly tabs = [
    { id: 'user', label: 'Utente' },
    { id: 'ai', label: 'AI' },
    { id: 'backend', label: 'Backend' },
    { id: 'observability', label: 'Observability' }
  ] as const;
  protected readonly aiSettings = signal<any | null>(null);
  protected readonly aiCapabilities = signal<any[]>([]);
  protected readonly recentJobs = signal<any[]>([]);
  protected readonly aiJobs = signal<any[]>([]);
  protected readonly notificationDeliveries = signal<any[]>([]);
  protected readonly auditLogs = signal<any[]>([]);
  protected readonly schedulingMetrics = signal<any | null>(null);
  protected selectedProvider = signal('disabled');
  protected apiKey = '';
  protected readonly showApiKey = signal(false);
  protected ollamaUrl = 'http://localhost:11434';
  protected smtpHost = 'localhost';
  protected smtpPort = 587;
  protected readonly smtpSecure = signal(false);
  protected smtpUser = '';
  protected smtpPassword = '';
  protected smtpFromEmail = 'no-reply@shift.local';
  protected smtpFromName = 'Shift Complete';
  protected smtpReplyTo = '';
  protected redisUrl = 'redis://localhost:6379';
  protected webAppUrl = 'http://localhost:4200';
  protected selectedResourceStorageDriver = 'local';
  protected totalStorageLimitGb = 0;
  protected defaultTeamStorageLimitGb = 0;
  protected readonly resourceTeamQuotaRules = signal<Array<{ teamId: string; storageLimitGb: number }>>([]);
  protected readonly teams = signal<Array<{ id: string; name: string }>>([]);
  protected resourceS3Endpoint = 'http://localhost:9000';
  protected resourceS3Region = 'us-east-1';
  protected resourceS3Bucket = 'shift-complete-resources';
  protected resourceS3AccessKey = 'shiftminio';
  protected resourceS3SecretKey = '';
  protected readonly resourceS3ForcePathStyle = signal(true);
  protected readonly resourceS3UseSsl = signal(false);
  protected resourceJobConcurrency = 3;
  protected notificationJobConcurrency = 5;
  protected aiJobConcurrency = 2;
  protected schedulingPreviewTransport: 'polling' | 'websocket' | 'hybrid' = 'hybrid';
  protected schedulingPreviewRetryCount = 20;
  protected schedulingPreviewPollIntervalMs = 4000;
  protected schedulingAsyncRangeDays = 14;
  protected schedulingAsyncManualSelections = 20;
  protected readonly schedulingAsyncWithoutEvent = signal(true);
  protected readonly inAppNotificationsEnabled = signal(true);
  protected readonly websocketNotificationsEnabled = signal(true);
  protected readonly emailNotificationsEnabled = signal(true);
  protected readonly webhookEnabled = signal(false);
  protected webhookUrl = '';
  protected webhookSecret = '';
  protected selectedModel = signal<string | null>(null);
  protected readonly availableModels = signal<string[]>([]);
  protected readonly pingStatus = signal<'idle' | 'testing' | 'ok' | 'error'>('idle');
  protected readonly pingLatency = signal<number | null>(null);
  protected readonly loadingModels = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveStatus = signal<'idle' | 'saved' | 'error'>('idle');
  protected readonly creatingAiJob = signal(false);
  protected readonly aiPrompt = signal('');

  protected selectedAutomationMode = 'balanced';
  protected readonly agnosticMode = signal(false);
  protected readonly remindersEnabled = signal(true);
  protected readonly quietHours = signal(true);

  protected readonly providerOptions = [
    { label: 'Disabilitato', value: 'disabled' },
    { label: 'OpenAI', value: 'openai' },
    { label: 'Anthropic', value: 'anthropic' },
    { label: 'Ollama (locale)', value: 'ollama' },
  ];

  protected readonly automationModes = [
    { label: 'Bilanciato', value: 'balanced' },
    { label: 'Manuale', value: 'manual' },
    { label: 'Spinto', value: 'aggressive' }
  ];
  protected readonly schedulingTransportOptions = [
    { label: 'Hybrid', value: 'hybrid' },
    { label: 'Polling', value: 'polling' },
    { label: 'WebSocket', value: 'websocket' },
  ];

  protected readonly needsApiKey = computed(() =>
    this.selectedProvider() === 'openai' || this.selectedProvider() === 'anthropic'
  );
  protected readonly themeOptions = [
    { label: 'Sistema', value: 'system' },
    { label: 'Chiaro', value: 'light' },
    { label: 'Scuro', value: 'dark' }
  ];
  protected readonly remainingTeamQuotaSlots = computed(() => Math.max(this.teams().length - this.resourceTeamQuotaRules().length, 0));

  constructor() {
    this.api.aiSettings().subscribe({
      next: (settings) => {
        this.aiSettings.set(settings);
        if (settings?.provider) this.selectedProvider.set(settings.provider);
        if (settings?.ollamaUrl) this.ollamaUrl = settings.ollamaUrl;
        if (settings?.agnostic) this.agnosticMode.set(settings.agnostic);
        if (settings?.model) this.selectedModel.set(settings.model);
        if (settings?.smtpHost) this.smtpHost = settings.smtpHost;
        if (typeof settings?.smtpPort === 'number') this.smtpPort = settings.smtpPort;
        if (typeof settings?.smtpSecure === 'boolean') this.smtpSecure.set(settings.smtpSecure);
        if (settings?.smtpUser) this.smtpUser = settings.smtpUser;
        if (settings?.smtpFromEmail) this.smtpFromEmail = settings.smtpFromEmail;
        if (settings?.smtpFromName) this.smtpFromName = settings.smtpFromName;
        if (settings?.smtpReplyTo) this.smtpReplyTo = settings.smtpReplyTo;
        if (settings?.hasSmtpPassword) this.smtpPassword = '********';
        if (settings?.redisUrl) this.redisUrl = settings.redisUrl;
        if (settings?.webAppUrl) this.webAppUrl = settings.webAppUrl;
        if (settings?.resourceStorageDriver) this.selectedResourceStorageDriver = settings.resourceStorageDriver;
        this.totalStorageLimitGb = this.bytesToGb(settings?.totalStorageLimitBytes);
        this.defaultTeamStorageLimitGb = this.bytesToGb(settings?.defaultTeamStorageLimitBytes);
        this.resourceTeamQuotaRules.set(this.mapQuotaRules(settings?.resourceTeamQuotaRules));
        if (settings?.resourceS3Endpoint) this.resourceS3Endpoint = settings.resourceS3Endpoint;
        if (settings?.resourceS3Region) this.resourceS3Region = settings.resourceS3Region;
        if (settings?.resourceS3Bucket) this.resourceS3Bucket = settings.resourceS3Bucket;
        if (settings?.resourceS3AccessKey) this.resourceS3AccessKey = settings.resourceS3AccessKey;
        if (settings?.hasResourceS3SecretKey) this.resourceS3SecretKey = '********';
        if (typeof settings?.resourceS3ForcePathStyle === 'boolean') this.resourceS3ForcePathStyle.set(settings.resourceS3ForcePathStyle);
        if (typeof settings?.resourceS3UseSsl === 'boolean') this.resourceS3UseSsl.set(settings.resourceS3UseSsl);
        if (typeof settings?.resourceJobConcurrency === 'number') this.resourceJobConcurrency = settings.resourceJobConcurrency;
        if (typeof settings?.notificationJobConcurrency === 'number') this.notificationJobConcurrency = settings.notificationJobConcurrency;
        if (typeof settings?.aiJobConcurrency === 'number') this.aiJobConcurrency = settings.aiJobConcurrency;
        if (settings?.schedulingPreviewTransport === 'polling' || settings?.schedulingPreviewTransport === 'websocket' || settings?.schedulingPreviewTransport === 'hybrid') this.schedulingPreviewTransport = settings.schedulingPreviewTransport;
        if (typeof settings?.schedulingPreviewRetryCount === 'number') this.schedulingPreviewRetryCount = settings.schedulingPreviewRetryCount;
        if (typeof settings?.schedulingPreviewPollIntervalMs === 'number') this.schedulingPreviewPollIntervalMs = settings.schedulingPreviewPollIntervalMs;
        if (typeof settings?.schedulingAsyncRangeDays === 'number') this.schedulingAsyncRangeDays = settings.schedulingAsyncRangeDays;
        if (typeof settings?.schedulingAsyncManualSelections === 'number') this.schedulingAsyncManualSelections = settings.schedulingAsyncManualSelections;
        if (typeof settings?.schedulingAsyncWithoutEvent === 'boolean') this.schedulingAsyncWithoutEvent.set(settings.schedulingAsyncWithoutEvent);
        if (typeof settings?.inAppNotificationsEnabled === 'boolean') this.inAppNotificationsEnabled.set(settings.inAppNotificationsEnabled);
        if (typeof settings?.websocketNotificationsEnabled === 'boolean') this.websocketNotificationsEnabled.set(settings.websocketNotificationsEnabled);
        if (typeof settings?.emailNotificationsEnabled === 'boolean') this.emailNotificationsEnabled.set(settings.emailNotificationsEnabled);
        if (typeof settings?.webhookEnabled === 'boolean') this.webhookEnabled.set(settings.webhookEnabled);
        if (settings?.webhookUrl) this.webhookUrl = settings.webhookUrl;
        if (settings?.hasWebhookSecret) this.webhookSecret = '********';
        if (settings?.automationMode) this.selectedAutomationMode = settings.automationMode;
        if (typeof settings?.remindersEnabled === 'boolean') this.remindersEnabled.set(settings.remindersEnabled);
        if (typeof settings?.quietHours === 'boolean') this.quietHours.set(settings.quietHours);
      }
    });
    this.api.teams().subscribe({
      next: (teams) => this.teams.set(teams.map((team) => ({ id: team.id, name: team.name }))),
    });
    this.api.aiCapabilities().subscribe({ next: (items) => this.aiCapabilities.set(items) });
    this.loadAuditLogs();
    this.loadAiJobs();
    this.loadNotificationDeliveries();
    this.loadSchedulingMetrics();
  }

  onAutomationModeChange(value: unknown) {
    this.selectedAutomationMode = String(value ?? 'balanced');
  }

  onThemePreferenceChange(value: unknown): void {
    const normalized = String(value ?? 'system') as ThemePreference;
    this.theme.setPreference(normalized === 'light' || normalized === 'dark' || normalized === 'system' ? normalized : 'system');
  }

  protected castString(value: unknown): string {
    return value ? String(value) : '';
  }

  protected setSchedulingPreviewTransport(value: unknown): void {
    const normalized = this.castString(value);
    this.schedulingPreviewTransport = normalized === 'polling' || normalized === 'websocket' ? normalized : 'hybrid';
  }

  pingProvider(): void {
    this.pingStatus.set('testing');
    this.pingLatency.set(null);
    this.api.pingAiProvider({
      provider: this.selectedProvider(),
      apiKey: this.apiKey || undefined,
      ollamaUrl: this.ollamaUrl || undefined,
    }).subscribe({
      next: (result) => {
        this.pingStatus.set(result.ok ? 'ok' : 'error');
        if (result.ok && result.latencyMs) this.pingLatency.set(result.latencyMs);
        if (result.ok) this.fetchModels();
      },
      error: (error) => {
        this.pingStatus.set('error');
        this.feedback.error('Provider non raggiungibile', this.apiError.message(error, 'Impossibile verificare la connessione al provider.'));
      },
    });
  }

  fetchModels(): void {
    if (this.selectedProvider() === 'disabled') return;
    this.loadingModels.set(true);
    this.api.getAiModels(
      this.selectedProvider(),
      this.apiKey || undefined,
      this.ollamaUrl || undefined,
    ).subscribe({
      next: (result) => {
        this.availableModels.set(result.models ?? []);
        this.loadingModels.set(false);
      },
      error: (error) => {
        this.loadingModels.set(false);
        this.feedback.error('Modelli non disponibili', this.apiError.message(error, 'Impossibile recuperare la lista dei modelli.'));
      },
    });
  }

  saveAiSettings(): void {
    this.saving.set(true);
    this.saveStatus.set('idle');
    this.api.updateAiSettings({
      provider: this.selectedProvider(),
      apiKey: this.apiKey || undefined,
      ollamaUrl: this.ollamaUrl || undefined,
      agnostic: this.agnosticMode(),
      model: this.selectedModel() || undefined,
      smtpHost: this.smtpHost || undefined,
      smtpPort: this.smtpPort || undefined,
      smtpSecure: this.smtpSecure(),
      smtpUser: this.smtpUser || undefined,
      smtpPassword: this.smtpPassword || undefined,
      smtpFromEmail: this.smtpFromEmail || undefined,
      smtpFromName: this.smtpFromName || undefined,
      smtpReplyTo: this.smtpReplyTo || undefined,
      redisUrl: this.redisUrl || undefined,
      webAppUrl: this.webAppUrl || undefined,
      resourceStorageDriver: this.selectedResourceStorageDriver || undefined,
      totalStorageLimitBytes: this.gbToBytes(this.totalStorageLimitGb),
      defaultTeamStorageLimitBytes: this.gbToBytes(this.defaultTeamStorageLimitGb),
      resourceTeamQuotaRules: this.resourceTeamQuotaRules()
        .filter((rule) => rule.teamId && rule.storageLimitGb > 0)
        .map((rule) => ({ teamId: rule.teamId, storageLimitBytes: this.gbToBytes(rule.storageLimitGb) ?? undefined })),
      resourceS3Endpoint: this.resourceS3Endpoint || undefined,
      resourceS3Region: this.resourceS3Region || undefined,
      resourceS3Bucket: this.resourceS3Bucket || undefined,
      resourceS3AccessKey: this.resourceS3AccessKey || undefined,
      resourceS3SecretKey: this.resourceS3SecretKey || undefined,
      resourceS3ForcePathStyle: this.resourceS3ForcePathStyle(),
      resourceS3UseSsl: this.resourceS3UseSsl(),
      resourceJobConcurrency: this.resourceJobConcurrency || undefined,
      notificationJobConcurrency: this.notificationJobConcurrency || undefined,
      aiJobConcurrency: this.aiJobConcurrency || undefined,
      schedulingPreviewTransport: this.schedulingPreviewTransport,
      schedulingPreviewRetryCount: this.schedulingPreviewRetryCount || undefined,
      schedulingPreviewPollIntervalMs: this.schedulingPreviewPollIntervalMs || undefined,
      schedulingAsyncRangeDays: this.schedulingAsyncRangeDays || undefined,
      schedulingAsyncManualSelections: this.schedulingAsyncManualSelections || undefined,
      schedulingAsyncWithoutEvent: this.schedulingAsyncWithoutEvent(),
      inAppNotificationsEnabled: this.inAppNotificationsEnabled(),
      websocketNotificationsEnabled: this.websocketNotificationsEnabled(),
      emailNotificationsEnabled: this.emailNotificationsEnabled(),
      webhookEnabled: this.webhookEnabled(),
      webhookUrl: this.webhookUrl || undefined,
      webhookSecret: this.webhookSecret || undefined,
      automationMode: this.selectedAutomationMode,
      remindersEnabled: this.remindersEnabled(),
      quietHours: this.quietHours(),
    }).subscribe({
      next: (settings) => {
        this.saving.set(false);
        this.aiSettings.set(settings);
        this.smtpPassword = '';
        this.resourceS3SecretKey = '';
        this.webhookSecret = '';
        this.saveStatus.set('saved');
        this.feedback.success('Impostazioni AI salvate');
        setTimeout(() => this.saveStatus.set('idle'), 3000);
      },
      error: (error) => {
        this.saving.set(false);
        this.saveStatus.set('error');
        this.feedback.error('Salvataggio non riuscito', this.apiError.message(error, 'Impossibile salvare le impostazioni AI.'));
        setTimeout(() => this.saveStatus.set('idle'), 4000);
      },
    });
  }

  runAiPrompt(): void {
    const prompt = this.aiPrompt().trim();
    if (!prompt) {
      this.feedback.error('Prompt mancante', 'Inserisci un prompt per creare un job AI.');
      return;
    }

    this.creatingAiJob.set(true);
    this.api.createAiJob({
      provider: this.selectedProvider(),
      model: this.selectedModel() || undefined,
      prompt,
      apiKey: this.apiKey || undefined,
      ollamaUrl: this.ollamaUrl || undefined,
    }).subscribe({
      next: () => {
        this.creatingAiJob.set(false);
        this.aiPrompt.set('');
        this.loadAiJobs();
        this.feedback.success('Job AI creato', 'Il prompt e stato inserito nella coda AI.');
      },
      error: (error) => {
        this.creatingAiJob.set(false);
        this.feedback.error('Job AI non creato', this.apiError.message(error, 'Impossibile creare il job AI.'));
      }
    });
  }

  loadAuditLogs(): void {
    this.api.recentAuditLogs(8).subscribe({
      next: (logs) => this.auditLogs.set(logs),
      error: (error) => this.feedback.error('Audit non disponibile', this.apiError.message(error, 'Impossibile recuperare il log operativo.'))
    });
  }

  loadAiJobs(): void {
    this.api.jobs().subscribe({
      next: (jobs) => {
        this.recentJobs.set(jobs);
        this.aiJobs.set(jobs.filter((job) => job.kind === 'ai_task'));
      },
      error: (error) => this.feedback.error('Job AI non disponibili', this.apiError.message(error, 'Impossibile recuperare i job AI.'))
    });
  }

  loadNotificationDeliveries(): void {
    this.api.recentNotificationDeliveries(8).subscribe({
      next: (items) => this.notificationDeliveries.set(items),
      error: (error) => this.feedback.error('Delivery notifiche non disponibili', this.apiError.message(error, 'Impossibile recuperare le delivery notifiche.'))
    });
  }

  loadSchedulingMetrics(): void {
    this.api.schedulingMetrics().subscribe({
      next: (metrics) => this.schedulingMetrics.set(metrics),
      error: (error) => this.feedback.error('Metriche scheduling non disponibili', this.apiError.message(error, 'Impossibile recuperare le metriche del planner.'))
    });
  }

  resetSchedulingMetrics(): void {
    this.api.resetSchedulingMetrics().subscribe({
      next: () => {
        this.feedback.success('Metriche scheduling azzerate');
        this.loadSchedulingMetrics();
      },
      error: (error) => this.feedback.error('Reset metriche non riuscito', this.apiError.message(error, 'Impossibile azzerare le metriche del planner.'))
    });
  }

  runSmtpTest(): void {
    const target = this.session.getCurrentUser()?.email;
    if (!target) {
      this.feedback.error('Test SMTP non disponibile', 'Email utente corrente non disponibile.');
      return;
    }
    this.api.testSmtp(target).subscribe({
      next: (result) => this.feedback.success('Test SMTP eseguito', result.accepted ? 'Email inviata correttamente.' : 'SMTP non configurato o invio rifiutato.'),
      error: (error) => this.feedback.error('Test SMTP fallito', this.apiError.message(error, 'Impossibile eseguire il test SMTP.'))
    });
  }

  runWebhookTest(): void {
    this.api.testWebhook().subscribe({
      next: (result) => this.feedback.success('Test webhook eseguito', result.delivered ? `Webhook consegnato (${result.statusCode ?? 200})` : 'Webhook non configurato o non raggiungibile.'),
      error: (error) => this.feedback.error('Test webhook fallito', this.apiError.message(error, 'Impossibile eseguire il test webhook.'))
    });
  }

  protected currentUserRoleLabel(): string {
    const role = this.session.getCurrentUser()?.role;
    if (role === 'administrator') return 'Amministratore';
    if (role === 'service_leader') return 'Leader del servizio';
    return 'Volontario';
  }

  protected goToUserPage(): void {
    void this.router.navigateByUrl('/user');
  }

  protected addTeamQuotaRule(): void {
    const remainingTeam = this.teams().find((team) => !this.resourceTeamQuotaRules().some((rule) => rule.teamId === team.id));
    if (!remainingTeam) {
      return;
    }

    this.resourceTeamQuotaRules.update((rules) => [...rules, { teamId: remainingTeam.id, storageLimitGb: this.defaultTeamStorageLimitGb || 1 }]);
  }

  protected removeTeamQuotaRule(teamId: string): void {
    this.resourceTeamQuotaRules.update((rules) => rules.filter((rule) => rule.teamId !== teamId));
  }

  protected updateTeamQuotaRuleTeam(currentTeamId: string, nextTeamId: string): void {
    if (!nextTeamId || this.resourceTeamQuotaRules().some((rule) => rule.teamId === nextTeamId && rule.teamId !== currentTeamId)) {
      return;
    }
    this.resourceTeamQuotaRules.update((rules) => rules.map((rule) =>
      rule.teamId === currentTeamId ? { ...rule, teamId: nextTeamId } : rule
    ));
  }

  protected isTeamQuotaOptionDisabled(optionTeamId: string, currentTeamId: string): boolean {
    return this.resourceTeamQuotaRules().some((rule) => rule.teamId === optionTeamId && rule.teamId !== currentTeamId);
  }

  protected teamQuotaOptions(currentTeamId: string): Array<{ label: string; value: string; disabled: boolean }> {
    return this.teams().map((team) => ({
      label: team.name,
      value: team.id,
      disabled: this.isTeamQuotaOptionDisabled(team.id, currentTeamId),
    }));
  }

  protected quotaPreviewLabel(valueGb: number): string {
    return valueGb > 0 ? `${valueGb} GB` : 'Illimitato';
  }

  protected teamLabel(teamId: string): string {
    return this.teams().find((team) => team.id === teamId)?.name ?? 'Team';
  }

  private mapQuotaRules(rules: Array<{ teamId: string; storageLimitBytes?: number }> | undefined): Array<{ teamId: string; storageLimitGb: number }> {
    if (!Array.isArray(rules)) {
      return [];
    }

    return rules
      .filter((rule) => rule?.teamId)
      .map((rule) => ({
        teamId: rule.teamId,
        storageLimitGb: this.bytesToGb(rule.storageLimitBytes),
      }));
  }

  private bytesToGb(value: number | null | undefined): number {
    if (!value || value <= 0) {
      return 0;
    }
    return Number((value / (1024 * 1024 * 1024)).toFixed(2));
  }

  private gbToBytes(value: number | null | undefined): number | undefined {
    if (!value || value <= 0) {
      return undefined;
    }
    return Math.round(value * 1024 * 1024 * 1024);
  }
}
