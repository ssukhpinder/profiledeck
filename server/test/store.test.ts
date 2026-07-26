import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createDefaultState } from "../src/defaults.js";
import { FileProfileStore } from "../src/store.js";

async function withTemporaryStore(
  run: (store: FileProfileStore, filePath: string, directory: string) => Promise<void>
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "profiledeck-store-test-"));
  const filePath = join(directory, "profiles.json");
  try {
    await run(new FileProfileStore(filePath), filePath, directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("returns defaults on read and persists them on the first mutation", async () => {
  await withTemporaryStore(async (store, filePath) => {
    const profiles = await store.listProfiles();

    assert.deepEqual(
      profiles.map((profile) => profile.name),
      ["Personal", "Work"]
    );

    await assert.rejects(
      readFile(filePath, "utf8"),
      (error: NodeJS.ErrnoException) => error.code === "ENOENT"
    );
    assert.equal(
      await store.closeContext("00000000-0000-4000-8000-000000000099"), false
    );
    const persisted = JSON.parse(await readFile(filePath, "utf8")) as {
      schemaVersion: number;
      profiles: Array<{ id: string; revision: number }>;
      contexts: unknown[];
    };
    assert.equal(persisted.schemaVersion, 1);
    assert.deepEqual(
      persisted.profiles.map((profile) => [profile.id, profile.revision]),
      [
        ["personal", 1],
        ["work", 1]
      ]
    );
    assert.deepEqual(persisted.contexts, []);
  });
});

test("keeps a context pinned to its original profile snapshot", async () => {
  await withTemporaryStore(async (store) => {
    const context = await store.openContext("work", 30);
    const originalDescription = context.profileSnapshot.description;
    const work = await store.getProfile("work");
    assert.ok(work);

    const updated = await store.saveProfile({
      ...work,
      description: "Updated work routing policy."
    });
    const pinned = await store.getContext(context.id);

    assert.equal(updated.revision, 2);
    assert.ok(pinned);
    assert.equal(pinned.profileRevision, 1);
    assert.equal(pinned.profileSnapshot.revision, 1);
    assert.equal(pinned.profileSnapshot.description, originalDescription);
  });
});

test("isolates returned values and independent data files", async () => {
  const firstDirectory = await mkdtemp(join(tmpdir(), "profiledeck-store-a-"));
  const secondDirectory = await mkdtemp(join(tmpdir(), "profiledeck-store-b-"));
  try {
    const firstStore = new FileProfileStore(join(firstDirectory, "profiles.json"));
    const secondStore = new FileProfileStore(join(secondDirectory, "profiles.json"));

    const firstRead = await firstStore.getProfile("personal");
    assert.ok(firstRead);
    firstRead.name = "Mutated outside the store";
    firstRead.instructions.dataHandling.push("External mutation");

    const reread = await firstStore.getProfile("personal");
    const otherStoreRead = await secondStore.getProfile("personal");
    assert.ok(reread);
    assert.ok(otherStoreRead);
    assert.equal(reread.name, "Personal");
    assert.equal(otherStoreRead.name, "Personal");
    assert.equal(reread.instructions.dataHandling.includes("External mutation"), false);

    const context = await firstStore.openContext("personal", 30);
    context.profileSnapshot.name = "Mutated context snapshot";
    const contextReread = await firstStore.getContext(context.id);
    assert.equal(contextReread?.profileSnapshot.name, "Personal");
    assert.equal(await secondStore.getContext(context.id), undefined);
  } finally {
    await Promise.all([
      rm(firstDirectory, { recursive: true, force: true }),
      rm(secondDirectory, { recursive: true, force: true })
    ]);
  }
});

test("increments revisions and rejects missing or stale optimistic updates", async () => {
  await withTemporaryStore(async (store) => {
    const work = await store.getProfile("work");
    assert.ok(work);

    const revisionTwo = await store.saveProfile({
      ...work,
      description: "Revision two."
    });
    assert.equal(revisionTwo.revision, 2);

    const { revision: _revision, ...withoutRevision } = revisionTwo;
    await assert.rejects(
      store.saveProfile({
        ...withoutRevision,
        description: "Update without a revision."
      }),
      /Profile revision is required when updating work; current revision is 2\./
    );

    await assert.rejects(
      store.saveProfile({
        ...work,
        description: "Stale update."
      }),
      /Profile revision conflict for work: expected 2, received 1\./
    );

    const persisted = await store.getProfile("work");
    assert.equal(persisted?.revision, 2);
    assert.equal(persisted?.description, "Revision two.");
  });
});

test("treats expired contexts as missing and prunes them on the next mutation", async () => {
  await withTemporaryStore(async (_store, filePath) => {
    const state = createDefaultState();
    state.contexts.push({
      id: "00000000-0000-4000-8000-000000000001",
      profileId: "work",
      profileRevision: 1,
      profileSnapshot: structuredClone(
        state.profiles.find((profile) => profile.id === "work")!
      ),
      createdAt: "2025-01-01T00:00:00.000Z",
      expiresAt: "2025-01-01T00:01:00.000Z"
    });
    await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

    const store = new FileProfileStore(filePath);
    assert.equal(
      await store.getContext("00000000-0000-4000-8000-000000000001"),
      undefined
    );

    const current = await store.openContext("work", 30);
    await store.closeContext(current.id);

    const persisted = JSON.parse(await readFile(filePath, "utf8")) as {
      contexts: unknown[];
    };
    assert.deepEqual(persisted.contexts, []);
  });
});

test("preserves unrelated updates across store instances sharing one data file", async () => {
  await withTemporaryStore(async (_store, filePath) => {
    const first = new FileProfileStore(filePath);
    const second = new FileProfileStore(filePath);
    const work = await first.getProfile("work");
    const personal = await second.getProfile("personal");
    assert.ok(work);
    assert.ok(personal);

    await first.saveProfile({ ...work, description: "Work changed by the first process." });
    await second.saveProfile({
      ...personal,
      description: "Personal changed by the second process."
    });

    const fresh = new FileProfileStore(filePath);
    const savedWork = await fresh.getProfile("work");
    const savedPersonal = await fresh.getProfile("personal");
    assert.equal(savedWork?.revision, 2);
    assert.equal(savedWork?.description, "Work changed by the first process.");
    assert.equal(savedPersonal?.revision, 2);
    assert.equal(savedPersonal?.description, "Personal changed by the second process.");
  });
});

test("serializes concurrent updates and rejects one stale revision", async () => {
  await withTemporaryStore(async (_store, filePath) => {
    const first = new FileProfileStore(filePath);
    const second = new FileProfileStore(filePath);
    const firstWork = await first.getProfile("work");
    const secondWork = await second.getProfile("work");
    assert.ok(firstWork);
    assert.ok(secondWork);

    const updates = await Promise.allSettled([
      first.saveProfile({ ...firstWork, description: "First concurrent update." }),
      second.saveProfile({ ...secondWork, description: "Second concurrent update." })
    ]);

    assert.equal(updates.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(updates.filter((result) => result.status === "rejected").length, 1);
    const rejected = updates.find((result) => result.status === "rejected");
    assert.match(String(rejected?.reason), /Profile revision conflict for work/);

    const saved = await new FileProfileStore(filePath).getProfile("work");
    assert.equal(saved?.revision, 2);
    assert.ok(
      saved?.description === "First concurrent update." ||
        saved?.description === "Second concurrent update."
    );
  });
});

test("deleting an already absent profile is idempotent", async () => {
  await withTemporaryStore(async (store) => {
    assert.equal(await store.deleteProfile("work"), true);
    assert.equal(await store.deleteProfile("work"), false);
    assert.deepEqual(
      (await store.listProfiles()).map((profile) => profile.id),
      ["personal"]
    );
  });
});
