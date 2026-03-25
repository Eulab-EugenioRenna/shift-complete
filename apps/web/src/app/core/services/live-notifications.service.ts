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
    this.socket.on('events.changed', (payload) => {
      this.feedSignal.update((items) => [{ type: 'events.changed', payload }, ...items].slice(0, 20));
    });
    this.socket.on('assignments.changed', (payload) => {
      this.feedSignal.update((items) => [{ type: 'assignments.changed', payload }, ...items].slice(0, 20));
    });
    this.socket.on('replacements.changed', (payload) => {
      this.feedSignal.update((items) => [{ type: 'replacements.changed', payload }, ...items].slice(0, 20));
    });
    this.socket.on('availability.changed', (payload) => {
      this.feedSignal.update((items) => [{ type: 'availability.changed', payload }, ...items].slice(0, 20));
    });
    this.socket.on('stats.changed', (payload) => {
      this.feedSignal.update((items) => [{ type: 'stats.changed', payload }, ...items].slice(0, 20));
    });
    this.socket.on('notification.created', (payload) => {
      this.feedSignal.update((items) => [{ type: 'notification.created', payload }, ...items].slice(0, 20));
    });
    this.socket.on('notification.delivery.updated', (payload) => {
      this.feedSignal.update((items) => [{ type: 'notification.delivery.updated', payload }, ...items].slice(0, 20));
    });
    this.socket.on('resource.transfer.updated', (payload) => {
      this.feedSignal.update((items) => [{ type: 'resource.transfer.updated', payload }, ...items].slice(0, 20));
    });
    this.socket.on('ai.job.updated', (payload) => {
      this.feedSignal.update((items) => [{ type: 'ai.job.updated', payload }, ...items].slice(0, 20));
    });
  }
}
