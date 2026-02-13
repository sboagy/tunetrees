/**
 * Avatar Picker Component
 *
 * Allows users to:
 * 1. Select from predefined avatar images
 * 2. Upload a custom .png avatar (stored in Supabase Storage)
 *
 * @module AvatarPicker
 */

import { eq } from "drizzle-orm";
import { createResource, createSignal, For, Show } from "solid-js";
import { toast } from "solid-sonner";
import { userProfile } from "@/../drizzle/schema-sqlite";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { Card } from "../ui/card";

/**
 * List of predefined avatar images in /public/avatars
 */
const PREDEFINED_AVATARS = [
  "accordion.png",
  "balalaika.png",
  "banjo.png",
  "flute.png",
  "guitarist.png",
  "harmonica.png",
  "harp.png",
  "pianist.png",
  "singer.png",
  "violin.png",
];

/**
 * Maximum file size for custom avatar uploads (2MB)
 */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

export function AvatarPicker() {
  const auth = useAuth();
  const { localDb } = auth;
  const [uploading, setUploading] = createSignal(false);

  // Load current avatar URL from database (wait for localDb to be ready)
  const [currentAvatar, { refetch: refetchAvatar }] = createResource(
    () => ({ db: localDb(), userId: auth.user()?.id }),
    async ({ db, userId }) => {
      if (!db || !userId) return null;

      const result = await db
        .select({ avatarUrl: userProfile.avatarUrl })
        .from(userProfile)
        .where(eq(userProfile.id, userId))
        .limit(1);

      return result[0]?.avatarUrl || null;
    }
  );

  // Get the current or selected avatar for display
  const getDisplayAvatar = () => {
    return currentAvatar() || null;
  };

  /**
   * Save selected avatar URL to database
   */
  const saveAvatarUrl = async (url: string) => {
    const user = auth.user();
    const db = localDb();
    if (!user || !db) {
      toast.error("Not authenticated");
      return;
    }

    try {
      await db
        .update(userProfile)
        .set({
          avatarUrl: url,
          lastModifiedAt: new Date().toISOString(),
        })
        .where(eq(userProfile.id, user.id));

      toast.success("Avatar updated!");
      // Refetch to update UI
      refetchAvatar();
    } catch (error) {
      console.error("Failed to save avatar URL:", error);
      toast.error("Failed to save avatar");
    }
  };

  /**
   * Handle predefined avatar selection
   */
  const selectPredefinedAvatar = (filename: string) => {
    const url = `/avatars/${filename}`;
    const current = getDisplayAvatar();

    // Don't save if already selected (prevents duplicate toasts)
    if (current === url) {
      return;
    }

    saveAvatarUrl(url);
  };

  /**
   * Handle custom avatar upload
   */
  const handleFileUpload = async (event: Event) => {
    const user = auth.user();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File size must be less than 2MB");
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(data.path);

      // Save to database
      await saveAvatarUrl(publicUrl);

      toast.success("Custom avatar uploaded!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload avatar"
      );
    } finally {
      setUploading(false);
      // Reset file input
      input.value = "";
    }
  };

  /**
   * Delete custom avatar from storage
   */
  const deleteCustomAvatar = async () => {
    const user = auth.user();
    const current = currentAvatar();

    if (!user || !current || current.startsWith("/avatars/")) {
      return; // Only delete custom uploads, not predefined ones
    }

    try {
      // Extract path from public URL
      const url = new URL(current);
      const pathParts = url.pathname.split("/");
      const path = pathParts.slice(pathParts.indexOf("avatars") + 1).join("/");

      const { error } = await supabase.storage.from("avatars").remove([path]);

      if (error) {
        throw error;
      }

      // Clear from database
      await saveAvatarUrl("");

      toast.success("Custom avatar deleted");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete avatar");
    }
  };

  return (
    <div class="space-y-6">
      {/* Current Avatar Preview */}
      <div class="flex flex-col items-center gap-4">
        <Show
          when={getDisplayAvatar()}
          fallback={
            <div class="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted/50">
              <span class="text-sm text-muted-foreground">No avatar</span>
            </div>
          }
        >
          {(url) => (
            <div class="relative">
              <img
                src={url()}
                alt="Current avatar"
                class="h-24 w-24 rounded-full border-2 border-border object-cover"
              />
              <Show when={url() && !url()!.startsWith("/avatars/")}>
                <Button
                  size="sm"
                  variant="ghost"
                  class="absolute -right-2 -top-2 h-6 w-6 rounded-full p-0"
                  onClick={deleteCustomAvatar}
                  title="Delete custom avatar"
                >
                  ×
                </Button>
              </Show>
            </div>
          )}
        </Show>
      </div>

      {/* Predefined Avatars */}
      <div class="space-y-3">
        <h3 class="text-sm font-medium">Predefined Avatars</h3>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
          <For each={PREDEFINED_AVATARS}>
            {(filename) => {
              const url = `/avatars/${filename}`;
              const isSelected = () => getDisplayAvatar() === url;

              return (
                <Card
                  class="cursor-pointer overflow-hidden border-2 transition-all hover:border-primary"
                  classList={{
                    "border-primary ring-2 ring-primary/20": isSelected(),
                    "border-border": !isSelected(),
                  }}
                  onClick={() => selectPredefinedAvatar(filename)}
                >
                  <div class="aspect-square p-2">
                    <img
                      src={url}
                      alt={filename.replace(".png", "")}
                      class="h-full w-full rounded-full object-cover"
                    />
                  </div>
                </Card>
              );
            }}
          </For>
        </div>
      </div>

      {/* Custom Upload */}
      <div class="space-y-3">
        <h3 class="text-sm font-medium">Upload Custom Avatar</h3>
        <div class="flex flex-col gap-2">
          <input
            type="file"
            id="avatar-upload"
            accept="image/*"
            class="hidden"
            onChange={handleFileUpload}
            disabled={uploading()}
          />
          <label for="avatar-upload">
            <Button
              as="span"
              variant="outline"
              class="w-full cursor-pointer"
              disabled={uploading()}
            >
              <Show when={!uploading()} fallback="Uploading...">
                Choose File (Max 2MB)
              </Show>
            </Button>
          </label>
          <p class="text-xs text-muted-foreground">
            Upload a custom .png, .jpg, or .webp image
          </p>
        </div>
      </div>
    </div>
  );
}
