import {
  CalendarDays,
  Crown,
  Mail,
  Plus,
  Shield,
  SquarePen,
  Trash2,
  User,
} from "lucide-solid";
import type { Component } from "solid-js";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { ProgramBuilderDialog } from "@/components/groups/ProgramBuilderDialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useGroupsDialog } from "@/contexts/GroupsDialogContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentTuneSet } from "@/lib/context/CurrentTuneSetContext";
import {
  addGroupMember,
  createGroup,
  type GroupMemberCandidate,
  type GroupMemberWithProfile,
  getGroupMembers,
  getVisibleGroups,
  removeGroupMember,
  searchGroupMemberCandidates,
  updateGroupMemberRole,
} from "@/lib/db/queries/groups";
import {
  deleteProgram,
  getVisiblePrograms,
  type ProgramWithSummary,
} from "@/lib/db/queries/programs";

interface GroupsManagerDialogProps {
  isOpen?: boolean;
  onClose?: () => void;
  routeMode?: boolean;
}

interface GroupDialogProps {
  isOpen: boolean;
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string }) => void;
}

const roleBadgeClass = (role: string | null) => {
  switch (role) {
    case "owner":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200";
    case "admin":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
};

const GroupDialog: Component<GroupDialogProps> = (props) => {
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");

  createEffect(() => {
    if (!props.isOpen) {
      setName("");
      setDescription("");
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !props.isSaving) {
        props.onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={props.isOpen}>
      <button
        type="button"
        class="fixed inset-0 z-[60] bg-black/50 dark:bg-black/70"
        onClick={props.onClose}
        data-testid="group-dialog-backdrop"
      />

      <div
        class="fixed left-1/2 top-1/2 z-[70] w-[95vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-dialog-title"
        data-testid="group-dialog"
      >
        <header class="flex justify-between items-center w-full mb-4">
          <div class="flex flex-1 justify-start">
            <Button
              type="button"
              onClick={props.onClose}
              disabled={props.isSaving}
              variant="outline"
              data-testid="cancel-group-button"
            >
              Cancel
            </Button>
          </div>
          <div class="flex min-w-0 flex-1 justify-center px-3">
            <h2
              id="group-dialog-title"
              class="text-center text-xl font-semibold text-gray-900 dark:text-white"
            >
              Create Group
            </h2>
          </div>
          <div class="flex flex-1 justify-end">
            <Button
              type="button"
              onClick={() =>
                props.onSubmit({
                  name: name(),
                  description: description(),
                })
              }
              disabled={props.isSaving}
              variant="default"
              data-testid="save-group-button"
            >
              <Show
                when={props.isSaving}
                fallback={
                  <>
                    <Plus class="h-4 w-4" />
                    Create
                  </>
                }
              >
                Creating...
              </Show>
            </Button>
          </div>
        </header>

        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Create a group space for shared membership and group-owned programs.
        </p>

        <div class="space-y-4">
          <div class="space-y-2">
            <label
              for="group-name"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Group Name
            </label>
            <input
              id="group-name"
              type="text"
              value={name()}
              onInput={(event) => setName(event.currentTarget.value)}
              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="Thursday session band"
              data-testid="group-name-input"
            />
          </div>

          <div class="space-y-2">
            <label
              for="group-description"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Description
            </label>
            <textarea
              id="group-description"
              value={description()}
              onInput={(event) => setDescription(event.currentTarget.value)}
              class="min-h-28 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="Optional notes about who this group is for"
              data-testid="group-description-input"
            />
          </div>

          <Show when={props.error}>
            <p class="text-sm text-red-600 dark:text-red-400">{props.error}</p>
          </Show>
        </div>
      </div>
    </Show>
  );
};

const formatMemberDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const getMemberDisplayName = (member: GroupMemberWithProfile) =>
  member.profileName ?? member.profileEmail ?? "Unknown member";

const MemberInfoDialog: Component<{
  member: GroupMemberWithProfile | null;
  isOpen: boolean;
  onClose: () => void;
}> = (props) => {
  return (
    <AlertDialog
      open={props.isOpen}
      onOpenChange={(open) => !open && props.onClose()}
    >
      <AlertDialogContent class="max-w-md bg-white dark:bg-gray-900">
        <header class="flex justify-between items-center w-full mb-4">
          <div class="flex flex-1 justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={props.onClose}
            >
              Back
            </Button>
          </div>
          <div class="flex min-w-0 flex-1 justify-center px-3">
            <AlertDialogTitle class="text-center">
              Member Details
            </AlertDialogTitle>
          </div>
          <div class="flex flex-1 justify-end" />
        </header>

        <Show when={props.member}>
          {(member) => (
            <div class="space-y-4">
              <AlertDialogDescription>
                Profile information currently available for this group member.
              </AlertDialogDescription>

              <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                <div class="text-lg font-semibold text-gray-900 dark:text-white">
                  {getMemberDisplayName(member())}
                </div>
                <div class="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <Show
                    when={member().effectiveRole === "owner"}
                    fallback={null}
                  >
                    <Crown size={12} />
                  </Show>
                  {member().effectiveRole}
                </div>
              </div>

              <div class="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <div class="flex items-start gap-3">
                  <Mail size={16} class="mt-0.5 text-gray-400" />
                  <div>
                    <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Email
                    </div>
                    <div>{member().profileEmail ?? "No email available"}</div>
                  </div>
                </div>

                <div class="flex items-start gap-3">
                  <User size={16} class="mt-0.5 text-gray-400" />
                  <div>
                    <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      User ID
                    </div>
                    <div class="break-all">{member().userRef}</div>
                  </div>
                </div>

                <div class="flex items-start gap-3">
                  <CalendarDays size={16} class="mt-0.5 text-gray-400" />
                  <div>
                    <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Joined
                    </div>
                    <div>{formatMemberDate(member().joinedAt)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Show>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const ManageableGroupMemberRow: Component<{
  member: GroupMemberWithProfile;
  canManage: boolean;
  isBusy: boolean;
  onRoleChange: (role: "admin" | "member") => void;
  onRemove: () => void;
  onShowInfo: () => void;
}> = (props) => {
  return (
    <div class="rounded-lg border border-gray-200 px-4 py-4 dark:border-gray-700">
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={props.onShowInfo}
          class="min-w-0 truncate text-left text-base font-medium leading-tight text-gray-900 hover:underline dark:text-white"
          data-testid="group-member-name-button"
        >
          {getMemberDisplayName(props.member)}
        </button>

        <Show
          when={props.canManage && !props.member.isOwner}
          fallback={
            <span
              class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize shrink-0 ${roleBadgeClass(props.member.effectiveRole)}`}
            >
              <Show
                when={props.member.effectiveRole === "owner"}
                fallback={null}
              >
                <Crown size={12} />
              </Show>
              {props.member.effectiveRole}
            </span>
          }
        >
          <div class="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              onClick={() =>
                props.onRoleChange(
                  props.member.role === "admin" ? "member" : "admin"
                )
              }
              disabled={props.isBusy}
              variant="outline"
              size="icon"
              class="h-9 w-9"
              data-testid="group-member-role-select"
              title={
                props.member.role === "admin"
                  ? "Change to member"
                  : "Change to admin"
              }
              aria-label={
                props.member.role === "admin"
                  ? "Change to member"
                  : "Change to admin"
              }
            >
              <Show
                when={props.member.role === "admin"}
                fallback={<User size={16} />}
              >
                <Shield size={16} />
              </Show>
            </Button>
            <Button
              type="button"
              onClick={props.onRemove}
              disabled={props.isBusy}
              variant="ghost"
              size="icon"
              class="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
              data-testid="remove-group-member-button"
              title="Remove member"
              aria-label="Remove member"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </Show>
      </div>
    </div>
  );
};

const GroupMemberCandidateRow: Component<{
  candidate: GroupMemberCandidate;
  isAdding: boolean;
  onAdd: (candidate: GroupMemberCandidate) => void;
}> = (props) => {
  return (
    <div class="relative rounded-lg border border-gray-200 px-4 py-4 dark:border-gray-700">
      <div class="min-w-0 pr-16">
        <div class="text-base font-medium leading-tight text-gray-900 dark:text-white">
          {props.candidate.profileName ??
            props.candidate.profileEmail ??
            "Unknown member"}
        </div>
        <div class="mt-2 truncate text-sm text-gray-400 dark:text-gray-400">
          {props.candidate.profileEmail ?? "No email available"}
        </div>
      </div>

      <Show
        when={props.candidate.canAdd}
        fallback={
          <div class="absolute right-4 top-4">
            <span
              class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${roleBadgeClass(props.candidate.effectiveRole)}`}
            >
              <Show when={props.candidate.isOwner} fallback={null}>
                <Crown size={12} />
              </Show>
              {props.candidate.isOwner
                ? "owner"
                : `already ${props.candidate.effectiveRole}`}
            </span>
          </div>
        }
      >
        <div class="absolute right-4 top-4 flex items-center gap-2">
          <Button
            type="button"
            onClick={() => props.onAdd(props.candidate)}
            disabled={props.isAdding}
            variant="default"
            size="icon"
            class="h-9 w-9"
            data-testid="add-group-member-button"
            title="Add member"
            aria-label="Add member"
          >
            <Plus size={16} />
          </Button>
        </div>
      </Show>
    </div>
  );
};

const GroupsManagerContent: Component<{ onClose: () => void }> = (props) => {
  const { user, localDb } = useAuth();
  const { tuneSetListChanged, incrementTuneSetListChanged } =
    useCurrentTuneSet();
  const [groupListVersion, setGroupListVersion] = createSignal(0);
  const [selectedGroupId, setSelectedGroupId] = createSignal<string | null>(
    null
  );
  const [showCreateGroupDialog, setShowCreateGroupDialog] = createSignal(false);
  const [groupDialogError, setGroupDialogError] = createSignal<string | null>(
    null
  );
  const [isCreatingGroup, setIsCreatingGroup] = createSignal(false);
  const [showProgramEditor, setShowProgramEditor] = createSignal(false);
  const [editingProgramId, setEditingProgramId] = createSignal<
    string | undefined
  >(undefined);
  const [programDialogMode, setProgramDialogMode] = createSignal<
    "view" | "edit"
  >("edit");
  const [deletingProgramId, setDeletingProgramId] = createSignal<string | null>(
    null
  );
  const [memberSearchTerm, setMemberSearchTerm] = createSignal("");
  const [isAddingMember, setIsAddingMember] = createSignal(false);
  const [busyMembershipId, setBusyMembershipId] = createSignal<string | null>(
    null
  );
  const [selectedMemberInfo, setSelectedMemberInfo] =
    createSignal<GroupMemberWithProfile | null>(null);

  const [groups] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = groupListVersion();
      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      if (!params) {
        return [];
      }

      return getVisibleGroups(params.db, params.userId);
    }
  );

  const selectedGroup = createMemo(() => {
    const currentId = selectedGroupId();
    return (groups() ?? []).find((group) => group.id === currentId) ?? null;
  });

  createEffect(() => {
    const visibleGroups = groups() ?? [];
    const currentId = selectedGroupId();

    if (visibleGroups.length === 0) {
      if (currentId !== null) {
        setSelectedGroupId(null);
      }
      return;
    }

    if (!currentId || !visibleGroups.some((group) => group.id === currentId)) {
      setSelectedGroupId(visibleGroups[0].id);
    }
  });

  const [groupMembers] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const groupId = selectedGroupId();
      const version = groupListVersion();
      return db && userId && groupId ? { db, userId, groupId, version } : null;
    },
    async (params) => {
      if (!params) {
        return [];
      }

      return getGroupMembers(params.db, params.groupId, params.userId);
    }
  );

  const [groupPrograms, { refetch: refetchGroupPrograms }] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const groupId = selectedGroupId();
      const version = tuneSetListChanged();
      return db && userId && groupId ? { db, userId, groupId, version } : null;
    },
    async (params) => {
      if (!params) {
        return [];
      }

      return getVisiblePrograms(params.db, params.userId, {
        groupId: params.groupId,
      });
    }
  );

  const visibleGroupPrograms = createMemo(
    () => groupPrograms.latest ?? groupPrograms() ?? []
  );

  const [memberCandidates] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const groupId = selectedGroupId();
      const searchTerm = memberSearchTerm();
      const version = groupListVersion();
      return db && userId && groupId
        ? { db, userId, groupId, searchTerm, version }
        : null;
    },
    async (params) => {
      if (!params) {
        return [];
      }

      return searchGroupMemberCandidates(
        params.db,
        params.groupId,
        params.userId,
        params.searchTerm
      );
    }
  );

  const handleCreateGroup = async (data: {
    name: string;
    description: string;
  }) => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) {
      setGroupDialogError("Database is not ready yet.");
      return;
    }

    try {
      setIsCreatingGroup(true);
      setGroupDialogError(null);
      const created = await createGroup(db, userId, data);
      setGroupListVersion((value) => value + 1);
      setSelectedGroupId(created.id);
      setShowCreateGroupDialog(false);
      toast.success(`Created group "${created.name}".`, { duration: 2500 });
    } catch (error) {
      setGroupDialogError(
        error instanceof Error ? error.message : "Failed to create group"
      );
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleOpenNewProgram = () => {
    setProgramDialogMode("edit");
    setEditingProgramId(undefined);
    setShowProgramEditor(true);
  };

  const handleOpenExistingProgram = (program: ProgramWithSummary) => {
    setProgramDialogMode("edit");
    setEditingProgramId(program.id);
    setShowProgramEditor(true);
  };

  const handleOpenProgramDetails = (program: ProgramWithSummary) => {
    setProgramDialogMode("view");
    setEditingProgramId(program.id);
    setShowProgramEditor(true);
  };

  const handleDeleteProgram = async (programRow: ProgramWithSummary) => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) {
      toast.error("Database is not ready yet.");
      return;
    }

    const confirmed = window.confirm(
      `Delete the program "${programRow.name}"?`
    );
    if (!confirmed) {
      return;
    }

    try {
      setDeletingProgramId(programRow.id);
      await deleteProgram(db, programRow.id, userId);
      incrementTuneSetListChanged();
      void refetchGroupPrograms();
      toast.success(`Deleted program "${programRow.name}".`, {
        duration: 2500,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete program"
      );
    } finally {
      setDeletingProgramId(null);
    }
  };

  const handleAddMember = async (candidate: GroupMemberCandidate) => {
    const db = localDb();
    const userId = user()?.id;
    const groupId = selectedGroupId();
    if (!db || !userId || !groupId) {
      toast.error("Database is not ready yet.");
      return;
    }

    try {
      setIsAddingMember(true);
      await addGroupMember(db, groupId, userId, candidate.userRef, "member", {
        profileName: candidate.profileName,
        profileEmail: candidate.profileEmail,
      });
      setGroupListVersion((value) => value + 1);
      toast.success("Added group member.", { duration: 2500 });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add group member"
      );
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleUpdateMemberRole = async (
    member: GroupMemberWithProfile,
    role: "admin" | "member"
  ) => {
    const db = localDb();
    const userId = user()?.id;
    const groupId = selectedGroupId();
    if (!db || !userId || !groupId || !member.membershipId) {
      return;
    }
    if (member.role === role) {
      return;
    }

    try {
      setBusyMembershipId(member.membershipId);
      await updateGroupMemberRole(
        db,
        groupId,
        member.membershipId,
        userId,
        role
      );
      setGroupListVersion((value) => value + 1);
      toast.success("Updated member role.", { duration: 2500 });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update member role"
      );
    } finally {
      setBusyMembershipId(null);
    }
  };

  const handleRemoveMember = async (member: GroupMemberWithProfile) => {
    const db = localDb();
    const userId = user()?.id;
    const groupId = selectedGroupId();
    if (!db || !userId || !groupId || !member.membershipId) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${member.profileName ?? member.profileEmail ?? member.userRef} from this group?`
    );
    if (!confirmed) {
      return;
    }

    try {
      setBusyMembershipId(member.membershipId);
      await removeGroupMember(db, groupId, member.membershipId, userId);
      setGroupListVersion((value) => value + 1);
      toast.success("Removed group member.", { duration: 2500 });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove group member"
      );
    } finally {
      setBusyMembershipId(null);
    }
  };

  return (
    <>
      <div class="flex h-full min-h-0 flex-col bg-white dark:bg-gray-800">
        <div class="flex min-h-0 flex-1 flex-col bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
          <header class="mb-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
            <div class="flex items-center justify-start">
              <Button
                type="button"
                variant="outline"
                onClick={props.onClose}
                data-testid="groups-close-button"
              >
                Cancel
              </Button>
            </div>
            <div class="flex min-w-0 items-center justify-center px-3">
              <h2
                id="groups-dialog-title"
                class="text-center text-xl font-semibold text-gray-900 dark:text-gray-100 md:text-2xl"
              >
                Groups
              </h2>
            </div>
            <div class="flex items-center justify-end">
              <Button
                type="button"
                class="inline-flex items-center justify-center gap-2"
                variant="default"
                onClick={() => setShowCreateGroupDialog(true)}
                data-testid="open-create-group-button"
              >
                <Plus size={16} />
                New Group
              </Button>
            </div>
          </header>

          <p class="mb-6 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
            Create groups, review current membership, and manage shared
            programs.
          </p>

          <Show
            when={!groups.loading}
            fallback={
              <div class="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                Loading groups...
              </div>
            }
          >
            <Show
              when={(groups() ?? []).length > 0}
              fallback={
                <div class="rounded-xl border border-dashed border-border bg-background p-10 text-center">
                  <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <span aria-hidden="true">+</span>
                  </div>
                  <h3 class="mt-4 text-lg font-semibold text-foreground">
                    No groups yet
                  </h3>
                  <p class="mt-2 text-sm text-muted-foreground">
                    Start by creating a group so you can attach shared programs
                    to it.
                  </p>
                  <Button
                    type="button"
                    class="mt-5 inline-flex items-center gap-2"
                    variant="outline"
                    onClick={() => setShowCreateGroupDialog(true)}
                    data-testid="empty-create-group-button"
                  >
                    <span aria-hidden="true">+</span>
                    Create Your First Group
                  </Button>
                </div>
              }
            >
              <div class="grid min-h-0 flex-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <section class="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                  <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                    <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Your Groups
                    </h3>
                  </div>
                  <div
                    class="min-h-0 flex-1 overflow-y-auto p-2"
                    data-testid="groups-list"
                  >
                    <For each={groups() ?? []}>
                      {(group) => (
                        <button
                          type="button"
                          class={`mb-2 flex w-full items-start justify-between rounded-lg border px-3 py-3 text-left last:mb-0 ${
                            selectedGroupId() === group.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-accent/30"
                          }`}
                          onClick={() => setSelectedGroupId(group.id)}
                          data-testid="group-list-item"
                        >
                          <div class="min-w-0">
                            <div class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                              {group.name}
                            </div>
                            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {group.memberCount} member
                              {group.memberCount === 1 ? "" : "s"}
                            </div>
                          </div>
                          <span
                            class={`ml-3 inline-flex rounded-full px-2 py-1 text-[11px] font-medium capitalize ${roleBadgeClass(group.currentUserRole)}`}
                          >
                            {group.currentUserRole ?? "viewer"}
                          </span>
                        </button>
                      )}
                    </For>
                  </div>
                </section>

                <Show when={selectedGroup()}>
                  {(groupAccessor) => {
                    const group = groupAccessor();
                    return (
                      <section class="grid min-h-0 gap-6 grid-rows-[auto_minmax(0,1fr)]">
                        <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                                {group.name}
                              </h3>
                              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                {group.description || "No description yet."}
                              </p>
                            </div>
                            <div class="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                              Owner: {group.ownerName ?? group.ownerUserRef}
                            </div>
                          </div>
                        </div>

                        <div class="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
                          <div class="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                            <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                              <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Members and Roles
                              </h3>
                            </div>
                            <div
                              class="flex min-h-0 flex-1 flex-col gap-3 p-4"
                              data-testid="group-members-list"
                            >
                              <Show when={group.canManageMembership}>
                                <div class="shrink-0 rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-700">
                                  <div class="flex flex-col gap-3">
                                    <div class="flex flex-col gap-2">
                                      <input
                                        type="text"
                                        value={memberSearchTerm()}
                                        onInput={(event) =>
                                          setMemberSearchTerm(
                                            event.currentTarget.value
                                          )
                                        }
                                        placeholder="Search by name or email"
                                        class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                        data-testid="group-member-search-input"
                                      />
                                      <div class="text-xs text-gray-500 dark:text-gray-400">
                                        Search uses a secure directory lookup
                                        when online. Offline, it falls back to
                                        profiles already synced to this device.
                                        Existing members stay visible here so
                                        you can confirm who is already in the
                                        group.
                                      </div>
                                    </div>

                                    <Show
                                      when={
                                        memberSearchTerm().trim().length >= 2
                                      }
                                    >
                                      <Show
                                        when={!memberCandidates.loading}
                                        fallback={
                                          <div class="text-sm text-gray-500 dark:text-gray-400">
                                            Searching members...
                                          </div>
                                        }
                                      >
                                        <Show
                                          when={
                                            (memberCandidates() ?? []).length >
                                            0
                                          }
                                          fallback={
                                            <div class="text-sm text-gray-500 dark:text-gray-400">
                                              No matching users found. Offline
                                              search only covers profiles
                                              already synced to this device.
                                            </div>
                                          }
                                        >
                                          <div
                                            class="max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
                                            data-testid="group-member-candidate-list"
                                          >
                                            <div class="space-y-2">
                                              <For
                                                each={memberCandidates() ?? []}
                                              >
                                                {(candidate) => (
                                                  <GroupMemberCandidateRow
                                                    candidate={candidate}
                                                    isAdding={isAddingMember()}
                                                    onAdd={(nextCandidate) =>
                                                      void handleAddMember(
                                                        nextCandidate
                                                      )
                                                    }
                                                  />
                                                )}
                                              </For>
                                            </div>
                                          </div>
                                        </Show>
                                      </Show>
                                    </Show>
                                  </div>
                                </div>
                              </Show>

                              <div class="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
                                <Show
                                  when={!groupMembers.loading}
                                  fallback={
                                    <div class="text-sm text-gray-500 dark:text-gray-400">
                                      Loading members...
                                    </div>
                                  }
                                >
                                  <div class="space-y-3">
                                    <For each={groupMembers() ?? []}>
                                      {(member) => (
                                        <ManageableGroupMemberRow
                                          member={member}
                                          canManage={group.canManageMembership}
                                          isBusy={
                                            busyMembershipId() ===
                                            member.membershipId
                                          }
                                          onRoleChange={(role) =>
                                            void handleUpdateMemberRole(
                                              member,
                                              role
                                            )
                                          }
                                          onRemove={() =>
                                            void handleRemoveMember(member)
                                          }
                                          onShowInfo={() =>
                                            setSelectedMemberInfo(member)
                                          }
                                        />
                                      )}
                                    </For>
                                  </div>
                                </Show>
                              </div>
                            </div>
                          </div>

                          <div class="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                            <div class="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  Programs
                                </h3>
                                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  Shared programs owned by this group.
                                </p>
                              </div>
                              <Show when={group.canManageSets}>
                                <div class="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    class="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200"
                                    onClick={handleOpenNewProgram}
                                    data-testid="create-group-program-button"
                                  >
                                    <span aria-hidden="true">+</span>
                                    New Program
                                  </button>
                                </div>
                              </Show>
                            </div>

                            <div class="flex min-h-0 flex-1 flex-col p-4">
                              <Show when={groupPrograms.error}>
                                <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
                                  Failed to load programs.
                                </div>
                              </Show>

                              <div class="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
                                <Show
                                  when={
                                    !groupPrograms.loading ||
                                    visibleGroupPrograms().length > 0 ||
                                    Boolean(groupPrograms.error)
                                  }
                                  fallback={
                                    <div class="text-sm text-gray-500 dark:text-gray-400">
                                      Loading programs...
                                    </div>
                                  }
                                >
                                  <Show
                                    when={visibleGroupPrograms().length > 0}
                                    fallback={
                                      <div class="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                        <Show
                                          when={groupPrograms.loading}
                                          fallback="No shared programs yet."
                                        >
                                          Refreshing programs...
                                        </Show>
                                      </div>
                                    }
                                  >
                                    <div
                                      class="space-y-3"
                                      data-testid="group-programs-list"
                                    >
                                      <For each={visibleGroupPrograms()}>
                                        {(programRow) => (
                                          <div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                                            <div class="flex items-center justify-between gap-3">
                                              <button
                                                type="button"
                                                class="min-w-0 flex-1 text-left"
                                                onClick={() =>
                                                  handleOpenProgramDetails(
                                                    programRow
                                                  )
                                                }
                                                data-testid="open-group-program-button"
                                              >
                                                <div class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                                  {programRow.name}
                                                </div>
                                              </button>

                                              <div class="flex shrink-0 items-center gap-2">
                                                <button
                                                  type="button"
                                                  class="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                                  onClick={() =>
                                                    handleOpenExistingProgram(
                                                      programRow
                                                    )
                                                  }
                                                  data-testid="view-group-program-button"
                                                >
                                                  <Show
                                                    when={programRow.canManage}
                                                    fallback="View"
                                                  >
                                                    <SquarePen size={14} />
                                                    Edit
                                                  </Show>
                                                </button>
                                                <Show
                                                  when={programRow.canManage}
                                                >
                                                  <button
                                                    type="button"
                                                    class="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40"
                                                    disabled={
                                                      deletingProgramId() ===
                                                      programRow.id
                                                    }
                                                    onClick={() =>
                                                      void handleDeleteProgram(
                                                        programRow
                                                      )
                                                    }
                                                    data-testid="delete-group-program-button"
                                                  >
                                                    <Show
                                                      when={
                                                        deletingProgramId() ===
                                                        programRow.id
                                                      }
                                                      fallback={
                                                        <Trash2 size={14} />
                                                      }
                                                    >
                                                      Deleting...
                                                    </Show>
                                                  </button>
                                                </Show>
                                              </div>
                                            </div>

                                            <div class="mt-3">
                                              <div class="text-sm text-gray-600 dark:text-gray-400">
                                                {programRow.description ||
                                                  "No description yet."}
                                              </div>
                                              <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                {programRow.itemCount} item
                                                {programRow.itemCount === 1
                                                  ? ""
                                                  : "s"}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </For>
                                    </div>
                                  </Show>
                                </Show>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    );
                  }}
                </Show>
              </div>
            </Show>
          </Show>
        </div>
      </div>

      <GroupDialog
        isOpen={showCreateGroupDialog()}
        isSaving={isCreatingGroup()}
        error={groupDialogError()}
        onClose={() => {
          if (!isCreatingGroup()) {
            setShowCreateGroupDialog(false);
            setGroupDialogError(null);
          }
        }}
        onSubmit={(data) => void handleCreateGroup(data)}
      />

      <ProgramBuilderDialog
        isOpen={showProgramEditor()}
        onClose={() => {
          setShowProgramEditor(false);
          setEditingProgramId(undefined);
          setProgramDialogMode("edit");
        }}
        programId={editingProgramId()}
        forceViewMode={programDialogMode() === "view"}
        onSaved={() => {
          incrementTuneSetListChanged();
          void refetchGroupPrograms();
        }}
        groupRef={selectedGroupId()}
      />

      <MemberInfoDialog
        member={selectedMemberInfo()}
        isOpen={selectedMemberInfo() !== null}
        onClose={() => setSelectedMemberInfo(null)}
      />
    </>
  );
};

export const GroupsManagerDialog: Component<GroupsManagerDialogProps> = (
  props
) => {
  const groupsDialog = useGroupsDialog();
  const isOpen = () => props.isOpen ?? groupsDialog.isOpen();
  const closeDialog = () =>
    props.onClose?.() ?? groupsDialog.closeGroupsDialog();

  createEffect(() => {
    if (!isOpen()) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={isOpen()}>
      <button
        type="button"
        class="fixed inset-0 z-40 bg-black/50"
        onClick={closeDialog}
        aria-label="Close groups"
        data-testid="groups-modal-backdrop"
      />

      <div
        class="fixed inset-0 z-50 flex items-start justify-center pb-2 pt-2 md:pb-16 md:pt-8 pointer-events-none"
        data-testid="groups-modal-wrapper"
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Click only stops propagation inside modal shell */}
        <div
          class="mx-2 flex h-[calc(100vh-1rem)] w-full max-w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl pointer-events-auto dark:border-gray-700 dark:bg-gray-800 md:h-[calc(100vh-4rem)] md:max-w-6xl"
          role="dialog"
          aria-labelledby="groups-dialog-title"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
          data-testid="groups-modal"
        >
          <div class="min-h-0 flex-1 overflow-hidden">
            <GroupsManagerContent onClose={closeDialog} />
          </div>
        </div>
      </div>
    </Show>
  );
};

export default GroupsManagerDialog;
