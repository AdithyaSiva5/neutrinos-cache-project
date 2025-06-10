'use client';

import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const InvalidationEvents = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const socket = io('http://localhost:3000', { withCredentials: true });
    socket.emit('join', { tenantId: 'T1', configId: 'C1' });
    socket.on('update', (data) => {
      console.log('Received update:', data);
      setEvents((prevEvents) => [...data, ...prevEvents].slice(0, 10)); // Keep latest 10 events
    });
    return () => socket.disconnect();
  }, []);

  return (
    <div>
      <h2>Invalidation Events</h2>
      {events.length === 0 ? (
        <p>No recent events</p>
      ) : (
        <ul>
          {events.map((event, index) => (
            <li key={index}>
              Path: {event.path}, Action: {event.action}, Version: {event.version}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InvalidationEvents;