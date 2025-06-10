import { io } from 'socket.io-client';

let socket = null;

export const useSocket = () => {
  if (!socket) {
    socket = io('http://localhost:3000', {
      autoConnect: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true,
    });
    socket.on('connect', () => {
      console.log('Socket.IO connected');
    });
    socket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err.message, err.stack);
    });
    socket.on('reconnect_attempt', () => {
      console.log('Attempting to reconnect...');
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.off('connect');
    socket.off('connect_error');
    socket.off('update');
    socket.disconnect();
    socket = null;
  }
};