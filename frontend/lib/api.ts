import type {
  AdminAssistantReply,
  Alert,
  AssistantContext,
  AuthResponse,
  CheckIn,
  ChatMessage,
  EvidenceRecord,
  Incident,
  IncidentAnalysis,
  SosPrefill,
  User,
} from "../types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export const LIVE_STREAM_WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  "ws://localhost:8000/api/livestream/analyze";

/** Backend origin serving the /media static mount (evidence files). */
const MEDIA_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

/** Resolve a backend-relative media path (e.g. /media/evidence/x.jpg) to a full URL. */
export function evidenceMediaUrl(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${MEDIA_BASE_URL}${path}`;
}

const TOKEN_KEY = "adr_token";
const USER_KEY = "adr_user";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getToken() {
  if (!isBrowser()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (!isBrowser()) return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null) {
  if (!isBrowser()) return;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

/**
 * Thin fetch wrapper for the future backend. Every call is designed to point
 * at API_BASE_URL out of the box — swapping mocks for the real backend later
 * is a one-line env change, not a rewrite.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body?.message ?? `Request failed with status ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

/**
 * Wraps a real API call with a fallback so the UI stays usable if the
 * backend is unreachable. Logs a warning when fallback triggers.
 */
async function withFallback<T>(
  real: () => Promise<T>,
  fallback: () => Promise<T> | T,
): Promise<T> {
  try {
    return await real();
  } catch (err) {
    console.warn(
      "[API] Falling back to mock data:",
      err instanceof Error ? err.message : err,
    );
    return fallback();
  }
}

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Auth ----------

export const authApi = {
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () =>
    withFallback<User>(
      () => request("/auth/me"),
      async () => {
        await delay(150);
        const stored = getStoredUser();
        if (stored) return stored;
        throw new Error("Not signed in");
      },
    ),
};

// ---------- Incidents ----------

export const incidentsApi = {
  list: () =>
    withFallback<Incident[]>(
      () => request("/incidents"),
      async () => {
        await delay();
        return [];
      },
    ),

  create: (
    body: Partial<Incident> & {
      isGuestReport?: boolean;
      evidenceIds?: string[];
    },
  ) =>
    withFallback<Incident>(
      () =>
        request("/incidents", { method: "POST", body: JSON.stringify(body) }),
      async () => {
        await delay();
        return {
          id: `inc-${Date.now()}`,
          title: body.title ?? "New incident",
          description: body.description ?? "",
          peopleAffected: body.peopleAffected ?? 0,
          trapped: body.trapped ?? "no",
          structuralDamage: body.structuralDamage ?? "minor",
          severityScore: body.severityScore ?? 10,
          severityLevel: "medium",
          status: "open",
          location: body.location ?? {
            lat: 24.8607,
            lng: 67.0011,
            label: "Unknown",
          },
          reportedAt: new Date().toISOString(),
          reportedBy: body.isGuestReport ? "Guest report" : "Staff report",
          isGuestReport: !!body.isGuestReport,
        } satisfies Incident;
      },
    ),

  analyze: (body: { description: string; photo?: string }) =>
    withFallback<IncidentAnalysis>(
      () =>
        request("/incidents/analyze", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      async () => {
        await delay(700);
        return {
          peopleAffected: 0,
          trapped: "no",
          structuralDamage: "minor",
          severityScore: 0,
          reasoning:
            "AI analysis unavailable — connect the backend for live estimates.",
        };
      },
    ),

  priorityScores: (incidents: Incident[]) =>
    request<{ scores: Record<string, number> }>("/incidents/priority-scores", {
      method: "POST",
      body: JSON.stringify({ incidents }),
    }),

  updateStatus: (id: string, status: Incident["status"]) =>
    withFallback<Incident>(
      () =>
        request(`/incidents/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      async () => {
        await delay(200);
        throw new Error(
          "Backend not connected — status updates require the live API.",
        );
      },
    ),

  delete: (id: string) =>
    withFallback<{ id: string; status: "deleted" }>(
      () => request(`/incidents/${id}`, { method: "DELETE" }),
      async () => {
        await delay(200);
        throw new Error(
          "Backend not connected — deleting cases requires the live API.",
        );
      },
    ),
};

// ---------- Check-ins ----------

export const checkInsApi = {
  list: () =>
    withFallback<CheckIn[]>(
      () => request("/check-ins"),
      async () => {
        await delay();
        return [];
      },
    ),
};

// ---------- Alerts ----------

export const alertsApi = {
  list: () =>
    withFallback<Alert[]>(
      () => request("/alerts"),
      async () => {
        await delay();
        return [];
      },
    ),

  send: (body: { level: Alert["level"]; message: string }) =>
    withFallback<Alert>(
      () => request("/alerts", { method: "POST", body: JSON.stringify(body) }),
      async () => {
        await delay(300);
        return {
          id: `al-${Date.now()}`,
          level: body.level,
          message: body.message,
          sentAt: new Date().toISOString(),
          sentBy: "You",
        };
      },
    ),
};

// ---------- Evidence submissions (unified upload + live share) ----------

export interface EvidenceUploadInput {
  file: File;
  /** Client-extracted JPEG used for AI analysis and the gallery thumbnail */
  frame?: Blob | null;
  source?: "upload" | "stream";
  caseId?: string;
  location?: { lat: number; lng: number; label?: string } | null;
  trapped?: string;
  peopleAffected?: number;
}

export const evidenceApi = {
  /**
   * Submit one photo or video for AI analysis. No withFallback — a failed
   * upload must surface as an error so the victim can retry, not silently
   * pretend the evidence reached responders.
   */
  upload: async (input: EvidenceUploadInput): Promise<EvidenceRecord> => {
    const form = new FormData();
    form.append("file", input.file);
    if (input.frame) form.append("frame", input.frame, "frame.jpg");
    form.append("source", input.source ?? "upload");
    if (input.caseId) form.append("caseId", input.caseId);
    if (input.location) form.append("location", JSON.stringify(input.location));
    if (input.trapped) form.append("trapped", input.trapped);
    if (input.peopleAffected !== undefined)
      form.append("peopleAffected", String(input.peopleAffected));

    const token = getToken();
    const res = await fetch(`${API_BASE_URL}/evidence/upload`, {
      method: "POST",
      // Let the browser set the multipart boundary — never force JSON headers here.
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        body?.message ??
          body?.detail ??
          `Upload failed with status ${res.status}`,
      );
    }
    return res.json() as Promise<EvidenceRecord>;
  },

  list: () =>
    withFallback<EvidenceRecord[]>(
      () => request("/evidence"),
      async () => {
        await delay();
        return [];
      },
    ),

  delete: (id: string) =>
    withFallback<{ id: string; status: string }>(
      () => request(`/evidence/${id}`, { method: "DELETE" }),
      async () => {
        await delay(200);
        return { id, status: "deleted" };
      },
    ),
};

// ---------- Assistant chat (Qwen-Max powered chatbot) ----------

/**
 * Offline reply with pre-written survival tips, shown when the assistant
 * backend is unreachable. Personalized with case context when available and
 * rendered in the victim's selected UI language.
 */
export function buildOfflineAssistantMessage(
  context?: AssistantContext,
): string {
  const isUrdu = context?.language === "ur";

  const tips = isUrdu
    ? [
        "میں اس وقت آف لائن ہوں اور ریسپانس نیٹ ورک سے رابطہ نہیں کر سکا۔ دوبارہ کنیکٹ ہونے تک یہ بنیادی احتیاطیں اپنائیں:",
        "1۔ جان کو خطرہ ہے؟ ابھی ریسکیو 1122 پر کال کریں۔",
        "2۔ خراب عمارتوں، ٹوٹے شیشوں اور گری ہوئی بجلی کی تاروں سے دور رہیں۔",
        "3۔ سیلاب؟ اونچی جگہ پر چلے جائیں۔ بہتے پانی میں کبھی پیدل نہ جائیں اور نہ گاڑی چلائیں۔",
        "4۔ فون کی بیٹری بچائیں: اسکرین کی روشنی کم کریں اور غیر ضروری ایپس بند کریں۔",
      ]
    : [
        "I'm offline right now and can't reach the response network. Until I reconnect, follow these essentials:",
        "1. Life-threatening emergency? Call Rescue 1122 now.",
        "2. Stay clear of damaged buildings, broken glass, and fallen power lines.",
        "3. Flooding? Move to higher ground. Never walk or drive through moving water.",
        "4. Save phone battery: dim the screen and close unused apps.",
      ];

  if (context?.trapped && context.trapped !== "no") {
    tips.push(
      isUrdu
        ? "پھنسے ہوئے ہیں؟ باقاعدگی سے پائپ یا دیوار پر تھاپ دیں، وقفے وقفے سے آواز لگائیں، اور مٹی سے ناک اور منہ ڈھانپ کر رکھیں۔"
        : "Trapped? Tap on pipes or walls at regular intervals, shout in bursts, and keep your nose and mouth covered from dust.",
    );
  }
  if (context?.situation?.toLowerCase().includes("flood")) {
    tips.push(
      isUrdu
        ? "سیلابی پانی کھلے مین ہول اور بجلی کی تاریں چھپاتا ہے — ہر تالاب کو خطرناک سمجھیں۔"
        : "Flood water hides open manholes and live wires — treat every puddle as dangerous.",
    );
  }
  tips.push(
    isUrdu
      ? "کنکشن بحال ہوتے ہی میں خودکار طور پر جواب دینا شروع کر دوں گا۔"
      : "I'll answer automatically once the connection is back.",
  );
  return tips.join("\n");
}

export const assistantApi = {
  send: (
    message: string,
    history: ChatMessage[] = [],
    context?: AssistantContext,
  ): Promise<ChatMessage> =>
    withFallback<ChatMessage>(
      () =>
        request<{ reply: string; sos?: SosPrefill | null }>(
          "/chatbot/message",
          {
            method: "POST",
            body: JSON.stringify({
              message,
              history: history.map((m) => ({ role: m.role, content: m.text })),
              context,
            }),
          },
        ).then((res) => ({
          id: `msg-${Date.now()}`,
          role: "assistant" as const,
          text: res.reply,
          sosPrefill: res.sos ?? undefined,
          sentAt: new Date().toISOString(),
        })),
      async () => {
        await delay(500);
        return {
          id: `msg-${Date.now()}`,
          role: "assistant" as const,
          text: buildOfflineAssistantMessage(context),
          sentAt: new Date().toISOString(),
        };
      },
    ),
};

// ---------- Admin AI assistant (Qwen-Max dispatch co-pilot) ----------

/**
 * Offline reply for the Admin AI Assistant when the operations backend is
 * unreachable. Rendered in the admin's selected UI language.
 */
export function buildOfflineAdminAssistantMessage(
  context?: AssistantContext,
): string {
  const isUrdu = context?.language === "ur";

  return isUrdu
    ? [
        "میں اس وقت آپریشنز اے آئی سے رابطہ نہیں کر سکا۔ لائیو کیس ڈیٹا، خلاصے اور نشری الرٹ کا مسودہ فی الحال دستیاب نہیں۔",
        "1۔ دوبارہ کنیکٹ ہونے تک تازہ ترین SOS رپورٹس کے لیے جوابی فہرست دیکھیں۔",
        "2۔ آپ اب بھی فارم سے دستی طور پر نشری الرٹ لکھ کر بھیج سکتے ہیں۔",
        "کنکشن بحال ہوتے ہی میں خودکار طور پر جواب دینا شروع کر دوں گا۔",
      ].join("\n")
    : [
        "I can't reach the operations AI right now. Live case data, summaries, and broadcast drafting are unavailable.",
        "1. Check the Response list for the latest SOS reports while I reconnect.",
        "2. You can still compose and send a broadcast manually from the form.",
        "I'll answer automatically once the connection is back.",
      ].join("\n");
}

export const adminAssistantApi = {
  send: (
    message: string,
    history: ChatMessage[] = [],
    context?: AssistantContext,
  ): Promise<AdminAssistantReply> =>
    withFallback<AdminAssistantReply>(
      () =>
        request<AdminAssistantReply>("/admin-assistant/message", {
          method: "POST",
          body: JSON.stringify({
            message,
            history: history.map((m) => ({ role: m.role, content: m.text })),
            context,
          }),
        }),
      async () => {
        await delay(500);
        return {
          reply: buildOfflineAdminAssistantMessage(context),
          broadcast: null,
        };
      },
    ),
};
