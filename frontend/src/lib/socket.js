import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

let socket = null;

export const useSocket = () => {
  if (!socket) {
    socket = io('http://localhost:3000', {
      autoConnect: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      withCredentials: true,
    });
    socket.on('connect', () => console.log('Socket.IO connected'));
    socket.on('connect_error', (err) => {
      console.error('Socket.IO error:', err.message);
      toast.error('Connection lost. Reconnecting...');
    });
    socket.on('reconnect', () => {
      toast.success('Reconnected to server');
    });
    socket.on('reconnect_attempt', () => console.log('Socket.IO reconnecting...'));
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.off('connect');
    socket.off('connect_error');
    socket.off('reconnect');
    socket.off('reconnect_attempt');
    socket.off('update');
    socket.disconnect();
    socket = null;
  }
};