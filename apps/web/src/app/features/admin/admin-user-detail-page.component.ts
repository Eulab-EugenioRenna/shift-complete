import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ApiErrorService } from '../../core/services/api-error.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { UiDialogShellComponent } from '@shift-complete/ui-kit';
import { AppApiService } from '../../shared/services/app-api.service';

@Component({
  selector: 'app-admin-user-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DialogModule, UiDialogShellComponent],
  templateUrl: './admin-user-detail-page.component.html',
})
export class AdminUserDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly detail = signal<any | null>(null);
  protected readonly timeline = computed(() => this.detail()?.timeline ?? []);
  protected readonly confirmConfig = signal<{ title: string; message: string; run: () => void; tone: 'warn' | 'danger' | 'success'; icon: string } | null>(null);
  protected readonly generatedCredentials = signal<{ email: string; password: string } | null>(null);
  protected readonly confirmVisible = signal(false);
  protected readonly credentialsVisible = signal(false);
  private readonly userId = this.route.snapshot.paramMap.get('userId');

  constructor() {
    if (!this.userId) {
      return;
    }
    this.loadDetail();
  }

  protected requestCredentials() {
    this.confirmConfig.set({
      title: 'Rigenerare credenziali?',
      message: 'VerrA generata una nuova password temporanea e le sessioni attive verranno revocate.',
      tone: 'warn',
      icon: 'pi pi-key',
      run: () => this.api.sendUserCredentials(this.userId as string).subscribe({
        next: (result) => {
          this.closeConfirm();
          this.feedback.success('Credenziali inviate', `Password temporanea: ${result.generatedPassword}`);
          this.openCredentialsModal(this.detail()?.user?.email ?? 'utente', result.generatedPassword);
          this.loadDetail();
        },
        error: (error) => {
          this.closeConfirm();
          this.feedback.error('Invio credenziali fallito', this.apiError.message(error, 'Impossibile rigenerare le credenziali.'));
        }
      })
    });
    this.confirmVisible.set(true);
  }

  protected toggleSuspend() {
    const suspended = Boolean(this.detail()?.user?.suspended);
    this.confirmConfig.set({
      title: suspended ? 'Riattivare account?' : 'Sospendere account?',
      message: suspended ? 'L’utente potra nuovamente autenticarsi.' : 'L’utente perdera accesso immediato e le sessioni verranno invalidate.',
      tone: suspended ? 'success' : 'danger',
      icon: suspended ? 'pi pi-refresh' : 'pi pi-ban',
      run: () => (suspended ? this.api.resumeManagedUser(this.userId as string) : this.api.suspendManagedUser(this.userId as string)).subscribe({
        next: () => {
          this.closeConfirm();
          this.feedback.success(suspended ? 'Account riattivato' : 'Account sospeso');
          this.loadDetail();
        },
        error: (error) => {
          this.closeConfirm();
          this.feedback.error('Operazione account fallita', this.apiError.message(error, 'Impossibile aggiornare lo stato account.'));
        }
      })
    });
    this.confirmVisible.set(true);
  }

  protected confirmAction() {
    this.confirmConfig()?.run();
  }

  protected closeConfirm() {
    this.confirmVisible.set(false);
    this.confirmConfig.set(null);
  }

  protected copyGeneratedPassword() {
    const password = this.generatedCredentials()?.password;
    if (!password) return;
    void navigator.clipboard.writeText(password);
    this.feedback.success('Password copiata');
  }

  protected closeCredentialsModal() {
    this.credentialsVisible.set(false);
    this.generatedCredentials.set(null);
  }

  private loadDetail() {
    this.api.managedUserDetail(this.userId as string).subscribe({
      next: (detail) => this.detail.set(detail),
      error: (error) => this.feedback.error('Dettaglio utente non disponibile', this.apiError.message(error, 'Impossibile recuperare il dettaglio utente.'))
    });
  }

  private openCredentialsModal(email: string, password: string) {
    this.generatedCredentials.set({ email, password });
    this.confirmVisible.set(false);
    queueMicrotask(() => this.credentialsVisible.set(true));
  }
}
