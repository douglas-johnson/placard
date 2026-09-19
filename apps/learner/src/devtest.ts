/**
 * Development only: walks the whole data path without a camera or a finger —
 * `xcrun simctl openurl <udid> placard://selftest`. The simulator can't be tapped
 * from a script and has no camera, and this is the part of F0 that has to be right
 * for the corpus: the take directory, the manifest, the read-back, the camera-roll
 * copy. The screens are checked by eye. Compiled out of release builds.
 */
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import * as VisionOcr from '../modules/vision-ocr';
import { findAccessionCandidates } from './accession';
import { latestFix } from './location';
import { bySlug } from './registry';
import {
  closeGroup,
  manifestFile,
  openGroup,
  recordAccession,
  recordOcr,
  saveFrame,
  startTake,
  type Take,
} from './take';

async function fixturePicture() {
  const asset = Asset.fromModule(require('../assets/fixtures/mcny-38.447.4.jpg'));
  await asset.downloadAsync();
  const copy = new File(Paths.cache, `selftest-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  new File(asset.localUri!).copySync(copy);
  return { uri: copy.uri, width: 1200, height: 1200, gps: latestFix() };
}

export async function runSelfTest(): Promise<Take> {
  const log = (m: string) => console.log(`[selftest] ${m}`);
  const take = startTake({
    venue: { slug: 'mcny', name: 'Museum of the City of New York', source: 'registry', distance_m: 0 },
    fix: latestFix(),
    fieldLog: { free_via: 'Always free', photography: 'permitted', notes: 'self-test' },
  });
  log(`take ${take.id} at ${take.dir.uri}`);

  const sign = await saveFrame(take, await fixturePicture(), { kind: 'venue_sign', group: null, gps: latestFix(), sign_kind: 'name' });
  log(`venue sign ${sign.id}`);

  const g = openGroup(take);
  const label = await saveFrame(take, await fixturePicture(), { kind: 'label', group: g, gps: latestFix() });
  let candidates: string[] = [];
  if (VisionOcr.isAvailable) {
    const scales = [1600, 2600, 4000].map((t) => Math.round((t / 1200) * 1000) / 1000);
    const r = await VisionOcr.recognize(label.file.uri, { scales, languages: ['en-US'] });
    candidates = findAccessionCandidates(r.observations, bySlug('mcny')?.shapes ?? []).map((c) => c.value);
    recordOcr(take, { frame: label.id, group: g, elapsed_ms: r.elapsedMs, scales, languages: ['en-US'], lines: r.observations, warnings: r.warnings, candidates });
    log(`ocr ${r.observations.length} lines in ${r.elapsedMs} ms → candidates ${JSON.stringify(candidates)}`);
  } else {
    log('ocr unavailable in this host');
  }
  recordAccession(take, { group: g, status: candidates[0] === '38.447.4' ? 'confirmed' : 'corrected', reading: candidates[0] ?? null, value: '38.447.4', candidates });
  const work = await saveFrame(take, await fixturePicture(), { kind: 'work', group: g, gps: latestFix() });
  log(`work ${work.id}`);
  closeGroup(take, g, { frames: { label: 1, work: 1, accession_crop: 0 }, no_work_reason: null, flags: [], shared_panel_count: null, hard_cases: ['reflective_glass'], note: null });

  const wall = await saveFrame(take, await fixturePicture(), { kind: 'wall_text', group: null, gps: latestFix(), linked_group: g });
  log(`wall text ${wall.id}`);

  const manifest = manifestFile(take).textSync();
  log(`manifest ${manifest.split('\n').filter(Boolean).length} records:\n${manifest}`);
  log(`files: ${take.dir.list().map((f) => f.name).join(', ')}`);
  return take;
}

