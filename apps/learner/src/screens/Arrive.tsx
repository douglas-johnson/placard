import * as MediaLibrary from 'expo-media-library';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useInsets } from '../insets';
import { awaitFix, type Gps } from '../location';
import { nearby, slugify, type Venue } from '../registry';
import { startTake, type FieldLog, type Take, type VenueRef } from '../take';
import { type, usePalette } from '../theme';
import { Button, Chip, ChipRow, Field, H1, H2, P, Rule, Screen } from '../ui';

/**
 * Arrival: where are we, and the thirty-second field log. The fix is awaited here —
 * the one place in the app that waits on GPS — because a venue match is worth a few
 * seconds at the door and nothing at the shutter (field-beta §3).
 *
 * A venue the tester adds is a claim with source `tester` and low confidence, and it
 * stays that way until someone checks it against the institution (constraint 2).
 */
type Stage = 'locating' | 'choose' | 'add' | 'log';

const FREE_VIA = ['Always free', 'Free day', 'Library pass', 'Paid', 'Member'];
const PHOTOGRAPHY: { value: FieldLog['photography']; label: string }[] = [
  { value: 'permitted', label: 'Permitted' },
  { value: 'permanent_only', label: 'Permanent collection only' },
  { value: 'prohibited', label: 'Prohibited' },
  { value: 'unknown', label: "Didn't see a sign" },
];

export function Arrive({ onStarted }: { onStarted: (take: Take) => void }) {
  const p = usePalette();
  const insets = useInsets();
  const [stage, setStage] = useState<Stage>('locating');
  const [fix, setFix] = useState<Gps | null>(null);
  const [candidates, setCandidates] = useState<{ venue: Venue; distance: number }[]>([]);
  const [venue, setVenue] = useState<VenueRef | null>(null);
  const [added, setAdded] = useState<{ name: string; website: string | null } | null>(null);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [freeVia, setFreeVia] = useState<string | null>(null);
  const [freeViaOther, setFreeViaOther] = useState('');
  const [photography, setPhotography] = useState<FieldLog['photography']>('unknown');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const f = await awaitFix();
      if (cancelled) return;
      setFix(f);
      const near = f ? nearby(f) : [];
      setCandidates(near);
      setStage(near.length > 0 ? 'choose' : 'add');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = (c: { venue: Venue; distance: number }) => {
    setVenue({ slug: c.venue.slug, name: c.venue.name, source: 'registry', distance_m: Math.round(c.distance) });
    setAdded(null);
    setStage('log');
  };

  const addVenue = () => {
    const n = name.trim();
    setVenue({ slug: slugify(n), name: n, source: 'tester', distance_m: null });
    setAdded({ name: n, website: website.trim() || null });
    setStage('log');
  };

  const start = () => {
    if (!venue) return;
    // Ask for the camera roll now, at the door, rather than over the first label.
    // Add-only access; the app never reads the library (D7).
    MediaLibrary.requestPermissionsAsync(true).catch(() => {});
    const take = startTake({
      venue,
      fix,
      fieldLog: {
        free_via: freeVia === 'Other' ? freeViaOther.trim() || null : freeVia,
        photography,
        notes: notes.trim() || null,
      },
      addedVenue: added ?? undefined,
    });
    onStarted(take);
  };

  const pad = { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 };

  if (stage === 'locating') {
    return (
      <Screen>
        <View style={[styles.center, pad]}>
          <ActivityIndicator color={p.text} />
          <P muted>Working out where you are…</P>
        </View>
      </Screen>
    );
  }

  if (stage === 'choose') {
    return (
      <Screen>
        <ScrollView contentContainerStyle={[styles.sheet, pad]}>
          <H1>Placard</H1>
          <P muted>Looks like you're near:</P>
          <View style={{ marginTop: 12 }}>
            {candidates.map((c) => (
              <Pressable key={c.venue.slug} onPress={() => choose(c)} style={({ pressed }) => [styles.row, { borderColor: p.rule, opacity: pressed ? 0.6 : 1 }]}>
                <Text style={[type.body, { color: p.text, fontWeight: '600' }]}>{c.venue.name}</Text>
                <Text style={[type.small, { color: p.muted }]}>{Math.round(c.distance)} m</Text>
              </Pressable>
            ))}
          </View>
          <Button label="Somewhere else" tone="secondary" onPress={() => setStage('add')} style={{ marginTop: 20 }} />
        </ScrollView>
      </Screen>
    );
  }

  if (stage === 'add') {
    return (
      <Screen>
        <ScrollView contentContainerStyle={[styles.sheet, pad]} keyboardShouldPersistTaps="handled">
          <H1>Placard</H1>
          <H2>Where are you?</H2>
          <P muted>
            {fix
              ? 'Nothing in the registry is near this spot yet, which is how the registry grows.'
              : 'No position fix, so nothing to match against. Name the venue and carry on — the frames still get everything else.'}
          </P>
          <Field label="Venue name, as displayed" value={name} onChangeText={setName} placeholder="Museum of the City of New York" autoFocus />
          <Field label="Website, if you know it" value={website} onChangeText={setWebsite} placeholder="optional" autoCapitalize="none" keyboardType="url" />
          <Button label="This is it" onPress={addVenue} disabled={name.trim().length < 2} style={{ marginTop: 24 }} />
          {candidates.length > 0 ? <Button label="Back to the list" tone="quiet" onPress={() => setStage('choose')} /> : null}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.sheet, pad]} keyboardShouldPersistTaps="handled">
        <H2>{venue?.name}</H2>
        <P muted>Thirty seconds of field log, then the door.</P>
        <Rule />
        <Text style={[type.small, { color: p.muted }]}>How did you get in?</Text>
        <ChipRow>
          {[...FREE_VIA, 'Other'].map((f) => (
            <Chip key={f} label={f} on={freeVia === f} onPress={() => setFreeVia(f)} />
          ))}
        </ChipRow>
        {freeVia === 'Other' ? <Field label="How?" value={freeViaOther} onChangeText={setFreeViaOther} /> : null}
        <Text style={[type.small, { color: p.muted, marginTop: 16 }]}>Photography</Text>
        <ChipRow>
          {PHOTOGRAPHY.map((o) => (
            <Chip key={o.value} label={o.label} on={photography === o.value} onPress={() => setPhotography(o.value)} />
          ))}
        </ChipRow>
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Bilingual labels; vinyl in the lobby; checklist at the desk…" multiline />
        <Button label="Start" onPress={start} style={{ marginTop: 24 }} />
        <Button label="Different venue" tone="quiet" onPress={() => setStage(candidates.length > 0 ? 'choose' : 'add')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
});
