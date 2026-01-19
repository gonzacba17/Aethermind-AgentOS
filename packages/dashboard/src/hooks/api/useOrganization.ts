import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

// Mock data
const MOCK_ORG: Organization = {
  id: 'org-1',
  name: 'Acme Corporation',
  slug: 'acme-corp',
  plan: 'pro',
  createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  memberCount: 5,
  agentCount: 12,
  monthlyBudget: 500,
  currentSpend: 245.50,
};

const MOCK_MEMBERS: OrganizationMember[] = [
  {
    id: 'member-1',
    userId: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'owner',
    joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date().toISOString(),
  },
  {
    id: 'member-2',
    userId: 'user-2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'admin',
    joinedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'member-3',
    userId: 'user-3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'member',
    joinedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 86400000).toISOString(),
  },
];

const MOCK_INVITATIONS: Invitation[] = [
  {
    id: 'inv-1',
    email: 'newmember@example.com',
    role: 'member',
    invitedBy: 'John Doe',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  },
];

/**
 * Hook to get current organization
 */
export function useOrganization() {
  return useQuery({
    queryKey: organizationKeys.detail('current'),
    queryFn: async (): Promise<Organization> => {
      await new Promise(r => setTimeout(r, 300));
      return MOCK_ORG;
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
      await new Promise(r => setTimeout(r, 300));
      return [MOCK_ORG];
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
      await new Promise(r => setTimeout(r, 300));
      return MOCK_MEMBERS;
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
      await new Promise(r => setTimeout(r, 300));
      return MOCK_INVITATIONS;
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
      await new Promise(r => setTimeout(r, 500));
      return {
        id: `org-${Date.now()}`,
        name: data.name,
        slug: data.name.toLowerCase().replace(/\s+/g, '-'),
        plan: 'free',
        createdAt: new Date().toISOString(),
        memberCount: 1,
        agentCount: 0,
        currentSpend: 0,
      };
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
      await new Promise(r => setTimeout(r, 500));
      return { ...MOCK_ORG, ...data };
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
      await new Promise(r => setTimeout(r, 500));
      return {
        id: `inv-${Date.now()}`,
        email: data.email,
        role: data.role,
        invitedBy: 'Current User',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      };
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
      await new Promise(r => setTimeout(r, 500));
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
      await new Promise(r => setTimeout(r, 500));
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
      await new Promise(r => setTimeout(r, 500));
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
