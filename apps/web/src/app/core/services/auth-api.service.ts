import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserProfile } from '@shift-complete/shared-types';

interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly apiBaseUrl = 'http://localhost:3333/api';

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, {
      email,
      password
    });
  }

  register(fullName: string, email: string, password: string): Observable<unknown> {
    return this.http.post(`${this.apiBaseUrl}/auth/register`, {
      fullName,
      email,
      password
    });
  }
}
