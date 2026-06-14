export type AuthUser = {
  id: number;
  user_name: string;
  email: string;
  role: string;
  phone: string | null;
  organization_id: number | null;
  managed_branch_id?: number | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type OrganizationRegisterResponse = {
  organization: Organization;
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type Need = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  urgency: string;
  status: string;
  organization_id: number;
  latitude: number;
  longitude: number;
  address: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  created_at: string;
};

export type NeedSource = {
  id: number;
  need_id: number;
  source_type: string;
  location: string | null;
  multimedia_txt: string | null;
  ai_extraction: string | null;
  processed_at: string | null;
  created_at: string;
};

export type Volunteer = {
  id: number;
  user_id: number;
  organization_id: number | null;
  availability: boolean;
  verified: boolean;
  tasks_completed: number;
  active_tasks: number;
};

export type Organization = {
  id: number;
  parent_organization_id?: number | null;
  organization_name: string;
  branch_location?: string | null;
  is_branch?: boolean;
  address: string | null;
  phone: string | null;
  user_id: number;
  is_active: boolean;
  created_at: string;
};

export type Assignment = {
  id: number;
  need_id: number;
  volunteer_id: number;
  organization_id: number;
  status: "proposed" | "accepted" | "declined" | "in_progress" | "completed" | "cancelled";
  match_score: number | null;
  assigned_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  feedback: string | null;
  rating: number | null;
};
