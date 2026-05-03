import { Crown, Plus, Shield, Trash2, User, X } from "lucide-solid";
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
        aria-label="Close create group dialog backdrop"
        data-testid="group-dialog-backdrop"
      />

      <div
        class="fixed left-1/2 top-1/2 z-[70] w-[95vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-dialog-title"
        data-testid="group-dialog"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2
              id="group-dialog-title"
              class="text-xl font-semibold text-gray-900 dark:text-white"
            >
              Create Group
            </h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Create a group space for shared membership and group-owned
              programs.
            </p>
          </div>
          <Button
            type="button"
            onClick={props.onClose}
            variant="ghost"
            size="sm"
            aria-label="Close create group dialog"
            data-testid="close-group-dialog-button"
          >
            Close
          </Button>
        </div>

        <div class="mt-4 space-y-4">
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

          <div class="flex w-full justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
            <Button
              type="button"
              onClick={props.onClose}
              disabled={props.isSaving}
              variant="outline"
              data-testid="cancel-group-button"
            >
              Cancel
            </Button>
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
              <Show when={props.isSaving} fallback="Create Group">
                Creating...
              </Show>
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
};

const ManageableGroupMemberRow: Component<{
  member: GroupMemberWithProfile;
  canManage: boolean;
  isBusy: boolean;
  onRoleChange: (role: "admin" | "member") => void;
  onRemove: () => void;
}> = (props) => {
  return (
    <div class="relative rounded-lg border border-gray-200 px-4 py-4 dark:border-gray-700">
      <div class="min-w-0 pr-28">
        <div class="text-base font-medium leading-tight text-gray-900 dark:text-white">
          {props.member.profileName ??
            props.member.profileEmail ??
            "Unknown member"}
        </div>
        <div class="mt-2 text-sm text-gray-400 dark:text-gray-400">
          <Show
            when={props.member.isOwner}
            fallback={
              <>
                <Show when={props.member.profileEmail}>
                  <div class="truncate">{props.member.profileEmail}</div>
                </Show>
                <div>
                  Joined {new Date(props.member.joinedAt).toLocaleDateString()}
                </div>
              </>
            }
          >
            Group owner
          </Show>
        </div>
      </div>

      <Show
        when={props.canManage && !props.member.isOwner}
        fallback={
          <div class="absolute right-4 top-4">
            <span
              class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${roleBadgeClass(props.member.effectiveRole)}`}
            >
              <Show
                when={props.member.effectiveRole === "owner"}
                fallback={null}
              >
                <Crown size={12} />
              </Show>
              {props.member.effectiveRole}
            </span>
          </div>
        }
      >
        <div class="absolute right-4 top-4 flex items-center gap-2">
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
  );
};

const GroupMemberCandidateRow: Component<{
  candidate: GroupMemberCandidate;
  isAdding: boolean;
  onAdd: (userRef: string) => void;
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
            onClick={() => props.onAdd(props.candidate.userRef)}
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

const GroupsManagerContent: Component = () => {
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
  const [deletingProgramId, setDeletingProgramId] = createSignal<string | null>(
    null
  );
  const [memberSearchTerm, setMemberSearchTerm] = createSignal("");
  const [isAddingMember, setIsAddingMember] = createSignal(false);
  const [busyMembershipId, setBusyMembershipId] = createSignal<string | null>(
    null
  );

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
    setEditingProgramId(undefined);
    setShowProgramEditor(true);
  };

  const handleOpenExistingProgram = (program: ProgramWithSummary) => {
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

  const handleAddMember = async (memberUserId: string) => {
    const db = localDb();
    const userId = user()?.id;
    const groupId = selectedGroupId();
    if (!db || !userId || !groupId) {
      toast.error("Database is not ready yet.");
      return;
    }

    try {
      setIsAddingMember(true);
      await addGroupMember(db, groupId, userId, memberUserId, "member");
      setGroupListVersion((value) => value + 1);
      setMemberSearchTerm("");
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
      <div class="flex h-full flex-col bg-white dark:bg-gray-800">
        <div class="flex-1 overflow-auto bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
          <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p class="max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                Create groups, review current membership, and manage shared
                programs.
              </p>
            </div>
            <Button
              type="button"
              class="inline-flex items-center justify-center gap-2"
              variant="default"
              onClick={() => setShowCreateGroupDialog(true)}
              data-testid="open-create-group-button"
            >
              <span aria-hidden="true">+</span>
              New Group
            </Button>
          </div>

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
              <div class="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                  <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                    <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Your Groups
                    </h3>
                  </div>
                  <div class="p-2" data-testid="groups-list">
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
                      <section class="space-y-6">
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

                        <div class="grid gap-6 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
                          <div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                            <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                              <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Members and Roles
                              </h3>
                            </div>
                            <div
                              class="space-y-3 p-4"
                              data-testid="group-members-list"
                            >
                              <Show when={group.canManageMembership}>
                                <div class="rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-700">
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
                                            class="space-y-2"
                                            data-testid="group-member-candidate-list"
                                          >
                                            <For
                                              each={memberCandidates() ?? []}
                                            >
                                              {(candidate) => (
                                                <GroupMemberCandidateRow
                                                  candidate={candidate}
                                                  isAdding={isAddingMember()}
                                                  onAdd={(userRef) =>
                                                    void handleAddMember(
                                                      userRef
                                                    )
                                                  }
                                                />
                                              )}
                                            </For>
                                          </div>
                                        </Show>
                                      </Show>
                                    </Show>
                                  </div>
                                </div>
                              </Show>

                              <Show
                                when={!groupMembers.loading}
                                fallback={
                                  <div class="text-sm text-gray-500 dark:text-gray-400">
                                    Loading members...
                                  </div>
                                }
                              >
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
                                    />
                                  )}
                                </For>
                              </Show>
                            </div>
                          </div>

                          <div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
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

                            <div class="p-4">
                              <Show when={groupPrograms.error}>
                                <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
                                  Failed to load programs.
                                </div>
                              </Show>
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
                                          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <button
                                              type="button"
                                              class="min-w-0 text-left"
                                              onClick={() =>
                                                handleOpenExistingProgram(
                                                  programRow
                                                )
                                              }
                                              data-testid="open-group-program-button"
                                            >
                                              <div class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                                {programRow.name}
                                              </div>
                                              <div class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                                {programRow.description ||
                                                  "No description yet."}
                                              </div>
                                              <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                {programRow.itemCount} item
                                                {programRow.itemCount === 1
                                                  ? ""
                                                  : "s"}
                                              </div>
                                            </button>

                                            <div class="flex items-center gap-2">
                                              <button
                                                type="button"
                                                class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                                onClick={() =>
                                                  handleOpenExistingProgram(
                                                    programRow
                                                  )
                                                }
                                                data-testid="view-group-program-button"
                                              >
                                                {programRow.canManage
                                                  ? "Edit"
                                                  : "View"}
                                              </button>
                                              <Show when={programRow.canManage}>
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
                                        </div>
                                      )}
                                    </For>
                                  </div>
                                </Show>
                              </Show>
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
        }}
        programId={editingProgramId()}
        onSaved={() => {
          incrementTuneSetListChanged();
          void refetchGroupPrograms();
        }}
        groupRef={selectedGroupId()}
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
          class="mx-2 flex h-[calc(100vh-1rem)] w-full max-w-full flex-col rounded-lg border border-gray-200 bg-white shadow-2xl pointer-events-auto dark:border-gray-700 dark:bg-gray-800 md:max-h-[calc(100vh-8rem)] md:max-w-6xl"
          role="dialog"
          aria-labelledby="groups-dialog-title"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
          data-testid="groups-modal"
        >
          <div class="flex items-start justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700 md:px-6 md:py-4">
            <div>
              <h2
                id="groups-dialog-title"
                class="text-xl font-semibold text-gray-900 dark:text-gray-100 md:text-2xl"
              >
                Groups
              </h2>
              <p class="mt-1 hidden text-sm text-gray-500 dark:text-gray-400 md:block">
                Manage group membership and shared programs without leaving your
                current page.
              </p>
            </div>

            <button
              type="button"
              onClick={closeDialog}
              class="relative z-10 flex h-10 w-10 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              aria-label="Close groups"
              data-testid="groups-close-button"
            >
              <X size={20} />
            </button>
          </div>

          <div class="min-h-0 flex-1 overflow-hidden">
            <GroupsManagerContent />
          </div>
        </div>
      </div>
    </Show>
  );
};

export default GroupsManagerDialog;
