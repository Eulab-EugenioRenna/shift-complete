import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  broadcastSchedulingUpdate(payload: unknown) {
    this.server.emit('scheduling.updated', payload);
  }

  broadcastEventsChanged(payload: unknown) {
    this.server.emit('events.changed', payload);
  }

  broadcastAssignmentsChanged(payload: unknown) {
    this.server.emit('assignments.changed', payload);
  }

  broadcastReplacementsChanged(payload: unknown) {
    this.server.emit('replacements.changed', payload);
  }

  broadcastAvailabilityChanged(payload: unknown) {
    this.server.emit('availability.changed', payload);
  }

  broadcastStatsChanged(payload: unknown) {
    this.server.emit('stats.changed', payload);
  }

  broadcastNotificationCreated(payload: unknown) {
    this.server.emit('notification.created', payload);
  }

  broadcastNotificationDelivery(payload: unknown) {
    this.server.emit('notification.delivery.updated', payload);
  }

  broadcastResourceTransfer(payload: unknown) {
    this.server.emit('resource.transfer.updated', payload);
  }

  broadcastAiJobUpdate(payload: unknown) {
    this.server.emit('ai.job.updated', payload);
  }
}
