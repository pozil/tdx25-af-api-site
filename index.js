import Fastify from "fastify";
import path from "path";
import * as dotenv from 'dotenv';

import WebSocketService from "./server/WebSocketService.js";
import AgentApiClient from "./server/AgentApiClient.js";

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

async function executePrompt(ws, prompt) {
  await client.authenticate();
  const sessionId = await client.createSession();
  try {
    const eventSource = await client.sendStreamingMessage(
      sessionId,
      prompt,
      [],
      ({data, event}) => {
        const eventData = JSON.parse(data);

        const message = { type: 'prompt-response', data: eventData };
        ws.send(JSON.stringify(message));
        
        console.log('Event: %s', event);
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
        (socket /* WebSocket */, req /* FastifyRequest */) => {
        }
      );
    });

    await fastify.listen({
      port: process.env.PORT || 5000,
      host: "0.0.0.0",
    });

    wss.addMessageListener((ws, data) => {
      if (data.type === 'prompt') {
        executePrompt(ws, data.prompt);
      }
    });

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
