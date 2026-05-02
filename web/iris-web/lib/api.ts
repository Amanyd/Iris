// ─── Iris API Client ─────────────────────────────────────────────────────────
// Typed wrapper around fetch() for the iris-core REST API.
// All requests go through Next.js rewrites → http://localhost:3000/api/v1/...

const BASE = "/api/v1";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Relay {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_active: boolean;
  trigger_type: string;
  trigger_config?: Record<string, unknown>;
  next_run_at?: string;
  last_run_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RelayAction {
  id: string;
  relay_id: string;
  node_id: string;
  action_type: string;
  config: Record<string, unknown>;
  order_index: number;
}

export interface RelayEdge {
  id: string;
  relay_id: string;
  parent_node_id: string;
  child_node_id: string;
  condition?: Record<string, unknown>;
}

export interface RelayWithActions extends Relay {
  actions: RelayAction[];
  edges: RelayEdge[];
}

export interface Secret {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Execution {
  id: string;
  relay_id: string;
  event_id?: string;
  status: string;
  trigger_payload?: Record<string, unknown>;
  error_message?: string;
  started_at: string;
  finished_at?: string;
}

export interface ExecutionStep {
  id: string;
  execution_id: string;
  node_id?: string;
  action_type: string;
  status: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error_message?: string;
  started_at: string;
  finished_at?: string;
}

export interface CreateRelayActionInput {
  node_id: string;
  action_type: string;
  config: Record<string, unknown>;
  order_index: number;
}

export interface CreateRelayEdgeInput {
  parent_node_id: string;
  child_node_id: string;
  condition?: Record<string, unknown>;
}

export interface CreateRelayRequest {
  name: string;
  description: string;
  trigger_type: string;
  trigger_config?: Record<string, unknown>;
  actions: CreateRelayActionInput[];
  edges: CreateRelayEdgeInput[];
}

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIRelayResponse {
  ready: boolean;
  questions?: string[];
  relay?: CreateRelayRequest;
  message?: string;
  relay_id?: string; // set when AI is updating an existing relay
}

export interface ApiError {
  code: string;
  message: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("iris_token");
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle no-content responses
  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json();

  if (!res.ok) {
    const err = data as ApiError;
    throw new Error(err.message || `Request failed: ${res.status}`);
  }

  return data as T;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("POST", "/auth/login", { email, password });
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("POST", "/auth/register", { email, password });
}

// ─── Relays ──────────────────────────────────────────────────────────────────

export async function getRelays(): Promise<Relay[]> {
  return request<Relay[]>("GET", "/relays");
}

export async function getRelay(id: string): Promise<RelayWithActions> {
  return request<RelayWithActions>("GET", `/relays/${id}`);
}

export async function createRelay(req: CreateRelayRequest): Promise<RelayWithActions> {
  return request<RelayWithActions>("POST", "/relays", req);
}

export async function updateRelay(
  id: string,
  req: { name?: string; description?: string; is_active?: boolean; trigger_type?: string; trigger_config?: Record<string, unknown> },
): Promise<Relay> {
  return request<Relay>("PUT", `/relays/${id}`, req);
}

export async function deleteRelay(id: string): Promise<void> {
  return request<void>("DELETE", `/relays/${id}`);
}

export async function updateRelayActions(
  id: string,
  actions: CreateRelayActionInput[],
  edges: CreateRelayEdgeInput[],
): Promise<RelayWithActions> {
  return request<RelayWithActions>("PUT", `/relays/${id}/actions`, { actions, edges });
}

export async function triggerRelay(id: string): Promise<{ accepted: string; event_id: string }> {
  return request<{ accepted: string; event_id: string }>("POST", `/relays/${id}/trigger`);
}


// ─── Executions ──────────────────────────────────────────────────────────────

export async function getExecutions(relayId: string): Promise<Execution[]> {
  return request<Execution[]>("GET", `/relays/${relayId}/executions`);
}

export async function getExecution(id: string): Promise<Execution> {
  return request<Execution>("GET", `/executions/${id}`);
}

export async function getExecutionSteps(id: string): Promise<ExecutionStep[]> {
  return request<ExecutionStep[]>("GET", `/executions/${id}/steps`);
}

export async function deleteExecution(id: string): Promise<void> {
  return request<void>("DELETE", `/executions/${id}`);
}

// ─── Secrets ─────────────────────────────────────────────────────────────────

export async function getSecrets(): Promise<Secret[]> {
  return request<Secret[]>("GET", "/secrets");
}

export async function createSecret(name: string, value: string): Promise<Secret> {
  return request<Secret>("POST", "/secrets", { name, value });
}

export async function deleteSecret(id: string): Promise<void> {
  return request<void>("DELETE", `/secrets/${id}`);
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export async function generateRelay(
  message: string,
  conversation: AIMessage[] = [],
  relayId?: string,
): Promise<AIRelayResponse> {
  return request<AIRelayResponse>("POST", "/ai/relay", {
    message,
    conversation,
    ...(relayId ? { relay_id: relayId } : {}),
  });
}

// ─── STT (Speech-to-Text) ─────────────────────────────────────────────────────

export async function transcribeAudio(blob: Blob): Promise<string> {
  const token = getToken();
  const form = new FormData();
  form.append("audio", blob, "audio.webm");

  const res = await fetch(`${BASE}/ai/transcribe`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "transcription failed" }));
    throw new Error((err as ApiError).message ?? "transcription failed");
  }
  const data = await res.json() as { text: string };
  return data.text;
}
