import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  broadcastSchedulingUpdate(payload: unknown) {
    this.server.emit('scheduling.updated', payload);
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
