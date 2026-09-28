function setupSockets(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Simulate live sensor data every 3 seconds
    const sensorInterval = setInterval(() => {
      socket.emit('sensor:live', {
        timestamp: new Date().toISOString(),
        sensors: [
          {
            id: 'T-01',
            label: 'Temperature Sensor',
            type: 'temperature',
            value: +(60 + Math.random() * 40).toFixed(1),
            unit: 'C',
            status: Math.random() > 0.85 ? 'warning' : 'normal',
          },
          {
            id: 'V-01',
            label: 'Vibration Sensor',
            type: 'vibration',
            value: +(2 + Math.random() * 8).toFixed(2),
            unit: 'mm/s',
            status: Math.random() > 0.9 ? 'critical' : 'normal',
          },
          {
            id: 'P-01',
            label: 'Pressure Sensor',
            type: 'pressure',
            value: +(100 + Math.random() * 50).toFixed(1),
            unit: 'kPa',
            status: Math.random() > 0.88 ? 'warning' : 'normal',
          },
          {
            id: 'S-01',
            label: 'Speed Sensor',
            type: 'speed',
            value: +(1200 + Math.random() * 300).toFixed(0),
            unit: 'RPM',
            status: 'normal',
          },
        ],
      });
    }, 3000);

    socket.on('disconnect', () => {
      clearInterval(sensorInterval);
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = setupSockets;
