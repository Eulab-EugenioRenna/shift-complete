import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({ providedIn: 'root' })
export class LiveNotificationsService {
  private socket?: Socket;
  private readonly connectedSignal = signal(false);
  private readonly feedSignal = signal<Array<{ type: string; payload: any }>>([]);

  readonly connected = this.connectedSignal.asReadonly();
  readonly feed = this.feedSignal.asReadonly();

  connect(): void {
    if (this.socket || typeof window === 'undefined') {
      return;
    }

    this.socket = io('http://localhost:3333', {
      transports: ['websocket']
    });

    this.socket.on('connect', () => this.connectedSignal.set(true));
    this.socket.on('disconnect', () => this.connectedSignal.set(false));
    this.socket.on('scheduling.updated', (payload) => {
      this.feedSignal.update((items) => [{ type: payload.kind ?? 'scheduling.updated', payload }, ...items].slice(0, 20));
    });
  }
}
