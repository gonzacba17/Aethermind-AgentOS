"use client"

import { useState } from "react"
import { 
  Building2, Users, Mail, Crown, Shield, Eye, UserMinus, MoreVertical,
  Plus, Copy, RefreshCw, Loader2, Settings, X, ChevronDown
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { 
  useOrganization, 
  useOrganizationMembers, 
  useOrganizationInvitations,
  useInviteMember,
  useRemoveMember,
  useCancelInvitation,
  getRoleColor,
  OrganizationMember
} from "@/hooks/api/useOrganization"
import { Skeleton } from "@/components/ui/skeleton"

const ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access except billing', icon: Shield },
  { value: 'member', label: 'Member', description: 'Create and manage agents', icon: Users },
  { value: 'viewer', label: 'Viewer', description: 'View-only access', icon: Eye },
]

export default function OrganizationPage() {
  const { toast } = useToast()
  
  // State
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isRemoveOpen, setIsRemoveOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  
  // Data fetching
  const { data: org, isLoading: orgLoading, refetch } = useOrganization()
  const { data: members, isLoading: membersLoading } = useOrganizationMembers(org?.id || '')
  const { data: invitations } = useOrganizationInvitations(org?.id || '')
  
  // Mutations
  const inviteMember = useInviteMember()
  const removeMember = useRemoveMember()
  const cancelInvitation = useCancelInvitation()
  
  // Handlers
  const handleInvite = async () => {
    if (!org || !inviteEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter an email address",
        variant: "destructive",
      })
      return
    }
    
    try {
      await inviteMember.mutateAsync({
        orgId: org.id,
        email: inviteEmail,
        role: inviteRole,
      })
      setIsInviteOpen(false)
      setInviteEmail('')
      setInviteRole('member')
      toast({
        title: "Invitation Sent",
        description: `An invitation has been sent to ${inviteEmail}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive",
      })
    }
  }
  
  const handleRemove = async () => {
    if (!org || !memberToRemove) return
    
    try {
      await removeMember.mutateAsync({
        orgId: org.id,
        memberId: memberToRemove.id,
      })
      setIsRemoveOpen(false)
      setMemberToRemove(null)
      toast({
        title: "Member Removed",
        description: `${memberToRemove.name} has been removed from the organization`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      })
    }
  }
  
  const handleCancelInvite = async (invitationId: string, email: string) => {
    if (!org) return
    
    try {
      await cancelInvitation.mutateAsync({
        orgId: org.id,
        invitationId,
      })
      toast({
        title: "Invitation Cancelled",
        description: `Invitation to ${email} has been cancelled`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      })
    }
  }
  
  const confirmRemove = (member: OrganizationMember) => {
    setMemberToRemove(member)
    setIsRemoveOpen(true)
  }
  
  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${org?.slug}`)
    toast({
      title: "Copied",
      description: "Invite link copied to clipboard",
    })
  }
  
  const getRoleIcon = (role: string) => {
    if (role === 'owner') return Crown
    if (role === 'admin') return Shield
    if (role === 'viewer') return Eye
    return Users
  }

  if (orgLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-lg">No Organization</h3>
        <p className="text-muted-foreground">You don't belong to any organization yet.</p>
        <Button className="mt-4">Create Organization</Button>
      </div>
    )
  }

  const budgetPercent = org.monthlyBudget 
    ? (org.currentSpend / org.monthlyBudget) * 100 
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10">
            <Building2 className="h-6 w-6 text-violet-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
              <Badge variant="outline" className="capitalize">{org.plan}</Badge>
            </div>
            <p className="text-muted-foreground">Manage your organization and team</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => setIsInviteOpen(true)}>
            <Plus className="h-4 w-4" />
            Invite Member
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Members</p>
                <p className="text-2xl font-bold">{org.memberCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agents</p>
                <p className="text-2xl font-bold">{org.agentCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Settings className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Monthly Spend</p>
                <p className="text-sm font-medium">
                  ${org.currentSpend.toFixed(2)} / ${org.monthlyBudget || '∞'}
                </p>
              </div>
              {org.monthlyBudget && (
                <Progress value={budgetPercent} className="h-2" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">
            Members ({members?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="invitations">
            Invitations ({invitations?.filter(i => i.status === 'pending').length || 0})
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>People who have access to this organization</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={copyInviteLink} className="gap-2">
                <Copy className="h-4 w-4" />
                Copy Invite Link
              </Button>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {members?.map((member) => {
                    const roleColor = getRoleColor(member.role)
                    const RoleIcon = getRoleIcon(member.role)
                    
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback>
                              {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{member.name}</h4>
                              <Badge 
                                variant="outline" 
                                className={`text-xs capitalize ${roleColor.bg} ${roleColor.text} ${roleColor.border}`}
                              >
                                <RoleIcon className="h-3 w-3 mr-1" />
                                {member.role}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm text-muted-foreground">
                              {member.lastActive 
                                ? `Active ${new Date(member.lastActive).toLocaleDateString()}`
                                : 'Never active'
                              }
                            </p>
                          </div>
                          {member.role !== 'owner' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => toast({ title: "Coming Soon" })}>
                                  Change Role
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-red-500 focus:text-red-500"
                                  onClick={() => confirmRemove(member)}
                                >
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations">
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>Invitations that haven't been accepted yet</CardDescription>
            </CardHeader>
            <CardContent>
              {!invitations || invitations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending invitations</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {invitations.filter(i => i.status === 'pending').map((invitation) => {
                    const roleColor = getRoleColor(invitation.role as any)
                    
                    return (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-amber-500/10">
                            <Mail className="h-5 w-5 text-amber-500" />
                          </div>
                          <div>
                            <p className="font-medium">{invitation.email}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>Invited by {invitation.invitedBy}</span>
                              <span>•</span>
                              <Badge 
                                variant="outline" 
                                className={`text-xs capitalize ${roleColor.bg} ${roleColor.text}`}
                              >
                                {invitation.role}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-muted-foreground">
                              Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCancelInvite(invitation.id, invitation.email)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
              <CardDescription>Manage organization details and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input value={org.name} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={org.slug} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <div className="flex items-center gap-2">
                    <Input value={org.plan} disabled className="capitalize" />
                    <Button variant="outline">Upgrade</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Monthly Budget</Label>
                  <Input 
                    type="number" 
                    value={org.monthlyBudget || ''} 
                    placeholder="No limit"
                    disabled 
                  />
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <h4 className="font-medium text-destructive mb-2">Danger Zone</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Deleting this organization will remove all agents, traces, and data permanently.
                </p>
                <Button variant="destructive" disabled>
                  Delete Organization
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join {org.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input 
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="space-y-2">
                {ROLES.map(role => {
                  const isSelected = inviteRole === role.value
                  const Icon = role.icon
                  return (
                    <button
                      key={role.value}
                      onClick={() => setInviteRole(role.value as any)}
                      className={`w-full p-3 rounded-lg border text-left transition-colors flex items-center gap-3 ${
                        isSelected 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <p className="font-medium">{role.label}</p>
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviteMember.isPending}>
              {inviteMember.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={isRemoveOpen} onOpenChange={setIsRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.name} from this organization? 
              They will lose access to all resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMemberToRemove(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMember.isPending}
            >
              {removeMember.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
