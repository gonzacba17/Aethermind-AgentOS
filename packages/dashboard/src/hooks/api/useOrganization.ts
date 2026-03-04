import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

/**
 * Organization and Team interfaces
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  memberCount: number;
  agentCount: number;
  monthlyBudget?: number;
  currentSpend: number;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  avatar?: string;
  joinedAt: string;
  lastActive?: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: OrganizationMember['role'];
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired';
}

export interface CreateOrganizationData {
  name: string;
}

export interface InviteMemberData {
  email: string;
  role: OrganizationMember['role'];
}

/**
 * Query keys
 */
export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  detail: (id: string) => [...organizationKeys.all, 'detail', id] as const,
  members: (id: string) => [...organizationKeys.detail(id), 'members'] as const,
  invitations: (id: string) => [...organizationKeys.detail(id), 'invitations'] as const,
};

/**
 * Hook to get current organization
 */
export function useOrganization() {
  return useQuery({
    queryKey: organizationKeys.detail('current'),
    queryFn: async (): Promise<Organization> => {
      return await apiRequest<Organization>('/api/organizations/current');
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to list all organizations for user
 */
export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.lists(),
    queryFn: async (): Promise<Organization[]> => {
      return await apiRequest<Organization[]>('/api/organizations');
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get organization members
 */
export function useOrganizationMembers(orgId: string) {
  return useQuery({
    queryKey: organizationKeys.members(orgId),
    queryFn: async (): Promise<OrganizationMember[]> => {
      return await apiRequest<OrganizationMember[]>(`/api/organizations/${orgId}/members`);
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to get pending invitations
 */
export function useOrganizationInvitations(orgId: string) {
  return useQuery({
    queryKey: organizationKeys.invitations(orgId),
    queryFn: async (): Promise<Invitation[]> => {
      return await apiRequest<Invitation[]>(`/api/organizations/${orgId}/invitations`);
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to create organization
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOrganizationData): Promise<Organization> => {
      return apiRequest<Organization>('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
    },
  });
}

/**
 * Hook to update organization
 */
export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Organization> & { id: string }): Promise<Organization> => {
      return apiRequest<Organization>(`/api/organizations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(data.id) });
    },
  });
}

/**
 * Hook to invite member
 */
export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, ...data }: InviteMemberData & { orgId: string }): Promise<Invitation> => {
      return apiRequest<Invitation>(`/api/organizations/${orgId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.invitations(variables.orgId) });
    },
  });
}

/**
 * Hook to remove member
 */
export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, memberId }: { orgId: string; memberId: string }): Promise<void> => {
      await apiRequest(`/api/organizations/${orgId}/members/${memberId}`, { method: 'DELETE' });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(variables.orgId) });
    },
  });
}

/**
 * Hook to update member role
 */
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, memberId, role }: { orgId: string; memberId: string; role: OrganizationMember['role'] }): Promise<void> => {
      await apiRequest(`/api/organizations/${orgId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(variables.orgId) });
    },
  });
}

/**
 * Hook to cancel invitation
 */
export function useCancelInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, invitationId }: { orgId: string; invitationId: string }): Promise<void> => {
      await apiRequest(`/api/organizations/${orgId}/invitations/${invitationId}`, { method: 'DELETE' });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.invitations(variables.orgId) });
    },
  });
}

/**
 * Helper to get role badge color
 */
export function getRoleColor(role: OrganizationMember['role']) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    owner: { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/20' },
    admin: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
    member: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
    viewer: { bg: 'bg-gray-500/10', text: 'text-gray-500', border: 'border-gray-500/20' },
  };
  return colors[role] || colors.viewer;
}
