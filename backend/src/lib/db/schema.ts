import { Prisma } from "@prisma/client";

export type User = {
  id: number;
  name?: string | null;
  email: string;
  password_hash: string;
  role: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
};

export type Team = {
  id: number;
  name: string;
  created_at: Date;
  updated_at: Date;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_product_id?: string | null;
  plan_name?: string | null;
  subscription_status?: string | null;
};

export type TeamMember = {
  id: number;
  user_id: number;
  team_id: number;
  role: string;
  joined_at: Date;
};

export type Invitation = {
  id: number;
  team_id: number;
  email: string;
  role: string;
  invited_by: number;
  invited_at: Date;
  status: string;
};

export type ActivityLog = {
  id: number;
  team_id: number;
  user_id?: number | null;
  action: string;
  timestamp: Date;
  ip_address?: string | null;
};

export enum ActivityType {
  SIGN_IN = "sign_in",
  SIGN_UP = "sign_up",
  SIGN_OUT = "sign_out",
  CREATE_TEAM = "create_team",
  UPDATE_TEAM = "update_team",
  DELETE_TEAM = "delete_team",
  INVITE_MEMBER = "invite_member",
  ACCEPT_INVITATION = "accept_invitation",
  REMOVE_MEMBER = "remove_member",
}

// Prismaの型定義を再エクスポート
export type UserCreateInput = Prisma.usersCreateInput;
export type TeamCreateInput = Prisma.teamsCreateInput;
export type TeamMemberCreateInput = Prisma.team_membersCreateInput;
export type InvitationCreateInput = Prisma.invitationsCreateInput;
export type ActivityLogCreateInput = Prisma.activity_logsCreateInput;
