/**
 * Plugin Queries
 *
 * CRUD operations for the plugin table.
 */

import { and, desc, eq, or } from "drizzle-orm";
import {
  hasCapability,
  type PluginCapability,
} from "@/lib/plugins/capabilities";
import { generateId } from "@/lib/utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import { plugin } from "../schema";
import type { Plugin } from "../types";

export interface CreatePluginInput {
  userRef: string;
  name: string;
  description?: string | null;
  script: string;
  capabilities: string;
  goals?: string[];
  isPublic?: boolean;
  enabled?: boolean;
  version?: number;
}

export interface UpdatePluginInput {
  name?: string;
  description?: string | null;
  script?: string;
  capabilities?: string;
  goals?: string[];
  isPublic?: boolean;
  enabled?: boolean;
  version?: number;
}

function serializeGoals(goals?: string[] | null): string {
  return JSON.stringify(Array.isArray(goals) ? goals : []);
}

function parseGoals(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((goal) => typeof goal === "string");
    }
  } catch {
    return [];
  }
  return [];
}

export async function getPlugins(
  db: SqliteDatabase,
  userId: string,
  options?: { includePublic?: boolean; includeDeleted?: boolean }
): Promise<Plugin[]> {
  const includePublic = options?.includePublic ?? true;
  const includeDeleted = options?.includeDeleted ?? false;

  const visibility = includePublic
    ? or(eq(plugin.userRef, userId), eq(plugin.isPublic, 1))
    : eq(plugin.userRef, userId);

  const clauses = [visibility];
  if (!includeDeleted) {
    clauses.push(eq(plugin.deleted, 0));
  }

  return db
    .select()
    .from(plugin)
    .where(and(...clauses))
    .orderBy(desc(plugin.lastModifiedAt))
    .all();
}

export async function getPluginsByCapability(
  db: SqliteDatabase,
  userId: string,
  capability: PluginCapability,
  options?: {
    includePublic?: boolean;
    includeDisabled?: boolean;
    goal?: string;
  }
): Promise<Plugin[]> {
  const includeDisabled = options?.includeDisabled ?? false;
  const plugins = await getPlugins(db, userId, {
    includePublic: options?.includePublic ?? true,
    includeDeleted: false,
  });

  const goal = options?.goal;

  return plugins
    .filter((row) => {
      if (!includeDisabled && row.enabled !== 1) return false;
      return hasCapability(row.capabilities, capability);
    })
    .filter((row) => {
      if (!goal) return true;
      const goals = parseGoals(row.goals ?? null);
      if (goals.length === 0) return true;
      return goals.includes(goal);
    });
}

export async function createPlugin(
  db: SqliteDatabase,
  input: CreatePluginInput
): Promise<Plugin> {
  const now = new Date().toISOString();
  const [created] = await db
    .insert(plugin)
    .values({
      id: generateId(),
      userRef: input.userRef,
      name: input.name,
      description: input.description ?? null,
      script: input.script,
      capabilities: input.capabilities,
      goals: serializeGoals(input.goals),
      isPublic: input.isPublic ? 1 : 0,
      enabled: input.enabled === false ? 0 : 1,
      version: input.version ?? 1,
      deleted: 0,
      syncVersion: 1,
      lastModifiedAt: now,
    })
    .returning();

  if (!created) throw new Error("Failed to create plugin");
  return created;
}

export async function updatePlugin(
  db: SqliteDatabase,
  pluginId: string,
  input: UpdatePluginInput
): Promise<Plugin | undefined> {
  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    lastModifiedAt: now,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined)
    updateData.description = input.description;
  if (input.script !== undefined) updateData.script = input.script;
  if (input.capabilities !== undefined)
    updateData.capabilities = input.capabilities;
  if (input.goals !== undefined) updateData.goals = serializeGoals(input.goals);
  if (input.isPublic !== undefined)
    updateData.isPublic = input.isPublic ? 1 : 0;
  if (input.enabled !== undefined) updateData.enabled = input.enabled ? 1 : 0;
  if (input.version !== undefined) updateData.version = input.version;

  const [updated] = await db
    .update(plugin)
    .set(updateData)
    .where(eq(plugin.id, pluginId))
    .returning();

  return updated;
}

export async function deletePlugin(
  db: SqliteDatabase,
  pluginId: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const [updated] = await db
    .update(plugin)
    .set({
      deleted: 1,
      lastModifiedAt: now,
    })
    .where(eq(plugin.id, pluginId))
    .returning();

  return Boolean(updated);
}
