/**
 * One-time Pudur Premier League reset. Reads only unless --apply is supplied.
 *
 * Prepare: node scripts/reset-tournament.mjs --manifest /tmp/ppl-reset.json
 * Apply:   node scripts/reset-tournament.mjs --apply --manifest /tmp/ppl-reset.json --project dicgutkvjiccetbvbxjd
 *
 * The manifest holds identifiers and storage paths, never player details or keys.
 * It is created with owner-only permissions. No player-data backup is made.
 * Old teams are removed. Schema, admin accounts, and auction settings are preserved.
 */
import { readFile, writeFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());

const PROJECT = "dicgutkvjiccetbvbxjd";
const EXPECTED_PLAYERS = 154;
const EXPECTED_TEAMS = 12;
const BUCKETS = ["profile-pictures", "payment-screenshots"];
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
};
const manifestPath = option("--manifest");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing server-side Supabase configuration.");
if (new URL(url).hostname !== `${PROJECT}.supabase.co`)
  throw new Error("Project mismatch: refusing to connect to a different project.");
if (apply && (!manifestPath || option("--project") !== PROJECT))
  throw new Error("Apply requires a reviewed --manifest and the exact --project reference.");

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (resource, options) =>
      fetch(resource, { ...options, signal: AbortSignal.timeout(30000) }),
  },
});

function check(error, operation) {
  // Do not log server error details: they can contain record identifiers or data.
  if (error) throw new Error(`${operation} failed (${error.code ?? error.status ?? "remote error"}).`);
}

async function rows(table, columns) {
  const result = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from(table).select(columns).order("id").range(start, start + 999);
    check(error, `Read ${table}`);
    result.push(...data);
    if (data.length < 1000) return result;
  }
}

async function listFiles(bucket, prefix = "") {
  const result = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    check(error, `List ${bucket}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) result.push({ path, objectId: item.id });
      else result.push(...await listFiles(bucket, path));
    }
    if (data.length < 1000) return result;
  }
}

function storageReference(value, bucket) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== `${PROJECT}.supabase.co`) return null;
    const marker = `/${bucket}/`;
    const offset = parsed.pathname.indexOf(marker);
    return offset < 0 ? null : decodeURIComponent(parsed.pathname.slice(offset + marker.length));
  } catch {
    return value;
  }
}

async function snapshot() {
  const [players, teams, state, ...storage] = await Promise.all([
    rows("players", "id"),
    rows("teams", "id,logo_url"),
    rows("auction_state", "id,status,base_price,bid_increment,default_team_budget"),
    ...BUCKETS.map(async (bucket) => ({ bucket, files: await listFiles(bucket) })),
  ]);
  if (state.length !== 1 || state[0].id !== "current")
    throw new Error("Unexpected auction singleton: refusing reset.");
  const files = {};
  const protectedFiles = {};
  for (const bucket of BUCKETS) {
    const protectedPaths = new Set(teams.map((team) => storageReference(team.logo_url, bucket)).filter(Boolean));
    const entries = storage.find((item) => item.bucket === bucket).files;
    files[bucket] = entries.filter((file) => !protectedPaths.has(file.path));
    protectedFiles[bucket] = entries.filter((file) => protectedPaths.has(file.path));
  }
  return {
    version: 1,
    project: PROJECT,
    createdAt: new Date().toISOString(),
    playerIds: players.map((player) => player.id),
    teamIds: teams.map((team) => team.id),
    files,
    protectedFiles,
    auctionSettings: {
      base_price: state[0].base_price,
      bid_increment: state[0].bid_increment,
      default_team_budget: state[0].default_team_budget,
    },
  };
}

function summary(manifest) {
  return {
    project: PROJECT,
    players: manifest.playerIds.length,
    teamsToRemove: manifest.teamIds.length,
    storage: BUCKETS.map((bucket) => ({
      bucket,
      filesToRemove: manifest.files[bucket].length,
      teamFilesPreserved: manifest.protectedFiles[bucket].length,
    })),
    auctionSettingsPreserved: manifest.auctionSettings,
    reset: "Clear players and their uploads; clear auction block and set idle; remove old teams and pools.",
  };
}

function validateManifest(manifest) {
  if (manifest.version !== 1 || manifest.project !== PROJECT)
    throw new Error("Invalid manifest/project.");
  if (manifest.playerIds?.length !== EXPECTED_PLAYERS || manifest.teamIds?.length !== EXPECTED_TEAMS)
    throw new Error("Manifest does not match the reviewed original tournament counts.");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const ids of [manifest.playerIds, manifest.teamIds]) {
    if (new Set(ids).size !== ids.length || ids.some((id) => !uuid.test(id)))
      throw new Error("Invalid or duplicate identifiers in manifest.");
  }
  for (const bucket of BUCKETS) {
    if (!Array.isArray(manifest.files?.[bucket]) || !Array.isArray(manifest.protectedFiles?.[bucket]))
      throw new Error("Invalid storage manifest.");
    for (const file of [...manifest.files[bucket], ...manifest.protectedFiles[bucket]]) {
      if (typeof file.path !== "string" || !file.path || !uuid.test(file.objectId))
        throw new Error("Invalid storage entry.");
    }
  }
  const age = Date.now() - Date.parse(manifest.createdAt);
  if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000)
    throw new Error("Manifest expired. Prepare and review a new manifest.");
}

async function applyManifest(manifest) {
  validateManifest(manifest);
  const current = await snapshot();
  const approvedPlayerIds = new Set(manifest.playerIds);
  const approvedTeamIds = new Set(manifest.teamIds);
  // A previously interrupted reset can be resumed, but new registrations or
  // teams require review. Deletions remain bounded to the original snapshot.
  if (current.playerIds.some((id) => !approvedPlayerIds.has(id)) || current.teamIds.some((id) => !approvedTeamIds.has(id)))
    throw new Error("New players or teams appeared after review; stop and review again.");
  if (JSON.stringify(current.auctionSettings) !== JSON.stringify(manifest.auctionSettings))
    throw new Error("Auction settings changed after review; refusing reset.");
  for (const bucket of BUCKETS) {
    const protectedPaths = new Set(current.protectedFiles[bucket].map((file) => file.path));
    const currentObjects = new Map(current.files[bucket].map((file) => [file.path, file.objectId]));
    for (const file of manifest.files[bucket]) {
      if (protectedPaths.has(file.path)) throw new Error("A reviewed player file is now used by a team.");
      if (currentObjects.has(file.path) && currentObjects.get(file.path) !== file.objectId)
        throw new Error("A storage object was replaced after review; refusing reset.");
    }
  }

  const { error: stateError } = await supabase.from("auction_state").update({
    current_player_id: null,
    current_bidder_team_id: null,
    current_bid: 0,
    status: "idle",
  }).eq("id", "current");
  check(stateError, "Reset auction state");
  for (let start = 0; start < manifest.playerIds.length; start += 100) {
    const { error } = await supabase.from("players").delete().in("id", manifest.playerIds.slice(start, start + 100));
    check(error, "Delete reviewed player batch");
  }
  for (const bucket of BUCKETS) {
    const paths = manifest.files[bucket].map((file) => file.path);
    for (let start = 0; start < paths.length; start += 100) {
      const { error } = await supabase.storage.from(bucket).remove(paths.slice(start, start + 100));
      check(error, `Remove reviewed ${bucket} batch`);
    }
  }
  for (let start = 0; start < manifest.teamIds.length; start += 100) {
    const { error } = await supabase.from("teams").delete().in("id", manifest.teamIds.slice(start, start + 100));
    check(error, "Delete reviewed team batch");
  }

  const after = await snapshot();
  if (after.playerIds.some((id) => approvedPlayerIds.has(id)))
    throw new Error("Verification failed: reviewed players remain.");
  for (const bucket of BUCKETS) {
    const removedPaths = new Set(manifest.files[bucket].map((file) => file.path));
    if (after.files[bucket].some((file) => removedPaths.has(file.path)))
      throw new Error(`Verification failed: reviewed ${bucket} objects remain.`);
  }
  const [state, teams] = await Promise.all([
    rows("auction_state", "id,status,current_bid,current_player_id,current_bidder_team_id"),
    rows("teams", "id,pool,is_locked"),
  ]);
  if (state[0].status !== "idle" || state[0].current_bid !== 0 || state[0].current_player_id !== null || state[0].current_bidder_team_id !== null)
    throw new Error("Verification failed: auction did not reset.");
  if (teams.some((team) => approvedTeamIds.has(team.id)))
    throw new Error("Verification failed: reviewed teams remain.");
  if (JSON.stringify(after.auctionSettings) !== JSON.stringify(manifest.auctionSettings))
    throw new Error("Verification failed: preserved auction settings changed.");
  console.log(JSON.stringify({ mode: "applied-and-verified", remainingPlayers: after.playerIds.length, remainingStorageFiles: Object.fromEntries(BUCKETS.map((bucket) => [bucket, after.files[bucket].length + after.protectedFiles[bucket].length])), remainingTeams: after.teamIds.length, auctionStatus: "idle" }, null, 2));
}

try {
  if (apply) {
    await applyManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  } else {
    const manifest = await snapshot();
    if (manifestPath) {
      validateManifest(manifest);
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { encoding: "utf8", mode: 0o600, flag: "wx" });
    }
    console.log(JSON.stringify({ mode: "dry-run", manifestWritten: Boolean(manifestPath), ...summary(manifest) }, null, 2));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
