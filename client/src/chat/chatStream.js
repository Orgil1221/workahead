let sharedConnection = null;

export function connectChat(onEvent, onStatus = () => {}) {
  const token = localStorage.getItem('wa_token');
  if (!sharedConnection || sharedConnection.token !== token) {
    sharedConnection?.stop();
    const connection = { token, listeners: new Set(), status: 'connecting', stop: null };
    sharedConnection = connection;
    connection.stop = openChatStream((event) => {
      for (const listener of connection.listeners) {
        try { listener.onEvent(event); } catch {}
      }
    }, (status) => {
      connection.status = status;
      for (const listener of connection.listeners) {
        try { listener.onStatus(status); } catch {}
      }
    });
  }
  const connection = sharedConnection;
  const listener = { onEvent, onStatus };
  connection.listeners.add(listener);
  onStatus(connection.status);
  return () => {
    connection.listeners.delete(listener);
    if (!connection.listeners.size) {
      connection.stop();
      if (sharedConnection === connection) sharedConnection = null;
    }
  };
}

function openChatStream(onEvent, onStatus) {
  let stopped = false;
  let controller;
  let retryTimer;
  let watchdog;
  let delay = 1000;
  const touch = () => { clearTimeout(watchdog); watchdog = setTimeout(() => controller?.abort(), 35000); };
  async function connect() {
    controller = new AbortController();
    onStatus('connecting');
    touch();
    try {
      const token = localStorage.getItem('wa_token');
      const response = await fetch('/api/chat/events', { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal });
      if (!response.ok || !response.body) throw new Error('Stream unavailable');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      onStatus('live');
      delay = 1000;
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        touch();
        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const packet = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = packet.split('\n').filter((line) => line.startsWith('data: ')).map((line) => line.slice(6)).join('\n');
          if (data) { try { onEvent(JSON.parse(data)); } catch {} }
        }
      }
    } catch {} finally {
      clearTimeout(watchdog);
      if (!stopped) {
        onStatus('reconnecting');
        retryTimer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 15000);
      }
    }
  }
  connect();
  return () => { stopped = true; clearTimeout(retryTimer); clearTimeout(watchdog); controller?.abort(); };
}
