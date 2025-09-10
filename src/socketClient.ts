import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function ensureSocket() {
  if (!socket) {
    socket = io('http://localhost:8000', { transports: ['websocket'] });
    socket.on('connect', () => console.log('socket connected'));
    socket.on('disconnect', (reason) => console.log('socket disconnected', reason));
    socket.on('connect_error', (err) => console.error('socket error', err));
    socket.on('ping', (data) => console.log('ping', data));
  }
  return socket;
}
