const { app } = require('@azure/functions');
const { DefaultAzureCredential } = require('@azure/identity');

const SCOPE = 'https://ai.azure.com/.default';

// Cache the credential and token across invocations for warm starts.
let credential = null;
let cachedToken = null;
async function getToken() {
  if (!credential) credential = new DefaultAzureCredential();
  if (cachedToken && cachedToken.expiresOnTimestamp - Date.now() > 60_000) {
    return cachedToken.token;
  }
  cachedToken = await credential.getToken(SCOPE);
  return cachedToken.token;
}

app.http('chat', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'chat',
  handler: async (request, context) => {
    const endpoint = process.env.AZURE_AIPROJECT_ENDPOINT;
    if (!endpoint) {
      return { status: 500, jsonBody: { error: 'AZURE_AIPROJECT_ENDPOINT is not set' } };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    const message = (body && typeof body.message === 'string') ? body.message.trim() : '';
    if (!message) {
      return { status: 400, jsonBody: { error: 'message is required' } };
    }

    const previousResponseId = body.conversationId || undefined;
    const agentName = process.env.AZURE_AGENT_NAME || 'SupportAgent';
    const agentVersion = process.env.AZURE_AGENT_VERSION || '1';

    try {
      const token = await getToken();
      const url = `${endpoint.replace(/\/$/, '')}/openai/v1/responses`;
      const payload = {
        agent_reference: {
          type: 'agent_reference',
          name: agentName,
          version: agentVersion,
        },
        input: [
          { type: 'message', role: 'user', content: message },
        ],
      };
      if (previousResponseId) payload.previous_response_id = previousResponseId;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        context.error('Foundry error', res.status, data);
        return {
          status: 502,
          jsonBody: {
            error: 'Agent call failed',
            status: res.status,
            detail: data && data.error ? data.error : data,
          },
        };
      }

      // Extract assistant text from the response output.
      let reply = '';
      if (Array.isArray(data.output)) {
        for (const item of data.output) {
          if (item.type === 'message' && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c.type === 'output_text' && typeof c.text === 'string') {
                reply += c.text;
              }
            }
          }
        }
      }

      return {
        status: 200,
        jsonBody: {
          conversationId: data.id || previousResponseId || null,
          reply,
        },
      };
    } catch (err) {
      context.error('chat handler error', err);
      return {
        status: 500,
        jsonBody: { error: 'Agent call failed', detail: String(err && err.message || err) },
      };
    }
  },
});
