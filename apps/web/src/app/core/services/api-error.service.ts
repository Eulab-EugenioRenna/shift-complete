import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorResponse } from '@shift-complete/shared-types';

@Injectable({ providedIn: 'root' })
export class ApiErrorService {
  message(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error as ApiErrorResponse | { message?: string } | string | null;

      if (typeof payload === 'string') {
        return payload;
      }

      if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
        return payload.message;
      }
    }

    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }

    return fallback;
  }
}
