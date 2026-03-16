import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  broadcastSchedulingUpdate(payload: unknown) {
    this.server.emit('scheduling.updated', payload);
  }
}
