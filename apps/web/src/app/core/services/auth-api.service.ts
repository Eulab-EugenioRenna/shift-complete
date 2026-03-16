import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AuthResponse,
  CompletePasswordResetRequest,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  TeamSummary,
} from '@shift-complete/shared-types';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly apiBaseUrl = 'http://localhost:3333/api';

  constructor(private readonly http: HttpClient) {}

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, payload);
  }

  register(payload: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiBaseUrl}/auth/register`, payload);
  }

  availableTeams(): Observable<TeamSummary[]> {
    return this.http.get<TeamSummary[]>(`${this.apiBaseUrl}/auth/registration-teams`);
  }

  resolveSignupRequest(requestId: string, status: 'APPROVED' | 'DECLINED'): Observable<{ approved?: boolean; declined?: boolean; id?: string; userId?: string }> {
    return this.http.patch<{ approved?: boolean; declined?: boolean; id?: string; userId?: string }>(`${this.apiBaseUrl}/auth/signup-requests/${requestId}`, { status });
  }

  refreshToken(payload: RefreshTokenRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/refresh`, payload);
  }

  requestPasswordReset(payload: ResetPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiBaseUrl}/auth/password-reset/request`, payload);
  }

  completePasswordReset(payload: CompletePasswordResetRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiBaseUrl}/auth/password-reset/complete`, payload);
  }

  verifyEmail(payload: VerifyEmailRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiBaseUrl}/auth/verify-email`, payload);
  }

  resendVerification(payload: ResetPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiBaseUrl}/auth/verify-email/resend`, payload);
  }
}
