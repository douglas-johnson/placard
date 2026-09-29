/**
 * The upload queue (field-beta §4, D38, D43). A take's frames and manifest records
 * leave the phone for services/ingest/, which signs a PUT straight to placard-raw for
 * each frame and writes each record as its own object. The app never holds a bucket
 * credential, only the build's token and a contributor ID it made up.
 *
 * Capture never waits on this. Nothing here runs on the capture path. The queue
 * drains on its own whenever there is signal (D43), and a failure only means it
 * tries again later. Nothing local is ever deleted: the manifest stays the app's only
 * state, and what has been sent is kept in a separate ledger beside it
 * (`uploads.ndjson`), so the manifest a tester shares is still exactly the one the
 * app wrote.
 *
 * Opt-in, per phone, off by default, until F1's consent screen exists (D43). And not
 * retroactive: only visits started while sending was on are sent. Consent given today
 * does not cover a visit shot before it, and a take already on the phone may hold
 * something that was redacted elsewhere but never on the device — as the Met take's
 * P.S. Art label did until it could be removed on the phone (D41).
 */
import { File, Paths, UploadTask } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { listTakes, manifestLines, onAppend, type Take } from './take';

const INGEST_URL = (process.env.EXPO_PUBLIC_INGEST_URL ?? '').replace(/\/$/, '');
const UPLOAD_TOKEN = process.env.EXPO_PUBLIC_UPLOAD_TOKEN ?? '';

/** Whether this build was bundled with somewhere to send to. */
export const uploadAvailable = INGEST_URL.length > 0 && UPLOAD_TOKEN.length > 0;

// ---------------------------------------------------------------------------
// Identity and the opt-in, in one small file. The ID is the only identifier the
// server ever sees (field-beta §3); nothing about the person goes with it.

type Contributor = {
  v: 1;
  id: string;
  created: string;
  upload: boolean;
  /** Each span during which sending was on. A visit is sent only if it started inside one. */
  upload_periods: { from: string; to: string | null }[];
};

const contributorFile = () => new File(Paths.document, 'contributor.json');

function randomId(): string {
  // 16 base32 characters, 80 bits. React Native has no crypto.getRandomValues, and
  // this ID only namespaces a contributor's keys, so Math.random is enough.
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let s = '';
  for (let i = 0; i < 16; i += 1) s += alphabet[Math.floor(Math.random() * 32)];
  return s;
}

export function contributor(): Contributor {
  const f = contributorFile();
  if (f.exists) {
    try {
      return JSON.parse(f.textSync()) as Contributor;
    } catch {
      // Unreadable: fall through and make a new one. A new ID is a new prefix, not a
      // collision, so nothing already sent is at risk.
    }
  }
  const c: Contributor = {
    v: 1,
    id: randomId(),
    created: new Date().toISOString(),
    upload: false,
    upload_periods: [],
  };
  if (!f.exists) f.create({ intermediates: true });
  f.write(JSON.stringify(c));
  return c;
}

export function setUploading(on: boolean): void {
  const c = contributor();
  const now = new Date().toISOString();
  const periods = [...(c.upload_periods ?? [])];
  const last = periods[periods.length - 1];
  if (on && !(last && last.to == null)) periods.push({ from: now, to: null });
  if (!on && last && last.to == null) periods[periods.length - 1] = { ...last, to: now };
  contributorFile().write(JSON.stringify({ ...c, upload: on, upload_periods: periods }));
  failures = 0;
  refused = false;
  publish();
  if (on) kick(0);
}

// ---------------------------------------------------------------------------
// The ledger: what the server has acknowledged, per take. Append-only, like the
// manifest, and replayed the same way.

type LedgerEntry = { records: number[] } | { frame: string } | { conflict: string; reason: string };

type Ledger = { records: Set<number>; frames: Set<string>; conflicts: Map<string, string> };

const ledgerOf = (take: Take) => new File(take.dir, 'uploads.ndjson');

function readLedger(take: Take): Ledger {
  const l: Ledger = { records: new Set(), frames: new Set(), conflicts: new Map() };
  const f = ledgerOf(take);
  if (!f.exists) return l;
  for (const line of f.textSync().split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as LedgerEntry;
      if ('records' in e) e.records.forEach((s) => l.records.add(s));
      else if ('frame' in e) l.frames.add(e.frame);
      else if ('conflict' in e) l.conflicts.set(e.conflict, e.reason);
    } catch {
      // torn line: the entry is re-earned on the next drain
    }
  }
  return l;
}

function note(take: Take, entry: LedgerEntry): void {
  const f = ledgerOf(take);
  if (!f.exists) f.create();
  f.write(JSON.stringify(entry) + '\n', { append: true });
}

/**
 * Whether anything of this frame has already left the phone: the image, its frame
 * record, or an ocr record that read it. Records go first, so the text usually
 * arrives before the photo does. Removing a photo on the phone (D41) doesn't reach
 * the bucket, so the screen says when tools/redact is needed as well (D42).
 */
export function sentToCorpus(take: Take, frame: string): boolean {
  const ledger = readLedger(take);
  if (ledger.frames.has(frame)) return true;
  return manifestLines(take).some(
    ({ seq, record }) =>
      ledger.records.has(seq) &&
      ((record.type === 'frame' && record.frame === frame) ||
        (record.type === 'ocr' && record.frame === frame)),
  );
}

// ---------------------------------------------------------------------------
// Status, for the screens.

export type UploadState = 'unavailable' | 'off' | 'idle' | 'sending' | 'waiting' | 'refused';

export type UploadStatus = {
  state: UploadState;
  /** Frames not yet acknowledged, across every take on the phone. Goes down, never shows a total. */
  frames: number;
  records: number;
  /** Items the server refused for good — a conflict is never retried (D35). */
  conflicts: number;
};

let status: UploadStatus = {
  state: uploadAvailable ? 'off' : 'unavailable',
  frames: 0,
  records: 0,
  conflicts: 0,
};
const listeners = new Set<(s: UploadStatus) => void>();

function publish(patch: Partial<UploadStatus> = {}): void {
  status = { ...status, ...patch };
  if (!uploadAvailable) status.state = 'unavailable';
  else if (!contributor().upload) status.state = 'off';
  else if (refused) status.state = 'refused';
  else if (status.state === 'off' || status.state === 'unavailable' || status.state === 'refused')
    status.state = 'idle';
  listeners.forEach((l) => l(status));
}

export function useUploadStatus(): UploadStatus {
  const [s, set] = useState(status);
  useEffect(() => {
    listeners.add(set);
    // Catches an update between render and subscribe. useSyncExternalStore is the
    // proper form, left until after the first real upload (D46).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    set(status);
    return () => {
      listeners.delete(set);
    };
  }, []);
  return s;
}

// ---------------------------------------------------------------------------
// Draining.

class Refused extends Error {}
class Offline extends Error {}

async function api<T>(path: string, body: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${INGEST_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPLOAD_TOKEN}`,
        'X-Placard-Contributor': contributor().id,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Offline(String(e));
  }
  if (r.status === 401) throw new Refused('token refused');
  if (r.status === 409) throw Object.assign(new Error('conflict'), { conflict: await r.text() });
  if (!r.ok) throw new Offline(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

type Pending = {
  take: Take;
  ledger: Ledger;
  lines: { seq: number; line: string }[];
  frames: { frame: string; file: string }[];
};

/** Visits started while sending was on — the only ones ever sent. */
function eligible(take: Take): boolean {
  return (contributor().upload_periods ?? []).some(
    (p) => take.started >= p.from && (p.to == null || take.started < p.to),
  );
}

function pending(): Pending[] {
  // Oldest take first: a finished visit shouldn't wait behind the one in progress.
  return listTakes()
    .filter(eligible)
    .reverse()
    .map((take) => {
      const ledger = readLedger(take);
      const all = manifestLines(take);
      const lines = all.filter(
        (l) => !ledger.records.has(l.seq) && !ledger.conflicts.has(`r${l.seq}`),
      );
      const frames = all
        .map((l) => l.record)
        .flatMap((r) => (r.type === 'frame' && r.file ? [{ frame: r.frame, file: r.file }] : []))
        .filter((f) => !ledger.frames.has(f.frame) && !ledger.conflicts.has(f.frame));
      return { take, ledger, lines, frames };
    });
}

function count(ps: Pending[]): Pick<UploadStatus, 'frames' | 'records' | 'conflicts'> {
  return {
    frames: ps.reduce((n, p) => n + p.frames.length, 0),
    records: ps.reduce((n, p) => n + p.lines.length, 0),
    conflicts: ps.reduce((n, p) => n + p.ledger.conflicts.size, 0),
  };
}

function hexToBase64(hex: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = hex.match(/../g)!.map((h) => parseInt(h, 16));
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = bytes.slice(i, i + 3);
    const n = (a << 16) | (b << 8) | c;
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? chars[n & 63] : '=';
  }
  return out;
}

async function sendRecords(p: Pending): Promise<void> {
  for (let i = 0; i < p.lines.length; i += 50) {
    const batch = p.lines.slice(i, i + 50);
    const r = await api<{
      stored: number[];
      conflicts: number[];
      rejected: { index: number; reason: string }[];
    }>('/v1/records', { take: p.take.id, lines: batch.map((l) => l.line) });
    if (r.stored.length) note(p.take, { records: r.stored });
    r.conflicts.forEach((seq) =>
      note(p.take, { conflict: `r${seq}`, reason: 'record differs from the one already stored' }),
    );
    r.rejected.forEach((x) =>
      note(p.take, { conflict: `r${batch[x.index].seq}`, reason: x.reason }),
    );
  }
}

async function sendFrame(take: Take, f: { frame: string; file: string }): Promise<void> {
  const file = new File(take.dir, f.file);
  if (!file.exists) {
    // Only a redaction removes a frame (D4 amendment), and it isn't coming back.
    note(take, { conflict: f.frame, reason: 'file missing on the phone' });
    return;
  }
  const info = file.info({ md5: true });
  if (!info.md5 || !info.size) throw new Offline('could not hash the frame');
  const claim = {
    take: take.id,
    frame: f.frame,
    file: f.file,
    bytes: info.size,
    md5: hexToBase64(info.md5),
  };
  const r = await api<
    { status: 'stored' } | { status: 'upload'; url: string; headers: Record<string, string> }
  >('/v1/frames', claim);
  if (r.status === 'upload') {
    // 'background': the transfer carries on if the screen locks. If the app is killed
    // the promise is lost, and the next drain asks again — ingest recognises a PUT
    // that landed without its confirmation.
    const task = new UploadTask(file, r.url, {
      httpMethod: 'PUT',
      headers: r.headers,
      sessionType: 'background',
    });
    const put = await task.uploadAsync().catch((e) => {
      throw new Offline(String(e));
    });
    task.release();
    if (put.status < 200 || put.status >= 300) throw new Offline(`PUT ${put.status}`);
    const done = await api<{ status: 'stored' | 'missing' }>('/v1/frames/complete', {
      take: take.id,
      frame: f.frame,
    });
    if (done.status !== 'stored') throw new Offline('frame not visible yet');
  }
  note(take, { frame: f.frame });
}

let running = false;
let refused = false;
let failures = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

async function drain(): Promise<void> {
  if (running || !uploadAvailable || !contributor().upload || refused) return;
  running = true;
  let ps = pending();
  publish({ state: count(ps).frames + count(ps).records > 0 ? 'sending' : 'idle', ...count(ps) });
  try {
    // Records first: they are small, and they are what make the frames interpretable.
    for (const p of ps) if (p.lines.length) await sendRecords(p);
    for (const p of ps) {
      for (const f of p.frames) {
        try {
          await sendFrame(p.take, f);
        } catch (e) {
          if (e instanceof Error && 'conflict' in e)
            note(p.take, {
              conflict: f.frame,
              reason: String((e as { conflict: string }).conflict).slice(0, 200),
            });
          else throw e;
        }
        publish(count(pending()));
      }
    }
    failures = 0;
    ps = pending();
    publish({ state: 'idle', ...count(ps) });
  } catch (e) {
    if (e instanceof Refused) {
      refused = true;
      publish({ state: 'refused' });
    } else {
      failures += 1;
      console.warn('[upload] will retry', String(e));
      publish({ state: 'waiting', ...count(pending()) });
      // 30 s, 1, 2, 4… capped at 10 minutes. Signal in a museum comes and goes.
      kick(Math.min(30_000 * 2 ** (failures - 1), 600_000));
    }
  } finally {
    running = false;
  }
}

/** Ask for a drain after `delay` ms; a sooner request replaces a later one. */
export function kick(delay = 3_000): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    drain().catch((e) => console.warn('[upload] drain failed', e));
  }, delay);
}

let started = false;

/** Called once from App: drain on launch, on returning to the foreground, and a few seconds after anything is written. */
export function startUploads(): void {
  if (started) return;
  started = true;
  publish(count(pending()));
  AppState.addEventListener('change', (s) => {
    if (s === 'active') {
      refused = false; // a new update may have brought a new token
      kick(1_000);
    }
  });
  onAppend(() => kick());
  kick(1_000);
}
