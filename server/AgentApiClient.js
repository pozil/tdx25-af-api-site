import crypto from "crypto";
import { createEventSource } from "eventsource-client";

const REQUIRED_SCOPES = new Set(["sfap_api", "chatbot_api", "api"]);

export default class AgentApiClient {
  #config;
  #authInfo;

  constructor(config) {
    this.#config = config;
  }

  async authenticate() {
    try {
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
      };
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.#config.clientId,
        client_secret: this.#config.clientSecret,
      });
      const response = await fetch(
        `${this.#config.instanceUrl}/services/oauth2/token`,
        {
          method: "POST",
          body,
          headers,
        }
      );
      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Response status: ${response.status}\nResponse body: ${body}`
        );
      }
      const json = await response.json();

      // Check scopes
      const scopes = new Set(json.scope.split(" "));
      if (!REQUIRED_SCOPES.isSubsetOf(scopes)) {
        throw new Error(
          `Missing OAuth scopes: required ${JSON.stringify([
            ...REQUIRED_SCOPES,
          ])}, found ${JSON.stringify([...scopes])}`
        );
      }

      // Save auth info
      this.#authInfo = {
        accessToken: json.access_token,
        apiInstanceUrl: json.api_instance_url,
      };
      console.log(
        `Agent API: authenticated on ${
          this.#config.instanceUrl
        } (API endpoint: ${this.#authInfo.apiInstanceUrl})`
      );
    } catch (error) {
      console.log("AUTH ERROR:", error);
    }
  }

  async createSession() {
    try {
      const externalSessionKey = crypto.randomUUID();
      const body = JSON.stringify({
        externalSessionKey,
        instanceConfig: {
          endpoint: this.#config.instanceUrl,
        },
        streamingCapabilities: {
          chunkTypes: ["Text"],
        }
      });

      const headers = this.#getHeadersWithAuth();
      headers.append("Content-Type", "application/json");

      const response = await fetch(
        `${this.#getBaseApiUrl()}/agents/${this.#config.agentId}/sessions`,
        {
          method: "POST",
          body,
          headers,
        }
      );
      if (!response.ok) {
        const resBody = await response.text();
        throw new Error(
          `Response status: ${response.status}\nResponse body: ${resBody}`
        );
      }
      const json = await response.json();
      console.log(`Agent API: created session ${json.sessionId}`);
      return json.sessionId;
    } catch (error) {
      console.log("CREATE SESSION ERROR:", error);
    }
  }

  async sendSyncMessage(sessionId, text, variables = []) {
    try {
      const sequenceId = new Date().getTime();
      const body = JSON.stringify({
        message: {
          sequenceId,
          type: "Text",
          text,
        },
        variables,
      });

      const headers = this.#getHeadersWithAuth();
      headers.append("Content-Type", "application/json");
      headers.append("Accept", "application/json");

      console.log(
        `Agent API: sending sync message ${sequenceId} with text: ${text}`
      );
      const response = await fetch(
        `${this.#getBaseApiUrl()}/sessions/${sessionId}/messages`,
        {
          method: "POST",
          body,
          headers,
        }
      );
      if (!response.ok) {
        const resBody = await response.text();
        throw new Error(
          `Response status: ${response.status}\nResponse body: ${resBody}`
        );
      }
      const json = await response.json();
      console.log(JSON.stringify(json, null, 2));
      return json;
    } catch (error) {
      console.log("SEND SYNC MESSAGE ERROR:", error);
    }
  }

  async sendStreamingMessage(
    sessionId,
    text,
    variables = [],
    onMessage,
    onDisconnect = null
  ) {
    try {
      const sequenceId = new Date().getTime();
      const body = JSON.stringify({
        message: {
          sequenceId,
          type: "Text",
          text,
        },
        variables,
      });

      const es = new createEventSource({
        method: "POST",
        url: `${this.#getBaseApiUrl()}/sessions/${sessionId}/messages/stream`,
        headers: {
          Authorization: `Bearer ${this.#authInfo.accessToken}`,
          "Content-Type": "application/json",
        },
        body,
        onMessage,
        onDisconnect: () => {
          console.log("SSE disconnected. Preventing auto reconnect.");
          es.close();
          if (onDisconnect) {
            onDisconnect();
          }
        },
      });
      return es;
    } catch (error) {
      console.log("CREATE SESSION ERROR:", error);
    }
  }

  async closeSession(sessionId) {
    try {
      const headers = this.#getHeadersWithAuth();
      headers.append("x-session-end-reason", "UserRequest");

      const response = await fetch(
        `${this.#getBaseApiUrl()}/sessions/${sessionId}`,
        {
          method: "DELETE",
          headers
        }
      );
      if (!response.ok) {
        const resBody = await response.text();
        throw new Error(
          `Response status: ${response.status}\nResponse body: ${resBody}`
        );
      }
      console.log(`Agent API: closed session ${sessionId}`);
    } catch (error) {
      console.log("DELETE SESSION ERROR:", error);
    }
  }

  async submitFeedback(sessionId, feedbackId, feedback, feedbackText) {
    try {
      const body = {
        feedbackId,
        feedback
      };
      if (feedbackText) {
        body.text = feedbackText;
      }

      const headers = this.#getHeadersWithAuth();

      const response = await fetch(
        `${this.#getBaseApiUrl()}/sessions/${sessionId}/feedback`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        }
      );
      if (!response.ok) {
        const resBody = await response.text();
        throw new Error(
          `Response status: ${response.status}\nResponse body: ${resBody}`
        );
      }
      console.log(`Agent API: submitted feedback on session ${sessionId}`);
    } catch (error) {
      console.log("FEEDBACK SUBMIT ERROR:", error);
    }
  }

  #getBaseApiUrl() {
    return `${this.#authInfo.apiInstanceUrl}/einstein/ai-agent/v1`;
  }

  #getHeadersWithAuth() {
    const headers = new Headers();
    headers.append("Authorization", `Bearer ${this.#authInfo.accessToken}`);
    return headers;
  }
}
