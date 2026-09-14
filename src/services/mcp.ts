/**
 * mcp.ts — minimal streamable-HTTP MCP client for the personal web app
 * (ADR-0021). Food data comes exclusively from the MCP server's tools.
 *
 * The server runs stateless (ADR-0020): every POST is a self-contained
 * JSON-RPC request served by a fresh server instance, so no initialize
 * handshake is required — verified against SDK 1.30. Responses come back
 * either as `application/json` or `text/event-stream` (both handled).
 *
 * `/mcp` is same-origin in production (the server also serves this app) and
 * proxied by Vite in development (vite.config.ts).
 */

const PROTOCOL_VERSION = '2025-06-18'

interface JsonRpcError {
  code: number
  message: string
}

interface JsonRpcResponse {
  jsonrpc: string
  id?: number
  result?: McpToolResult
  error?: JsonRpcError
}

interface McpToolResult {
  isError?: boolean
  content?: Array<{ type: string; text?: string }>
}

let nextId = 1

/** Call an MCP tool and return its parsed JSON result. */
export async function callTool<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const res = await fetch('/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: nextId++,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  })
  if (!res.ok) throw new Error(`MCP server error (HTTP ${res.status})`)

  const contentType = res.headers.get('content-type') ?? ''
  const message = contentType.includes('text/event-stream')
    ? await readSseMessage(res)
    : ((await res.json()) as JsonRpcResponse)

  if (message.error) {
    throw new Error(`MCP error ${message.error.code}: ${message.error.message}`)
  }
  const result = message.result
  const text = result?.content?.find((c) => c.type === 'text')?.text
  if (!result || result.isError || text === undefined) {
    throw new Error(text ?? `MCP tool '${name}' returned no result`)
  }
  return JSON.parse(text) as T
}

/** Read one JSON-RPC response out of an SSE body (`event: message`). */
async function readSseMessage(res: Response): Promise<JsonRpcResponse> {
  const reader = res.body?.getReader()
  if (!reader) throw new Error('MCP: SSE stream unavailable')
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (!payload) continue
          const parsed = JSON.parse(payload) as JsonRpcResponse
          if (parsed.result || parsed.error) return parsed
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  throw new Error('MCP: SSE stream ended without a response')
}
