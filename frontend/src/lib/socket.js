// frontend\src\lib\socket.js
import { io } from 'socket.io-client';

let socket;

export const useSocket = () => {
  if (!socket) {
    socket = io('http://localhost:3000', { autoConnect: true });
    socket.on('connect', () => {
      console.log('Socket.IO connected');
    });
    socket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err.message);
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};