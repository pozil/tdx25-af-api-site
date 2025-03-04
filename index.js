import Fastify from "fastify";
import path from "path";
import * as dotenv from "dotenv";
import AgentApiClient from "salesforce-agent-api-client";

import WebSocketService from "./server/WebSocketService.js";

// Load config from .env file
dotenv.config();
const config = {
  instanceUrl: process.env.INSTANCE_URL,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  agentId: process.env.AGENT_ID,
};

// Configure Agent API client
const client = new AgentApiClient(config);

let wss;

async function executeAsyncPrompt(ws, prompt) {
  await client.authenticate();
  const sessionId = await client.createSession();
  try {
    const eventSource = client.sendStreamingMessage(
      sessionId,
      prompt,
      [],
      ({ data, event }) => {
        const eventData = JSON.parse(data);

        const message = { type: "async-prompt-response", data: eventData };
        ws.send(JSON.stringify(message));

        console.log("Event: %s", event);
        console.log(JSON.stringify(eventData, null, 2));
      },
      async () => {
        await client.closeSession(sessionId);
      }
    );
  } catch (error) {
    await client.closeSession(sessionId);
  }
}

async function executeSyncPrompt(ws, prompt) {
  await client.authenticate();
  const sessionId = await client.createSession();
  try {
    const response = await client.sendSyncMessage(sessionId, prompt);
    console.log(JSON.stringify(response, null, 2));
    const message = { type: "sync-prompt-response", data: response.messages[0].message };
    ws.send(JSON.stringify(message));
  } catch (error) {
    console.log(error);
  } finally {
    await client.closeSession(sessionId);
  }
}

const start = async () => {
  const fastify = Fastify({
    logger: true,
  });
  try {
    fastify.register(import("@fastify/compress"));
    fastify.register(import("@fastify/static"), {
      root: path.join(import.meta.dirname, "public"),
      prefix: "/",
    });
    fastify.register(import("@fastify/websocket"), {
      options: { clientTracking: true },
    });
    fastify.register(async function (fastify) {
      wss = new WebSocketService(fastify.websocketServer);
      wss.connect();

      fastify.get(
        "/websockets",
        { websocket: true },
        (socket /* WebSocket */, req /* FastifyRequest */) => {}
      );
    });

    await fastify.listen({
      port: process.env.PORT || 5000,
      host: "0.0.0.0",
    });

    wss.addMessageListener((ws, data) => {
      switch (data?.type) {
        case 'async-prompt':
          executeAsyncPrompt(ws, data.prompt);
          break;
        case 'sync-prompt':
          executeSyncPrompt(ws, data.prompt);
          break;
        default:
          console.log(`Unknown WS event type ${data.type}`);
      }
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
