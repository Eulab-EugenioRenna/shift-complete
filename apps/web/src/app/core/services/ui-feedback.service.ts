import { Injectable, signal } from '@angular/core';
import { ActionFeedbackItem } from '@shift-complete/shared-types';

@Injectable({ providedIn: 'root' })
export class UiFeedbackService {
  private readonly itemsSignal = signal<ActionFeedbackItem[]>([]);

  readonly items = this.itemsSignal.asReadonly();

  success(title: string, message?: string) {
    this.push('success', title, message);
  }

  error(title: string, message?: string) {
    this.push('error', title, message);
  }

  info(title: string, message?: string) {
    this.push('info', title, message);
  }

  dismiss(id: string) {
    this.itemsSignal.update((items) => items.filter((item) => item.id !== id));
  }

  private push(type: ActionFeedbackItem['type'], title: string, message?: string) {
    const item: ActionFeedbackItem = {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      createdAt: new Date().toISOString()
    };

    this.itemsSignal.update((items) => [item, ...items].slice(0, 5));
    setTimeout(() => this.dismiss(item.id), type === 'error' ? 6000 : 3500);
  }
}
