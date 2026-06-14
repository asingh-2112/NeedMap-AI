import type {
  Assignment,
  AuthUser,
  LoginResponse,
  Need,
  NeedSource,
  Organization,
  OrganizationRegisterResponse,
  Volunteer,
  VolunteerSkill,
} from "../types/api";
import { getErrorMessage, publishToast } from "./toast";

const normalize = (baseUrl: string) => baseUrl.trim().replace(/\/+$/, "");
const isBypassToken = (token?: string) => token === "dev-bypass-token";
type ApiPrefix = "" | "/api" | "/api/v1";
const preferredPrefixByResource: Record<string, ApiPrefix> = {};
type ApiToastOptions = {
  suppress?: boolean;
  successMessage?: string;
  errorMessage?: string;
};

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const getMethod = (options?: RequestInit) => (options?.method || "GET").toUpperCase();

const getResourceLabel = (path: string) => {
  const [resource] = path
    .split("?")[0]
    .replace(/^\/api\/v1\//, "/")
    .replace(/^\/api\//, "/")
    .split("/")
    .filter(Boolean);
  const normalized = (resource || "request").replace(/[-_]/g, " ");
  const singular = normalized.endsWith("ies")
    ? `${normalized.slice(0, -3)}y`
    : normalized.endsWith("s")
      ? normalized.slice(0, -1)
      : normalized;
  return singular.charAt(0).toUpperCase() + singular.slice(1);
};

const getSuccessMessage = (method: string, path: string) => {
  const resource = getResourceLabel(path);
  if (method === "POST") return `${resource} saved successfully`;
  if (method === "PUT" || method === "PATCH") return `${resource} updated successfully`;
  if (method === "DELETE") return `${resource} deleted successfully`;
  return "Request completed";
};

export const apiRequest = async <T>(
  baseUrl: string,
  path: string,
  options?: RequestInit,
  token?: string,
  toastOptions?: ApiToastOptions,
): Promise<T> => {
  const method = getMethod(options);
  const hasFormDataBody = typeof FormData !== "undefined" && options?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(hasFormDataBody ? {} : { "Content-Type": "application/json" }),
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
    const err = new Error("Network request failed. Check backend URL and firewall.");
    if (!toastOptions?.suppress) {
      publishToast({ type: "error", title: "API failed", message: toastOptions?.errorMessage || err.message });
    }
    throw err;
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
    const err = new Error(detail || `Request failed (${response.status})`);
    if (!toastOptions?.suppress) {
      publishToast({ type: "error", title: "API failed", message: toastOptions?.errorMessage || err.message });
    }
    throw err;
  }

  if (!toastOptions?.suppress && mutationMethods.has(method)) {
    publishToast({
      type: "success",
      title: toastOptions?.successMessage || getSuccessMessage(method, path),
    });
  }

  return payload as T;
};

const applyPrefix = (path: string, prefix: "" | "/api" | "/api/v1"): string => {
  if (prefix === "") {
    if (path.startsWith("/api/v1/")) return path.replace("/api/v1", "");
    if (path.startsWith("/api/")) return path.replace("/api", "");
    return path;
  }

  if (prefix === "/api") {
    if (path.startsWith("/api/v1/")) return path.replace("/api/v1", "/api");
    if (path.startsWith("/api/")) return path;
    return `/api${path}`;
  }

  if (path.startsWith("/api/v1/")) return path;
  if (path.startsWith("/api/")) return path.replace("/api", "/api/v1");
  return `/api/v1${path}`;
};

const getPrefixFromPath = (path: string): "" | "/api" | "/api/v1" => {
  if (path.startsWith("/api/v1/")) return "/api/v1";
  if (path.startsWith("/api/")) return "/api";
  return "";
};

const getResourceKeyFromPath = (path: string): string => {
  const normalizedPath = path.startsWith("/api/v1/")
    ? path.replace("/api/v1", "")
    : path.startsWith("/api/")
      ? path.replace("/api", "")
      : path;
  const [segment] = normalizedPath.split("/").filter(Boolean);
  return segment || "root";
};

const buildPathFallbacks = (path: string): string[] => {
  const resourceKey = getResourceKeyFromPath(path);
  const preferredPrefix = preferredPrefixByResource[resourceKey];

  if (preferredPrefix !== undefined) {
    const preferredPath = applyPrefix(path, preferredPrefix);
    const rest = ["", "/api", "/api/v1"]
      .filter((p): p is "" | "/api" | "/api/v1" => p !== preferredPrefix)
      .map((p) => applyPrefix(path, p));
    return [preferredPath, ...rest];
  }

  if (path.startsWith("/api/v1/")) {
    return [path, path.replace("/api/v1", ""), path.replace("/api/v1", "/api")];
  }

  if (path.startsWith("/api/")) {
    return [path, path.replace("/api", ""), `/api/v1${path.slice(4)}`];
  }

  return [path, `/api${path}`, `/api/v1${path}`];
};

const apiRequestWith404Fallback = async <T>(
  baseUrl: string,
  path: string,
  options?: RequestInit,
  token?: string,
): Promise<T> => {
  const candidates = buildPathFallbacks(path);
  const resourceKey = getResourceKeyFromPath(path);
  let lastError: unknown;
  let exhausted404Fallback = false;

  for (let i = 0; i < candidates.length; i += 1) {
    try {
      const result = await apiRequest<T>(baseUrl, candidates[i], options, token, { suppress: true });
      preferredPrefixByResource[resourceKey] = getPrefixFromPath(candidates[i]);
      if (mutationMethods.has(getMethod(options))) {
        publishToast({ type: "success", title: getSuccessMessage(getMethod(options), candidates[i]) });
      }
      return result;
    } catch (err) {
      lastError = err;
      const is404 = err instanceof Error && err.message.includes("(404)");
      const hasMore = i < candidates.length - 1;
      if (!is404) {
        throw err;
      }
      if (!hasMore) {
        exhausted404Fallback = true;
      }
    }
  }

  if (exhausted404Fallback) {
    publishToast({
      type: "error",
      title: "API failed",
      message: `Endpoint not available on backend for path ${path}.`,
    });
    throw new Error(
      `Endpoint not available on backend for path ${path}. Please restart the backend from NeedMap-AI/backend or deploy a backend build that exposes this route.`,
    );
  }

  publishToast({ type: "error", title: "API failed", message: getErrorMessage(lastError) });
  throw lastError instanceof Error ? lastError : new Error("Request failed");
};

export const authApi = {
  signup: (baseUrl: string, body: { user_name: string; email: string; password: string; role: string; phone?: string }) =>
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

  ingestUploadFile: (
    baseUrl: string,
    token: string,
    body: {
      source_type: "image" | "voice_note" | "document" | "csv_upload" | "web_form";
      file: { uri: string; name: string; type: string; file?: Blob };
      organization_id: number;
      latitude?: number;
      longitude?: number;
      address?: string;
      create_need?: boolean;
    },
  ) => {
    const form = new FormData();
    form.append("source_type", body.source_type);
    form.append("organization_id", String(body.organization_id));
    form.append("latitude", String(body.latitude ?? 0));
    form.append("longitude", String(body.longitude ?? 0));
    form.append("address", body.address ?? "");
    form.append("create_need", String(body.create_need ?? true));
    const webFile = body.file.file;
    if (typeof Blob !== "undefined" && webFile instanceof Blob) {
      form.append("file", webFile, body.file.name);
    } else {
      form.append("file", body.file as unknown as Blob);
    }

    return apiRequestWith404Fallback<{
      category: string;
      urgency: string;
      location: string | null;
      description: string;
      skills_required: string[];
      affected_count: number | null;
      confidence: number;
      model_used: string;
      need_id: number | null;
      source_id: number | null;
      raw_text: string;
    }>(
      baseUrl,
      "/needs/ingest/upload",
      { method: "POST", body: form },
      token,
    );
  },

  addNeedSourceUpload: (
    baseUrl: string,
    token: string,
    needId: number,
    body: {
      source_type: "image" | "voice_note" | "document" | "csv_upload" | "web_form" | "paper_survey";
      file: { uri: string; name: string; type: string; file?: Blob };
      location?: string;
    },
  ) => {
    const form = new FormData();
    form.append("source_type", body.source_type);
    if (body.location) {
      form.append("location", body.location);
    }
    const webFile = body.file.file;
    if (typeof Blob !== "undefined" && webFile instanceof Blob) {
      form.append("file", webFile, body.file.name);
    } else {
      form.append("file", body.file as unknown as Blob);
    }

    return apiRequestWith404Fallback<NeedSource>(
      baseUrl,
      `/needs/${needId}/sources/upload`,
      { method: "POST", body: form },
      token,
    );
  },

  volunteers: (baseUrl: string, token: string) => {
    if (isBypassToken(token)) {
      const mockVolunteers: Volunteer[] = [
        { id: 1, user_id: 9999, organization_id: 1, availability: true, verified: true, rating: 4.6, tasks_completed: 8, active_tasks: 1 },
      ];
      return Promise.resolve(mockVolunteers);
    }
    return apiRequest<Volunteer[]>(baseUrl, "/volunteers", { method: "GET" }, token);
  },

  myVolunteerProfile: (baseUrl: string, token: string) =>
    apiRequestWith404Fallback<Volunteer>(baseUrl, "/volunteers/me", { method: "GET" }, token),

  updateVolunteer: (
    baseUrl: string,
    token: string,
    volunteerId: number,
    body: { organization_id?: number | null; availability?: boolean; verified?: boolean; rating?: number },
  ) =>
    apiRequest<Volunteer>(
      baseUrl,
      `/volunteers/${volunteerId}`,
      { method: "PATCH", body: JSON.stringify(body) },
      token,
    ),

  addVolunteerSkill: (
    baseUrl: string,
    token: string,
    volunteerId: number,
    body: { skill_name: string; proficiency: VolunteerSkill["proficiency"] },
  ) =>
    apiRequest<VolunteerSkill>(
      baseUrl,
      `/volunteers/${volunteerId}/skills`,
      { method: "POST", body: JSON.stringify(body) },
      token,
    ),

  updateVolunteerSkill: (
    baseUrl: string,
    token: string,
    volunteerId: number,
    skillId: number,
    body: { proficiency: VolunteerSkill["proficiency"] },
  ) =>
    apiRequest<VolunteerSkill>(
      baseUrl,
      `/volunteers/${volunteerId}/skills/${skillId}`,
      { method: "PATCH", body: JSON.stringify(body) },
      token,
    ),

  deleteVolunteerSkill: (baseUrl: string, token: string, volunteerId: number, skillId: number) =>
    apiRequest<{ message: string }>(
      baseUrl,
      `/volunteers/${volunteerId}/skills/${skillId}`,
      { method: "DELETE" },
      token,
    ),

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

  getOrganization: (baseUrl: string, token: string, orgId: number) =>
    apiRequest<Organization>(baseUrl, `/organizations/${orgId}`, { method: "GET" }, token),

  addOrganizationMember: (
    baseUrl: string,
    token: string,
    organizationId: number,
    body: {
      user_name: string;
      email: string;
      password: string;
      role: "admin" | "volunteer";
      managed_branch_id?: number;
      phone?: string;
    },
  ) =>
    apiRequestWith404Fallback<AuthUser>(
      baseUrl,
      `/organizations/${organizationId}/members`,
      { method: "POST", body: JSON.stringify(body) },
      token,
    ),

  organizationMembers: (baseUrl: string, token: string, organizationId: number) =>
    apiRequestWith404Fallback<AuthUser[]>(
      baseUrl,
      `/organizations/${organizationId}/members`,
      { method: "GET" },
      token,
    ),

  organizationBranches: (baseUrl: string, token: string, organizationId: number) =>
    apiRequestWith404Fallback<Organization[]>(
      baseUrl,
      `/organizations/${organizationId}/branches`,
      { method: "GET" },
      token,
    ),

  createOrganizationBranch: (
    baseUrl: string,
    token: string,
    organizationId: number,
    body: {
      organization_name: string;
      branch_location: string;
      address?: string;
      phone?: string;
    },
  ) =>
    apiRequestWith404Fallback<Organization>(
      baseUrl,
      `/organizations/${organizationId}/branches`,
      { method: "POST", body: JSON.stringify(body) },
      token,
    ),

  deactivateOrganizationMember: (
    baseUrl: string,
    token: string,
    organizationId: number,
    memberId: number,
  ) =>
    apiRequestWith404Fallback<{ message: string }>(
      baseUrl,
      `/organizations/${organizationId}/members/${memberId}`,
      { method: "DELETE" },
      token,
    ),

  deactivateOrganization: (baseUrl: string, token: string, organizationId: number) =>
    apiRequestWith404Fallback<{ message: string }>(
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
