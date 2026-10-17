/**
 * ReferencesPanel Component
 *
 * Sidebar panel for managing tune references.
 * Displays references for the current tune, allows add/edit/delete operations.
 * Supports drag-and-drop reordering.
 *
 * @module components/references/ReferencesPanel
 */

import { Link, Plus } from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { useAudioPlayer } from "@/components/audio/AudioPlayerContext";
import { useUserSettingsDialog } from "@/contexts/UserSettingsDialogContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { resolveByosAudioForPlayback } from "@/lib/byos/audio";
import { validateByosAudioFile } from "@/lib/byos/audio-validation";
import {
  deleteAudioDraft,
  getAudioDraft,
  listAudioDrafts,
  putAudioDraft,
  registerReferenceDraftCapture,
} from "@/lib/byos/draft-store";
import { getStorageConfig } from "@/lib/byos/provider-selection";
import {
  cancelAudioUpload,
  isAudioUploadActive,
} from "@/lib/byos/upload-queue";
import { useCurrentTune } from "@/lib/context/CurrentTuneContext";
import {
  getSidebarFontClasses,
  useUIPreferences,
} from "@/lib/context/UIPreferencesContext";
import { getDb } from "@/lib/db/client-sqlite";
import {
  getMediaAssetByReferenceId,
  getMediaAssetsByTune,
} from "@/lib/db/queries/media-assets";
import {
  type CreateReferenceData,
  createReference,
  deleteReference,
  getReferencesByTune,
  type Reference,
  updateReference,
  updateReferenceOrder,
} from "@/lib/db/queries/references";
import { generateId } from "@/lib/utils/uuid";
import { ReferenceForm, type ReferenceFormData } from "./ReferenceForm";
import { ReferenceList } from "./ReferenceList";

export const ReferencesPanel: Component = () => {
  const { currentTuneId, setCurrentTuneId } = useCurrentTune();
  const { openUserSettings } = useUserSettingsDialog();
  const { openTrack } = useAudioPlayer();
  const { session, user, localDb, remoteSyncDownCompletionVersion } = useAuth();
  const { sidebarFontSize } = useUIPreferences();
  const currentUserId = () => user()?.id ?? null;

  // Get dynamic font classes
  const fontClasses = () => getSidebarFontClasses(sidebarFontSize());

  const [isAdding, setIsAdding] = createSignal(false);
  const [editingReference, setEditingReference] =
    createSignal<Reference | null>(null);
  const [isPanelDragActive, setIsPanelDragActive] = createSignal(false);
  const [addDraft, setAddDraft] = createSignal<
    Partial<ReferenceFormData> | undefined
  >();
  let liveDraft: ReferenceFormData | undefined;
  let draftTuneId: string | null = null;
  const [isSaving, setIsSaving] = createSignal(false);
  const [revision, setRevision] = createSignal(0);
  const refresh = () => setRevision((n) => n + 1);
  for (const event of [
    "byos-settings-changed",
    "byos-drafts-changed",
    "byos-upload-complete",
  ])
    window.addEventListener(event, refresh);
  onCleanup(() => {
    for (const event of [
      "byos-settings-changed",
      "byos-drafts-changed",
      "byos-upload-complete",
    ])
      window.removeEventListener(event, refresh);
  });
  const storageConfig = createMemo(() => {
    revision();
    remoteSyncDownCompletionVersion();
    const db = localDb();
    const userId = user()?.id;
    return db && userId ? getStorageConfig(db, userId) : null;
  });
  const [queued] = createResource(
    () => ({ userId: user()?.id, revision: revision() }),
    async ({ userId }) =>
      userId
        ? (await listAudioDrafts(userId)).filter((d) => d.id !== "oauth")
        : []
  );
  onCleanup(
    registerReferenceDraftCapture(async () => {
      const userId = user()?.id;
      const tuneId = draftTuneId;
      if (isAdding() && liveDraft && userId && tuneId)
        await putAudioDraft({ id: "oauth", userId, tuneId, fields: liveDraft });
    })
  );
  createEffect(() => {
    const userId = user()?.id;
    if (!userId || !localDb()) return;
    let current = true;
    onCleanup(() => {
      current = false;
    });
    void getAudioDraft(userId, "oauth")
      .then((draft) => {
        if (
          !current ||
          !draft ||
          sessionStorage.getItem("byos-restore-draft") !== userId
        )
          return;
        setCurrentTuneId(draft.tuneId);
        draftTuneId = draft.tuneId;
        setAddDraft(draft.fields);
        setIsAdding(true);
        sessionStorage.removeItem("byos-restore-draft");
        void deleteAudioDraft(userId, "oauth");
      })
      .catch(() => toast.error("Could not restore the audio draft."));
  });
  const INTERNAL_REFERENCE_DRAG_TYPE = "application/x-tunetrees-reference-id";
  const defaultAudioTitle = (filename: string) =>
    filename.replace(/\.[^.]+$/, "");

  const openAddForm = (initialData?: Partial<ReferenceFormData>) => {
    draftTuneId = currentTuneId();
    liveDraft = undefined;
    setAddDraft(initialData);
    setEditingReference(null);
    setIsAdding(true);
  };

  const getDataTransferTypes = (
    dataTransfer: DataTransfer | null | undefined
  ) => (dataTransfer?.types ? Array.from(dataTransfer.types) : []);

  const hasFileDrop = (dataTransfer: DataTransfer | null | undefined) =>
    getDataTransferTypes(dataTransfer).includes("Files");

  const hasInternalReferenceDrag = (
    dataTransfer: DataTransfer | null | undefined
  ) =>
    getDataTransferTypes(dataTransfer).includes(INTERNAL_REFERENCE_DRAG_TYPE);

  const hasUrlDrop = (dataTransfer: DataTransfer | null | undefined) => {
    if (!dataTransfer) {
      return false;
    }

    const types = getDataTransferTypes(dataTransfer);
    if (types.includes("text/uri-list")) {
      return true;
    }

    const plainText = dataTransfer.getData("text/plain").trim();
    return plainText.startsWith("http://") || plainText.startsWith("https://");
  };

  const getDroppedUrl = (dataTransfer: DataTransfer | null | undefined) => {
    if (!dataTransfer) {
      return null;
    }

    const uriList = dataTransfer
      .getData("text/uri-list")
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find((value) => value && !value.startsWith("#"));
    if (uriList) {
      return uriList;
    }

    const plainText = dataTransfer.getData("text/plain").trim();
    if (plainText.startsWith("http://") || plainText.startsWith("https://")) {
      return plainText;
    }

    return null;
  };

  const hasCreateReferenceDrop = (
    dataTransfer: DataTransfer | null | undefined
  ) => {
    if (hasInternalReferenceDrag(dataTransfer)) {
      return false;
    }

    return hasFileDrop(dataTransfer) || hasUrlDrop(dataTransfer);
  };

  const isAudioFile = (file: File) => {
    if (file.type.startsWith("audio/")) {
      return true;
    }

    return /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name);
  };

  // Load references for current tune
  const [references, { refetch }] = createResource(
    () => ({
      tuneId: currentTuneId(),
      userId: user()?.id,
      revision: revision(),
    }),
    async (params) => {
      if (!params.tuneId || !params.userId) return [];
      const db = getDb();
      return await getReferencesByTune(db, params.tuneId, params.userId);
    }
  );

  const [mediaAssets, { refetch: refetchMediaAssets }] = createResource(
    () => ({
      tuneId: currentTuneId(),
      userId: user()?.id,
      revision: revision(),
    }),
    async (params) => {
      if (!params.tuneId || !params.userId) return [];
      const db = getDb();
      return await getMediaAssetsByTune(db, params.tuneId, params.userId);
    }
  );

  const mediaAssetsByReferenceId = createMemo(() => {
    return new Map(
      (mediaAssets() || []).map((asset) => [asset.referenceRef, asset])
    );
  });
  const canManageReference = (reference: Reference) =>
    reference.userRef === currentUserId();
  const canReorderReferences = createMemo(() =>
    (references() ?? []).every((reference) => canManageReference(reference))
  );

  const mediaUrlLabelsByReferenceId = createMemo(() => {
    return new Map(
      (mediaAssets() || []).map((asset) => [
        asset.referenceRef,
        asset.originalFilename,
      ])
    );
  });

  // Handle creating a new reference
  const handleCreateReference = async (data: ReferenceFormData) => {
    const tuneId = draftTuneId;
    const currentUser = user();

    if (!tuneId || !currentUser?.id || isSaving()) return;
    setIsSaving(true);

    try {
      const db = getDb();

      if (data.sourceMode === "upload" && data.uploadFile) {
        const validationError = validateByosAudioFile(data.uploadFile);
        if (validationError) {
          throw new Error(validationError);
        }
        const destination = getStorageConfig(db, currentUser.id);
        if (!destination)
          throw new Error("Configure storage before saving an audio file.");
        await putAudioDraft({
          id: generateId(),
          userId: currentUser.id,
          tuneId,
          fields: data,
          destination,
        });
        window.dispatchEvent(new Event("byos-retry-uploads"));
        toast.success("Audio saved locally and queued for upload.");
      } else {
        const createData: CreateReferenceData = {
          url: data.url,
          tuneRef: tuneId,
          title: data.title || undefined,
          refType: data.refType,
          comment: data.comment || undefined,
          favorite: data.favorite,
          public: data.public,
        };

        await createReference(db, createData, currentUser.id);
      }

      // Reset form
      setAddDraft(undefined);
      setIsAdding(false);

      // Reload references
      refetch();
      refetchMediaAssets();
    } catch (error) {
      console.error("Failed to create reference:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create reference."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle updating a reference
  const handleUpdateReference = async (data: ReferenceFormData) => {
    const refToEdit = editingReference();
    if (!refToEdit) return;

    try {
      const db = getDb();
      await updateReference(db, refToEdit.id, {
        url: data.url,
        title: data.title || undefined,
        refType: data.refType,
        comment: data.comment || undefined,
        favorite: data.favorite,
        public: data.public,
      });

      // Reset form
      setAddDraft(undefined);
      setEditingReference(null);

      // Reload references
      refetch();
      refetchMediaAssets();
    } catch (error) {
      console.error("Failed to update reference:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update reference."
      );
    }
  };

  // Handle deleting a reference
  const handleDeleteReference = async (referenceId: string) => {
    if (!confirm("Delete this reference?")) return;

    try {
      const db = getDb();
      await deleteReference(db, referenceId);

      // Reload references
      refetch();
      refetchMediaAssets();
    } catch (error) {
      console.error("Failed to delete reference:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete reference."
      );
    }
  };

  // Handle reordering references
  const handleReorderReferences = async (referenceIds: string[]) => {
    try {
      const db = getDb();
      await updateReferenceOrder(db, referenceIds);

      // Reload references
      refetch();
      refetchMediaAssets();
    } catch (error) {
      console.error("Failed to reorder references:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reorder references."
      );
    }
  };

  const handleOpenReference = async (reference: Reference) => {
    if (reference.refType === "audio") {
      const db = getDb();
      const freshMediaAsset = await getMediaAssetByReferenceId(
        db,
        reference.id,
        user()?.id
      );
      const mediaAsset =
        freshMediaAsset || mediaAssetsByReferenceId().get(reference.id);

      let playbackUrl = reference.url;
      if (mediaAsset?.storageKind === "byos") {
        const currentUser = user();
        if (!currentUser) {
          toast.error("This audio is unavailable on this device.");
          return;
        }
        try {
          playbackUrl = await resolveByosAudioForPlayback(mediaAsset, {
            userId: currentUser.id,
            getAppAccessToken: () => session()?.access_token,
          });
        } catch {
          toast.error("This audio is unavailable on this device.");
          return;
        }
      }

      openTrack({
        referenceId: reference.id,
        referenceTitle:
          reference.title ||
          defaultAudioTitle(
            mediaAsset?.originalFilename || `audio-${reference.id}.mp3`
          ),
        url: playbackUrl,
        regionsJson: mediaAsset?.regionsJson,
        durationSeconds: mediaAsset?.durationSeconds,
        contentType: mediaAsset?.contentType,
        originalFilename: mediaAsset?.originalFilename,
      });
      return;
    }

    window.open(reference.url, "_blank", "noopener,noreferrer");
  };

  // Handle edit button click
  const handleEditClick = (reference: Reference) => {
    setEditingReference(reference);
    setAddDraft(undefined);
    setIsAdding(false); // Close add form if open
  };

  // Handle cancel
  const handleCancel = () => {
    setAddDraft(undefined);
    setIsAdding(false);
    setEditingReference(null);
  };

  const handlePanelDragOver = (event: DragEvent) => {
    if (!hasCreateReferenceDrop(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    setIsPanelDragActive(true);
  };

  const handlePanelDragLeave = (event: DragEvent) => {
    if (!hasCreateReferenceDrop(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    const currentTarget = event.currentTarget;
    const relatedTarget = event.relatedTarget;
    if (
      currentTarget instanceof Node &&
      relatedTarget instanceof Node &&
      currentTarget.contains(relatedTarget)
    ) {
      return;
    }

    setIsPanelDragActive(false);
  };

  const handlePanelDrop = (event: DragEvent) => {
    if (!hasCreateReferenceDrop(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setIsPanelDragActive(false);

    if (!currentTuneId()) {
      toast.error("Select a tune before dropping a reference.");
      return;
    }

    const droppedUrl = getDroppedUrl(event.dataTransfer);
    if (droppedUrl) {
      openAddForm({
        url: droppedUrl,
        sourceMode: "url",
      });
      return;
    }

    const droppedFile = event.dataTransfer?.files?.[0] || null;
    if (!droppedFile) {
      return;
    }

    if (!isAudioFile(droppedFile)) {
      toast.error("Drop a web link or an audio file to create a reference.");
      return;
    }

    openAddForm({
      refType: "audio",
      sourceMode: "upload",
      uploadFile: droppedFile,
      title: defaultAudioTitle(droppedFile.name),
    });
  };

  return (
    <section
      class="references-panel rounded-lg border border-transparent transition-colors"
      classList={{
        "bg-blue-50/30 dark:bg-blue-950/15 border-blue-400 dark:border-blue-500 ring-2 ring-blue-300/60 dark:ring-blue-700/60":
          isPanelDragActive(),
      }}
      onDragOver={(event) => handlePanelDragOver(event)}
      onDragLeave={(event) => handlePanelDragLeave(event)}
      onDrop={(event) => handlePanelDrop(event)}
      aria-label="References drag and drop area"
      data-testid="references-panel"
    >
      {/* Header with icon and Add Reference button */}
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <Link
            class={`${fontClasses().iconSmall} text-gray-600 dark:text-gray-400`}
          />
          <h4
            class={`${fontClasses().text} font-medium text-gray-700 dark:text-gray-300`}
            data-testid="references-count"
          >
            {references()?.length || 0}{" "}
            {references()?.length === 1 ? "reference" : "references"}
          </h4>
        </div>
        <Show when={currentTuneId() && !isAdding() && !editingReference()}>
          <button
            type="button"
            onClick={() => openAddForm()}
            class={`inline-flex items-center gap-1 ${fontClasses().textSmall} px-1.5 py-0.5 text-green-600 dark:text-green-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors border border-gray-200/50 dark:border-gray-700/50`}
            title="Add new reference"
            data-testid="references-add-button"
          >
            Add
            <Plus class={fontClasses().iconSmall} />
          </button>
        </Show>
      </div>

      {/* Add reference form */}
      <Show when={isAdding()}>
        <div
          class="mb-3 p-2 bg-gray-50/50 dark:bg-gray-800/50 rounded border border-gray-200/30 dark:border-gray-700/30"
          data-testid="references-add-form"
        >
          <button
            type="button"
            class="min-h-11 text-sm underline text-muted-foreground"
            data-testid="byos-configure-storage"
            onClick={() => openUserSettings("storage-provider")}
          >
            Configure storage
          </button>
          <Show when={!storageConfig()}>
            <p
              role="status"
              class="mb-2 text-sm text-muted-foreground"
              data-testid="byos-storage-warning"
            >
              Storage is not configured. Configure storage to save audio files.
            </p>
          </Show>
          <ReferenceForm
            storageConfigured={!!storageConfig()}
            saving={isSaving()}
            onDraftChange={(data) => {
              liveDraft = data;
            }}
            initialData={addDraft()}
            autoOpenTypeSelect={!addDraft()}
            onSubmit={handleCreateReference}
            onCancel={handleCancel}
          />
        </div>
      </Show>

      {/* Edit reference form */}
      <For each={queued()?.filter((d) => d.tuneId === currentTuneId())}>
        {(draft) => (
          <div class="my-2 text-sm" data-testid="byos-queued-upload">
            <p>
              {draft.fields.title || draft.fields.uploadFile?.name}:{" "}
              {isAudioUploadActive(draft.userId, draft.id)
                ? "Uploading…"
                : draft.error || "Queued for upload"}
            </p>
            <button
              type="button"
              class="min-h-11 underline mr-3"
              onClick={() =>
                window.dispatchEvent(new Event("byos-retry-uploads"))
              }
            >
              Retry upload
            </button>
            <button
              type="button"
              class="min-h-11 underline"
              onClick={() => {
                const id = user()?.id;
                if (id)
                  void cancelAudioUpload(id, draft.id).catch(() =>
                    toast.error("Could not cancel the draft.")
                  );
              }}
            >
              Cancel upload
            </button>
          </div>
        )}
      </For>
      <Show when={editingReference()}>
        {(ref) => (
          <div
            class="mb-3 p-2 bg-gray-50/50 dark:bg-gray-800/50 rounded border border-gray-200/30 dark:border-gray-700/30"
            data-testid="references-edit-form"
          >
            <ReferenceForm
              reference={ref()}
              onSubmit={handleUpdateReference}
              onCancel={handleCancel}
            />
          </div>
        )}
      </Show>

      {/* No tune selected */}
      <Show when={!currentTuneId()}>
        <p
          class={`${fontClasses().text} italic text-gray-500 dark:text-gray-400`}
          data-testid="references-no-tune-message"
        >
          Select a tune to view references
        </p>
      </Show>

      {/* Loading state */}
      <Show when={references.loading}>
        <p
          class={`${fontClasses().text} text-gray-500 dark:text-gray-400`}
          data-testid="references-loading"
        >
          Loading references...
        </p>
      </Show>

      {/* References list */}
      <Show when={!isAdding() && !editingReference()}>
        <div data-testid="references-list-drop-target">
          <ReferenceList
            references={references() || []}
            onEdit={handleEditClick}
            onDelete={handleDeleteReference}
            onOpenReference={handleOpenReference}
            onReorder={
              canReorderReferences() ? handleReorderReferences : undefined
            }
            urlLabelByReferenceId={mediaUrlLabelsByReferenceId()}
            showActions={true}
            groupByType={false}
            canEditReference={canManageReference}
            canReorder={canReorderReferences()}
          />
        </div>
      </Show>
    </section>
  );
};
