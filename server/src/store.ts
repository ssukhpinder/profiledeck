import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

import lockfile from "proper-lockfile";

import { createDefaultState } from "./defaults.js";
import {
  ProfileContextSchema,
  ProfileInputSchema,
  ProfileSchema,
  StoredStateSchema,
  type Profile,
  type ProfileContext,
  type ProfileInput,
  type StoredState
} from "./types.js";

export interface ProfileStore {
  listProfiles(): Promise<Profile[]>;
  getProfile(profileId: string): Promise<Profile | undefined>;
  saveProfile(profile: ProfileInput): Promise<Profile>;
  deleteProfile(profileId: string): Promise<boolean>;
  openContext(profileId: string, ttlMinutes: number): Promise<ProfileContext>;
  getContext(contextId: string): Promise<ProfileContext | undefined>;
  closeContext(contextId: string): Promise<boolean>;
}

export function defaultDataFile(): string {
  const configured = process.env.PROFILEDECK_DATA_FILE?.trim();
  return configured || join(homedir(), ".profiledeck", "profiles.json");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

export class FileProfileStore implements ProfileStore {
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath = defaultDataFile()) {}

  async listProfiles(): Promise<Profile[]> {
    const state = await this.readState();
    return clone(state.profiles).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getProfile(profileId: string): Promise<Profile | undefined> {
    const state = await this.readState();
    const profile = state.profiles.find((item) => item.id === profileId);
    return profile ? clone(profile) : undefined;
  }

  async saveProfile(input: ProfileInput): Promise<Profile> {
    return this.mutate((state) => {
      const parsed = ProfileInputSchema.parse(input);
      const index = state.profiles.findIndex((item) => item.id === parsed.id);
      const existing = index >= 0 ? state.profiles[index] : undefined;

      if (existing && parsed.revision === undefined) {
        throw new Error(
          `Profile revision is required when updating ${parsed.id}; current revision is ${existing.revision}.`
        );
      }

      if (existing && parsed.revision !== existing.revision) {
        throw new Error(
          `Profile revision conflict for ${parsed.id}: expected ${existing.revision}, received ${parsed.revision}.`
        );
      }

      const revision = existing ? existing.revision + 1 : 1;
      const profile = ProfileSchema.parse({ ...parsed, revision });
      if (index >= 0) {
        state.profiles[index] = profile;
      } else {
        state.profiles.push(profile);
      }
      return clone(profile);
    });
  }

  async deleteProfile(profileId: string): Promise<boolean> {
    return this.mutate((state) => {
      const exists = state.profiles.some((profile) => profile.id === profileId);
      if (!exists) {
        return false;
      }
      if (state.profiles.length <= 1) {
        throw new Error("At least one profile must remain.");
      }
      state.profiles = state.profiles.filter((profile) => profile.id !== profileId);
      state.contexts = state.contexts.filter((context) => context.profileId !== profileId);
      return true;
    });
  }

  async openContext(profileId: string, ttlMinutes: number): Promise<ProfileContext> {
    return this.mutate((state) => {
      const profile = state.profiles.find((item) => item.id === profileId);
      if (!profile) {
        throw new Error(`Unknown profile: ${profileId}.`);
      }
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + ttlMinutes * 60_000);
      const context = ProfileContextSchema.parse({
        id: randomUUID(),
        profileId: profile.id,
        profileRevision: profile.revision,
        profileSnapshot: clone(profile),
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString()
      });
      state.contexts.push(context);
      return clone(context);
    });
  }

  async getContext(contextId: string): Promise<ProfileContext | undefined> {
    const state = await this.readState();
    const context = state.contexts.find((item) => item.id === contextId);
    return context ? clone(context) : undefined;
  }

  async closeContext(contextId: string): Promise<boolean> {
    return this.mutate((state) => {
      const initialLength = state.contexts.length;
      state.contexts = state.contexts.filter((context) => context.id !== contextId);
      return state.contexts.length !== initialLength;
    });
  }

  private async readState(): Promise<StoredState> {
    await this.mutationQueue;
    const state = await this.loadFromDisk();
    this.pruneExpired(state);
    return state;
  }

  private async mutate<T>(operation: (state: StoredState) => Promise<T> | T): Promise<T> {
    let result!: T;
    const run = this.mutationQueue.then(() =>
      this.withFileLock(async () => {
        const state = await this.loadFromDisk();
        this.pruneExpired(state);
        result = await operation(state);
        await this.writeState(state);
      })
    );
    this.mutationQueue = run.then(
      () => undefined,
      () => undefined
    );
    await run;
    return result;
  }

  private async withFileLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const release = await lockfile.lock(this.filePath, {
      realpath: false,
      stale: 10_000,
      update: 2_000,
      retries: {
        retries: 20,
        factor: 1.2,
        minTimeout: 25,
        maxTimeout: 250,
        randomize: true
      }
    });
    try {
      return await operation();
    } finally {
      await release();
    }
  }

  private backupPath(): string {
    return `${this.filePath}.bak`;
  }

  private async loadFromDisk(): Promise<StoredState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return StoredStateSchema.parse(JSON.parse(raw));
    } catch (error) {
      if (errorCode(error) !== "ENOENT") {
        throw error;
      }
    }

    try {
      const backup = await readFile(this.backupPath(), "utf8");
      return StoredStateSchema.parse(JSON.parse(backup));
    } catch (error) {
      if (errorCode(error) !== "ENOENT") {
        throw error;
      }
    }

    return createDefaultState();
  }

  private async writeState(state: StoredState): Promise<void> {
    const validated = StoredStateSchema.parse(state);
    const directory = dirname(this.filePath);
    const backupPath = this.backupPath();
    await mkdir(directory, { recursive: true });
    const temporaryPath = join(
      directory,
      `.${basename(this.filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`
    );
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });

    try {
      await rename(temporaryPath, this.filePath);
      await rm(backupPath, { force: true });
      return;
    } catch (error) {
      if (!["EACCES", "EEXIST", "EPERM"].includes(errorCode(error) ?? "")) {
        await rm(temporaryPath, { force: true });
        throw error;
      }
    }

    await rm(backupPath, { force: true });
    let movedOriginal = false;
    try {
      await rename(this.filePath, backupPath);
      movedOriginal = true;
    } catch (error) {
      if (errorCode(error) !== "ENOENT") {
        await rm(temporaryPath, { force: true });
        throw error;
      }
    }

    try {
      await rename(temporaryPath, this.filePath);
      await rm(backupPath, { force: true });
    } catch (writeError) {
      if (movedOriginal) {
        try {
          await rename(backupPath, this.filePath);
        } catch (restoreError) {
          throw new AggregateError(
            [writeError, restoreError],
            "ProfileDeck could not commit or restore the profile data file."
          );
        }
      }
      throw writeError;
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  private pruneExpired(state: StoredState): void {
    const now = Date.now();
    state.contexts = state.contexts.filter(
      (context) => Date.parse(context.expiresAt) > now
    );
  }
}
