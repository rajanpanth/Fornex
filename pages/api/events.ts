import type { NextApiRequest, NextApiResponse } from "next";

type SseClient = NextApiResponse;

type EventStore = {
  latestEvents: any[];
  clients: SseClient[];
};

const store = (globalThis as any).__fornexEventStore ?? {
  latestEvents: [],
  clients: [],
};
(globalThis as any).__fornexEventStore = store;

export function pushFornexEvents(events: any[]) {
  if (events.length === 0) return;
  const eventStore = store as EventStore;
  eventStore.latestEvents = [...events, ...eventStore.latestEvents].slice(0, 50);
  eventStore.clients = eventStore.clients.filter((client) => {
    try {
      client.write(`data: ${JSON.stringify(events)}\n\n`);
      return true;
    } catch {
      return false;
    }
  });
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const eventStore = store as EventStore;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.write(`data: ${JSON.stringify(eventStore.latestEvents)}\n\n`);

  eventStore.clients.push(res);
  req.on("close", () => {
    eventStore.clients = eventStore.clients.filter((client) => client !== res);
  });
}
