import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { AppApiService } from '../../shared/services/app-api.service';
import { UiToggleComponent, UiSelectComponent } from '@shift-complete/ui-kit';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UiToggleComponent, UiSelectComponent],
  template: `
    <section class="max-w-4xl mx-auto flex flex-col gap-6">
      <header class="py-2">
        <p class="text-sm font-semibold uppercase tracking-widest text-teal-600">Impostazioni</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight text-slate-800">Backend, AI, observability e profilo organizzati per tab di dominio.</h2>
      </header>

      <div class="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div class="grid gap-2 md:grid-cols-4">
          <button *ngFor="let tab of tabs" type="button" class="rounded-xl px-4 py-3 text-sm font-medium transition"
            [class.bg-slate-950]="activeTab() === tab.id"
            [class.text-white]="activeTab() === tab.id"
            [class.bg-slate-50]="activeTab() !== tab.id"
            [class.text-slate-600]="activeTab() !== tab.id"
            (click)="activeTab.set(tab.id)">
            {{ tab.label }}
          </button>
        </div>
      </div>

      <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" *ngIf="activeTab() === 'user'">
        <div class="border-b border-slate-100 px-6 py-4">
          <h3 class="text-base font-semibold text-slate-800">Utente</h3>
          <p class="mt-0.5 text-sm text-slate-500">Riepilogo accesso e scorciatoie verso la gestione del profilo personale.</p>
        </div>
        <div class="px-6 py-5 grid gap-4 md:grid-cols-2">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Ruolo</p>
            <p class="mt-2 text-lg font-semibold text-slate-900">{{ currentUserRoleLabel() }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Stato</p>
            <p class="mt-2 text-lg font-semibold text-slate-900">{{ aiSettings()?.provider || 'Backend pronto' }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
            <p class="text-sm text-slate-600">Le informazioni personali e il cambio credenziali ora vivono nella user page dedicata.</p>
            <button class="mt-3 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" (click)="goToUserPage()">Apri user page</button>
          </div>
        </div>
      </div>

      <!-- Provider AI -->
      <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" *ngIf="activeTab() === 'ai'">
        <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-slate-800 flex items-center gap-2">
              <i class="pi pi-microchip-ai text-[#4979e6]"></i> Provider AI
            </h3>
            <p class="mt-0.5 text-sm text-slate-500">Seleziona il motore AI e configura le credenziali di accesso.</p>
          </div>
          <!-- Connection Status Indicator -->
          <div class="flex items-center gap-2 text-sm font-medium" *ngIf="pingStatus() !== 'idle'">
            <span class="h-3 w-3 rounded-full border-2 inline-block"
              [class.bg-slate-300]="pingStatus() === 'idle'"
              [class.bg-yellow-400]="pingStatus() === 'testing'"
              [class.bg-emerald-400]="pingStatus() === 'ok'"
              [class.bg-red-400]="pingStatus() === 'error'"
              [class.border-slate-200]="pingStatus() === 'idle'"
              [class.border-yellow-300]="pingStatus() === 'testing'"
              [class.border-emerald-300]="pingStatus() === 'ok'"
              [class.border-red-300]="pingStatus() === 'error'"
            ></span>
            <span [class.text-slate-400]="pingStatus() === 'idle'"
                  [class.text-yellow-600]="pingStatus() === 'testing'"
                  [class.text-emerald-600]="pingStatus() === 'ok'"
                  [class.text-red-600]="pingStatus() === 'error'">
              {{ pingStatus() === 'testing' ? 'Verifica...' : pingStatus() === 'ok' ? 'Connesso' + (pingLatency() ? ' · ' + pingLatency() + 'ms' : '') : pingStatus() === 'error' ? 'Non raggiungibile' : '' }}
            </span>
          </div>
        </div>
        <div class="px-6 py-5 grid gap-5">
          <!-- Provider selector -->
          <div class="grid gap-2">
            <label class="text-sm font-medium text-slate-700">Provider</label>
            <div class="flex gap-2 flex-wrap">
              <button *ngFor="let p of providerOptions"
                type="button"
                class="px-4 py-2 rounded-md border text-sm font-medium transition"
                [class.bg-[#4979e6]]="selectedProvider() === p.value"
                [class.text-white]="selectedProvider() === p.value"
                [class.border-[#4979e6]]="selectedProvider() === p.value"
                [class.bg-white]="selectedProvider() !== p.value"
                [class.text-slate-700]="selectedProvider() !== p.value"
                [class.border-slate-300]="selectedProvider() !== p.value"
                [class.hover:bg-slate-50]="selectedProvider() !== p.value"
                (click)="selectedProvider.set(p.value)">
                {{ p.label }}
              </button>
            </div>
          </div>

          <!-- API Key (OpenAI / Anthropic) -->
          <div class="grid gap-2" *ngIf="needsApiKey()">
            <label class="text-sm font-medium text-slate-700">API Key</label>
            <div class="relative">
              <input class="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm font-mono text-slate-800 placeholder-slate-400 focus:border-[#4979e6] focus:outline-none focus:ring-1 focus:ring-[#4979e6] transition"
                [type]="showApiKey() ? 'text' : 'password'"
                [(ngModel)]="apiKey"
                placeholder="sk-..." />
              <button type="button" class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-[#4979e6]" (click)="showApiKey.set(!showApiKey())" [attr.aria-label]="showApiKey() ? 'Nascondi chiave API' : 'Mostra chiave API'">
                <i class="pi" [class.pi-eye]="!showApiKey()" [class.pi-eye-slash]="showApiKey()"></i>
              </button>
            </div>
            <p class="text-xs text-slate-500">La chiave viene salvata lato backend e non viene riproposta in chiaro dopo il salvataggio.</p>
          </div>

          <!-- Ollama URL -->
          <div class="grid gap-2" *ngIf="selectedProvider() === 'ollama'">
            <label class="text-sm font-medium text-slate-700">Ollama URL</label>
            <input class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono text-slate-800 placeholder-slate-400 focus:border-[#4979e6] focus:outline-none focus:ring-1 focus:ring-[#4979e6] transition"
              type="text"
              [(ngModel)]="ollamaUrl"
              placeholder="http://localhost:11434" />
          </div>

          <!-- Models list -->
          <div class="grid gap-2" *ngIf="selectedProvider() !== 'disabled'">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-slate-700">Modello</label>
              <button class="text-xs text-[#4979e6] font-medium hover:underline flex items-center gap-1" (click)="fetchModels()" [disabled]="loadingModels()">
                <i class="pi pi-refresh text-xs" [class.animate-spin]="loadingModels()"></i> {{ loadingModels() ? 'Carico...' : 'Ricarica lista modelli' }}
              </button>
            </div>
            <div *ngIf="availableModels().length > 0; else noModels">
              <div class="flex flex-wrap gap-2">
                <button *ngFor="let model of availableModels()"
                  type="button"
                  class="px-3 py-1 rounded-full border text-xs font-medium transition"
                  [class.bg-[#4979e6]]="selectedModel() === model"
                  [class.text-white]="selectedModel() === model"
                  [class.border-[#4979e6]]="selectedModel() === model"
                  [class.bg-slate-100]="selectedModel() !== model"
                  [class.text-slate-700]="selectedModel() !== model"
                  [class.border-slate-200]="selectedModel() !== model"
                  (click)="selectedModel.set(model)">
                  {{ model }}
                </button>
              </div>
            </div>
            <ng-template #noModels>
              <p class="text-sm text-slate-400 italic">Nessun modello trovato. Avvia il ping per caricare la lista.</p>
            </ng-template>
          </div>

          <!-- Disabled state -->
          <div class="rounded-md bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-500" *ngIf="selectedProvider() === 'disabled'">
            <i class="pi pi-info-circle mr-2"></i> AI disabilitata. La pianificazione automatica userà la modalità manuale.
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3 pt-2">
            <button class="rounded-md bg-[#4979e6] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-60"
              (click)="saveAiSettings()" [disabled]="saving()">
              <i class="pi pi-save mr-1 text-xs"></i> {{ saving() ? 'Salvataggio...' : 'Salva impostazioni' }}
            </button>
            <button class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
              (click)="pingProvider()" [disabled]="pingStatus() === 'testing' || selectedProvider() === 'disabled'">
              <i class="pi pi-wifi mr-1 text-xs"></i> Testa connessione
            </button>
            <span class="text-xs text-emerald-600 font-medium" *ngIf="saveStatus() === 'saved'"><i class="pi pi-check mr-1"></i>Salvato</span>
            <span class="text-xs text-red-600 font-medium" *ngIf="saveStatus() === 'error'"><i class="pi pi-times mr-1"></i>Errore nel salvataggio</span>
          </div>
        </div>
      </div>

      <!-- Automazioni -->
      <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" *ngIf="activeTab() === 'ai'">
        <div class="border-b border-slate-100 px-6 py-4">
          <h3 class="text-base font-semibold text-slate-800 flex items-center gap-2">
            <i class="pi pi-cog text-[#4979e6]"></i> Automazioni
          </h3>
          <p class="mt-0.5 text-sm text-slate-500">Bilanciamento tra manuale e scheduling assistito.</p>
        </div>
        <div class="px-6 py-5 grid gap-5">
          <div class="grid gap-2">
            <label class="text-sm font-medium text-slate-700">Modalità pianificazione</label>
            <p class="text-xs text-slate-500">Ciclo turni, sostituzioni, limiti, quiet hours, reminder e fallback manuale.</p>
            <ui-select [options]="automationModes" [value]="selectedAutomationMode" (valueChange)="onAutomationModeChange($event)"></ui-select>
          </div>
          <div class="grid gap-3">
            <div class="flex items-center justify-between py-3 border-b border-slate-100">
              <div>
                <p class="text-sm font-medium text-slate-800">Modalità AI agnostic</p>
                <p class="text-xs text-slate-500">Usa il provider configurato per ottimizzare le assegnazioni.</p>
              </div>
              <ui-toggle label="" [value]="agnosticMode()" (valueChange)="agnosticMode.set($event)"></ui-toggle>
            </div>
            <div class="flex items-center justify-between py-3 border-b border-slate-100">
              <div>
                <p class="text-sm font-medium text-slate-800">Reminder automatici</p>
                <p class="text-xs text-slate-500">Notifiche automatiche ai volontari prima degli eventi assegnati.</p>
              </div>
              <ui-toggle label="" [value]="remindersEnabled()" (valueChange)="remindersEnabled.set($event)"></ui-toggle>
            </div>
            <div class="flex items-center justify-between py-3">
              <div>
                <p class="text-sm font-medium text-slate-800">Quiet hours</p>
                <p class="text-xs text-slate-500">Non inviare notifiche tra le 22:00 e le 08:00.</p>
              </div>
              <ui-toggle label="" [value]="quietHours()" (valueChange)="quietHours.set($event)"></ui-toggle>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" *ngIf="activeTab() === 'ai'">
        <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-slate-800 flex items-center gap-2">
              <i class="pi pi-sparkles text-[#4979e6]"></i> AI jobs e capabilities
            </h3>
            <p class="mt-0.5 text-sm text-slate-500">Base pronta per frontend: provider, capability e prompt asincroni via queue.</p>
          </div>
          <button class="text-xs font-medium text-[#4979e6] hover:underline" (click)="loadAiJobs()">Aggiorna job</button>
        </div>
        <div class="px-6 py-5 grid gap-6">
          <div class="grid gap-3 md:grid-cols-2">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4" *ngFor="let capability of aiCapabilities()">
              <p class="text-sm font-semibold text-slate-900">{{ capability.provider }}</p>
              <p class="mt-2 text-xs text-slate-500">chat={{ capability.supportsChat }} · models={{ capability.supportsModelListing }} · health={{ capability.supportsHealthcheck }}</p>
            </div>
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-medium text-slate-700">Prompt rapido</label>
            <textarea class="min-h-28 rounded-md border border-slate-300 px-3 py-2 text-sm" [ngModel]="aiPrompt()" (ngModelChange)="aiPrompt.set($event)" placeholder="Es. suggerisci una bozza di reminder per i volontari del turno di domani"></textarea>
            <div class="flex items-center gap-3">
              <button class="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" (click)="runAiPrompt()" [disabled]="creatingAiJob() || selectedProvider() === 'disabled'">{{ creatingAiJob() ? 'Invio...' : 'Crea job AI' }}</button>
            </div>
          </div>
          <div class="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            <div *ngFor="let job of aiJobs()" class="px-4 py-3">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-medium text-slate-800">{{ job.kind }} · {{ job.status }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ job.createdAt | date:'short' }} · progresso {{ job.progress }}%</p>
                </div>
                <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{{ job.id }}</span>
              </div>
            </div>
            <div *ngIf="!aiJobs().length" class="px-4 py-8 text-sm text-slate-400">Nessun job AI disponibile.</div>
          </div>
          <div class="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            <div class="px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Background jobs recenti</div>
            <div *ngFor="let job of recentJobs().slice(0, 8)" class="px-4 py-3">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-medium text-slate-800">{{ job.kind }} · {{ job.status }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ job.createdAt | date:'short' }} · team {{ job.teamId || 'n/a' }} · progresso {{ job.progress }}%</p>
                </div>
                <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{{ job.id }}</span>
              </div>
            </div>
            <div *ngIf="!recentJobs().length" class="px-4 py-8 text-sm text-slate-400">Nessun background job disponibile.</div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" *ngIf="activeTab() === 'backend'">
        <div class="border-b border-slate-100 px-6 py-4">
          <h3 class="text-base font-semibold text-slate-800 flex items-center gap-2">
            <i class="pi pi-server text-[#4979e6]"></i> Backend channels
          </h3>
          <p class="mt-0.5 text-sm text-slate-500">Configurazione persistita di SMTP, webhook e valori backend operativi.</p>
        </div>
        <div class="px-6 py-5 grid gap-6">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">Redis URL</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" [(ngModel)]="redisUrl" placeholder="redis://localhost:6379" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">Web app URL</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" [(ngModel)]="webAppUrl" placeholder="http://localhost:4200" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">SMTP host</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" [(ngModel)]="smtpHost" placeholder="smtp.example.com" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">SMTP port</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" type="number" [(ngModel)]="smtpPort" placeholder="587" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">SMTP user</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" [(ngModel)]="smtpUser" placeholder="user@example.com" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">SMTP password</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" type="password" [(ngModel)]="smtpPassword" placeholder="••••••••" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">From email</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" [(ngModel)]="smtpFromEmail" placeholder="no-reply@shift.local" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">From name</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="smtpFromName" placeholder="Shift Complete" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">Reply-to</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" [(ngModel)]="smtpReplyTo" placeholder="support@example.com" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">Resource storage path</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" [(ngModel)]="resourceStoragePath" placeholder="storage/resources" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">Resource temp path</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" [(ngModel)]="resourceTempPath" placeholder="storage/resources/tmp" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">Resource queue concurrency</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" type="number" [(ngModel)]="resourceJobConcurrency" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">Notification queue concurrency</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" type="number" [(ngModel)]="notificationJobConcurrency" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">AI queue concurrency</label>
              <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" type="number" [(ngModel)]="aiJobConcurrency" />
            </div>
            <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p class="text-sm font-medium text-slate-800">SMTP secure</p>
                <p class="text-xs text-slate-500">Abilita TLS implicito, tipicamente porta 465.</p>
              </div>
              <ui-toggle label="" [value]="smtpSecure()" (valueChange)="smtpSecure.set($event)"></ui-toggle>
            </div>
            <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p class="text-sm font-medium text-slate-800">In-app notifications</p>
                <p class="text-xs text-slate-500">Salva notifiche nel database applicativo.</p>
              </div>
              <ui-toggle label="" [value]="inAppNotificationsEnabled()" (valueChange)="inAppNotificationsEnabled.set($event)"></ui-toggle>
            </div>
            <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p class="text-sm font-medium text-slate-800">Websocket notifications</p>
                <p class="text-xs text-slate-500">Pubblica eventi realtime verso il frontend.</p>
              </div>
              <ui-toggle label="" [value]="websocketNotificationsEnabled()" (valueChange)="websocketNotificationsEnabled.set($event)"></ui-toggle>
            </div>
            <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p class="text-sm font-medium text-slate-800">Email notifications</p>
                <p class="text-xs text-slate-500">Abilita la delivery email tramite SMTP.</p>
              </div>
              <ui-toggle label="" [value]="emailNotificationsEnabled()" (valueChange)="emailNotificationsEnabled.set($event)"></ui-toggle>
            </div>
          </div>

          <div class="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-slate-800">Webhook notifiche</p>
                <p class="text-xs text-slate-500">Invio webhook asincrono firmato per eventi backend.</p>
              </div>
              <ui-toggle label="" [value]="webhookEnabled()" (valueChange)="webhookEnabled.set($event)"></ui-toggle>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="grid gap-2 md:col-span-2">
                <label class="text-sm font-medium text-slate-700">Webhook URL</label>
                <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" [(ngModel)]="webhookUrl" placeholder="https://hooks.example.com/shift" />
              </div>
              <div class="grid gap-2 md:col-span-2">
                <label class="text-sm font-medium text-slate-700">Webhook secret</label>
                <input class="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" type="password" [(ngModel)]="webhookSecret" placeholder="shared-secret" />
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button class="rounded-md bg-[#4979e6] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-60" (click)="saveAiSettings()" [disabled]="saving()">Salva backend settings</button>
            <button class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700" (click)="runSmtpTest()">Test SMTP</button>
            <button class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700" (click)="runWebhookTest()">Test webhook</button>
            <span class="text-xs text-slate-500">I valori persistono nel DB e fanno fallback su .env solo se assenti.</span>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" *ngIf="activeTab() === 'observability'">
        <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-slate-800 flex items-center gap-2">
              <i class="pi pi-send text-[#4979e6]"></i> Delivery notifiche
            </h3>
            <p class="mt-0.5 text-sm text-slate-500">Storico canali email, websocket e webhook gestiti dalla coda notifiche.</p>
          </div>
          <button class="text-xs font-medium text-[#4979e6] hover:underline" (click)="loadNotificationDeliveries()">Aggiorna delivery</button>
        </div>
        <div class="divide-y divide-slate-100">
          <div *ngFor="let item of notificationDeliveries()" class="px-6 py-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-slate-800">{{ item.channel }} · {{ item.status }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ item.notification?.subject }} · {{ item.notification?.user?.email || 'utente' }} · {{ item.createdAt | date:'short' }}</p>
                <p class="mt-1 text-xs text-red-500" *ngIf="item.lastError">{{ item.lastError }}</p>
              </div>
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{{ item.id }}</span>
            </div>
          </div>
          <div *ngIf="!notificationDeliveries().length" class="px-6 py-8 text-sm text-slate-400">Nessuna delivery disponibile.</div>
        </div>
      </div>

      <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" *ngIf="activeTab() === 'observability'">
        <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-slate-800 flex items-center gap-2">
              <i class="pi pi-history text-[#4979e6]"></i> Audit recente
            </h3>
            <p class="mt-0.5 text-sm text-slate-500">Ultime modifiche tracciate su configurazioni e flussi operativi.</p>
          </div>
          <button class="text-xs font-medium text-[#4979e6] hover:underline" (click)="loadAuditLogs()">Aggiorna log</button>
        </div>
        <div class="divide-y divide-slate-100">
          <div *ngFor="let item of auditLogs()" class="px-6 py-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-slate-800">{{ item.action }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ item.user?.fullName || item.user?.email || 'Sistema' }} · {{ item.entityType }} · {{ item.createdAt | date:'short' }}</p>
              </div>
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{{ item.entityId }}</span>
            </div>
          </div>
          <div *ngIf="!auditLogs().length" class="px-6 py-8 text-sm text-slate-400">Nessun log disponibile.</div>
        </div>
      </div>
    </section>
  `
})
export class SettingsPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

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
  protected resourceStoragePath = 'storage/resources';
  protected resourceTempPath = 'storage/resources/tmp';
  protected resourceJobConcurrency = 3;
  protected notificationJobConcurrency = 5;
  protected aiJobConcurrency = 2;
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

  protected readonly needsApiKey = computed(() =>
    this.selectedProvider() === 'openai' || this.selectedProvider() === 'anthropic'
  );

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
        if (settings?.resourceStoragePath) this.resourceStoragePath = settings.resourceStoragePath;
        if (settings?.resourceTempPath) this.resourceTempPath = settings.resourceTempPath;
        if (typeof settings?.resourceJobConcurrency === 'number') this.resourceJobConcurrency = settings.resourceJobConcurrency;
        if (typeof settings?.notificationJobConcurrency === 'number') this.notificationJobConcurrency = settings.notificationJobConcurrency;
        if (typeof settings?.aiJobConcurrency === 'number') this.aiJobConcurrency = settings.aiJobConcurrency;
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
    this.api.aiCapabilities().subscribe({ next: (items) => this.aiCapabilities.set(items) });
    this.loadAuditLogs();
    this.loadAiJobs();
    this.loadNotificationDeliveries();
  }

  onAutomationModeChange(value: unknown) {
    this.selectedAutomationMode = String(value ?? 'balanced');
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
      resourceStoragePath: this.resourceStoragePath || undefined,
      resourceTempPath: this.resourceTempPath || undefined,
      resourceJobConcurrency: this.resourceJobConcurrency || undefined,
      notificationJobConcurrency: this.notificationJobConcurrency || undefined,
      aiJobConcurrency: this.aiJobConcurrency || undefined,
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
}
