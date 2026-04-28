import type {
  Assignment,
  AuthUser,
  LoginResponse,
  Need,
  NeedSource,
  Organization,
  OrganizationRegisterResponse,
  Volunteer,
} from "../types/api";

const normalize = (baseUrl: string) => baseUrl.trim().replace(/\/+$/, "");
const isBypassToken = (token?: string) => token === "dev-bypass-token";

export const apiRequest = async <T>(
  baseUrl: string,
  path: string,
  options?: RequestInit,
  token?: string,
): Promise<T> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${normalize(baseUrl)}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Network request failed. Check backend URL and firewall.");
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? (payload as { detail?: string }).detail
        : null;
    throw new Error(detail || `Request failed (${response.status})`);
  }

  return payload as T;
};

export const authApi = {
  signup: (baseUrl: string, body: { user_name: string; email: string; password: string; role: "volunteer" }) =>
    apiRequest<AuthUser>(baseUrl, "/auth/register", { method: "POST", body: JSON.stringify(body) }),

  registerOrganization: (
    baseUrl: string,
    body: {
      organization_name: string;
      address?: string;
      phone?: string;
      owner_name: string;
      owner_email: string;
      owner_password: string;
    },
  ) =>
    apiRequest<OrganizationRegisterResponse>(
      baseUrl,
      "/organizations/register",
      { method: "POST", body: JSON.stringify(body) },
    ),

  login: (baseUrl: string, email: string, password: string) =>
    apiRequest<LoginResponse>(baseUrl, "/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: (baseUrl: string, token: string) =>
    apiRequest<AuthUser>(baseUrl, "/auth/me", { method: "GET" }, token),
};

export const moduleApi = {
  createNeed: (
    baseUrl: string,
    token: string,
    body: {
      title: string;
      description?: string | null;
      category: string;
      urgency: string;
      organization_id: number;
      latitude: number;
      longitude: number;
      address: string;
    },
  ) =>
    apiRequest<Need>(
      baseUrl,
      "/needs",
      { method: "POST", body: JSON.stringify(body) },
      token,
    ),

  updateNeed: (
    baseUrl: string,
    token: string,
    needId: number,
    body: {
      title?: string;
      description?: string | null;
      category?: string;
      urgency?: string;
      status?: string;
      organization_id?: number;
      priority_score?: number | null;
      latitude?: number;
      longitude?: number;
      address?: string;
      resolved_at?: string | null;
    },
  ) =>
    apiRequest<Need>(
      baseUrl,
      `/needs/${needId}`,
      { method: "PATCH", body: JSON.stringify(body) },
      token,
    ),

  closeNeed: (baseUrl: string, token: string, needId: number) =>
    apiRequest<{ message: string }>(
      baseUrl,
      `/needs/${needId}`,
      { method: "DELETE" },
      token,
    ),

  needs: (
    baseUrl: string,
    token: string,
    filters?: {
      status?: string;
      urgency?: string;
      category?: string;
      organization_id?: number;
    },
  ) => {
    if (isBypassToken(token)) {
      const mockNeeds: Need[] = [
        {
          id: 1,
          title: "Drinking Water Supply",
          description: "Need clean water packets for 120 families.",
          category: "water",
          urgency: "high",
          status: "open",
          organization_id: 1,
          latitude: 25.4358,
          longitude: 81.8463,
          address: "Naini, Prayagraj",
          created_at: new Date().toISOString(),
        },
      ];
      return Promise.resolve(mockNeeds);
    }
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.urgency) params.set("urgency", filters.urgency);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.organization_id) params.set("organization_id", String(filters.organization_id));
    const query = params.toString();
    return apiRequest<Need[]>(
      baseUrl,
      `/needs${query ? `?${query}` : ""}`,
      { method: "GET" },
      token,
    );
  },

  needSources: (baseUrl: string, token: string, needId: number) =>
    apiRequest<NeedSource[]>(baseUrl, `/needs/${needId}/sources`, { method: "GET" }, token),

  addNeedSource: (
    baseUrl: string,
    token: string,
    needId: number,
    body: {
      source_type:
        | "paper_survey"
        | "csv_upload"
        | "voice_note"
        | "whatsapp"
        | "telegram"
        | "web_form"
        | "phone_call";
      location?: string | null;
      multimedia_txt?: string | null;
      ai_extraction?: string | null;
    },
  ) =>
    apiRequest<NeedSource>(
      baseUrl,
      `/needs/${needId}/sources`,
      { method: "POST", body: JSON.stringify(body) },
      token,
    ),

  volunteers: (baseUrl: string, token: string) => {
    if (isBypassToken(token)) {
      const mockVolunteers: Volunteer[] = [
        { id: 1, user_id: 9999, organization_id: 1, availability: true, verified: true, tasks_completed: 8, active_tasks: 1 },
      ];
      return Promise.resolve(mockVolunteers);
    }
    return apiRequest<Volunteer[]>(baseUrl, "/volunteers", { method: "GET" }, token);
  },

  organizations: (baseUrl: string, token: string) => {
    if (isBypassToken(token)) {
      const mockOrganizations: Organization[] = [
        {
          id: 1,
          organization_name: "NeedMap Demo Org",
          address: "Prayagraj, Uttar Pradesh",
          phone: "+91 9000000000",
          user_id: 9999,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ];
      return Promise.resolve(mockOrganizations);
    }
    return apiRequest<Organization[]>(baseUrl, "/organizations", { method: "GET" }, token);
  },

  addOrganizationMember: (
    baseUrl: string,
    token: string,
    organizationId: number,
    body: {
      user_name: string;
      email: string;
      password: string;
      role: "admin" | "volunteer";
      phone?: string;
    },
  ) =>
    apiRequest<AuthUser>(
      baseUrl,
      `/organizations/${organizationId}/members`,
      { method: "POST", body: JSON.stringify(body) },
      token,
    ),

  deactivateOrganization: (baseUrl: string, token: string, organizationId: number) =>
    apiRequest<{ message: string }>(
      baseUrl,
      `/organizations/${organizationId}`,
      { method: "DELETE" },
      token,
    ),

  assignments: (
    baseUrl: string,
    token: string,
    filters?: {
      need_id?: number;
      volunteer_id?: number;
      organization_id?: number;
      status?: Assignment["status"];
    },
  ) => {
    const params = new URLSearchParams();
    if (filters?.need_id) params.set("need_id", String(filters.need_id));
    if (filters?.volunteer_id) params.set("volunteer_id", String(filters.volunteer_id));
    if (filters?.organization_id) params.set("organization_id", String(filters.organization_id));
    if (filters?.status) params.set("status", filters.status);
    const query = params.toString();

    return apiRequest<Assignment[]>(
      baseUrl,
      `/assignments${query ? `?${query}` : ""}`,
      { method: "GET" },
      token,
    );
  },

  updateAssignmentStatus: (
    baseUrl: string,
    token: string,
    assignmentId: number,
    status: Assignment["status"],
  ) =>
    apiRequest<Assignment>(
      baseUrl,
      `/assignments/${assignmentId}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      token,
    ),

  submitAssignmentFeedback: (
    baseUrl: string,
    token: string,
    assignmentId: number,
    body: { feedback?: string; rating?: number },
    ) =>
    apiRequest<Assignment>(
      baseUrl,
      `/assignments/${assignmentId}/feedback`,
      { method: "PATCH", body: JSON.stringify(body) },
      token,
    ),

  updateMyProfile: (
    baseUrl: string,
    token: string,
    body: { user_name?: string; phone?: string | null },
  ) =>
    apiRequest<AuthUser>(
      baseUrl,
      "/users/me",
      { method: "PATCH", body: JSON.stringify(body) },
      token,
    ),

  updateMyLocation: (
    baseUrl: string,
    token: string,
    body: { latitude?: number; longitude?: number; radius_km?: number },
  ) =>
    apiRequest<AuthUser>(
      baseUrl,
      "/users/me/location",
      { method: "PATCH", body: JSON.stringify(body) },
      token,
    ),

  changeMyPassword: (
    baseUrl: string,
    token: string,
    body: { old_password: string; new_password: string },
  ) =>
    apiRequest<{ message: string }>(
      baseUrl,
      "/users/me/password",
      { method: "PUT", body: JSON.stringify(body) },
      token,
    ),

  deactivateMyAccount: (baseUrl: string, token: string) =>
    apiRequest<{ message: string }>(
      baseUrl,
      "/users/me",
      { method: "DELETE" },
      token,
    ),
};
