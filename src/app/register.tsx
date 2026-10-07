import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button, Card, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { Radius, SkillColors, Spacing } from '@/constants/theme';
import { BLOCKS, slotsFromBlocks } from '@/domain/availability';
import { SKILL_LABELS, type Skill } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { registerVolunteer, signInAs, updateVolunteer, useStore } from '@/state/store';

const SKILLS: { key: Skill; help: string }[] = [
  { key: 'first_aid', help: 'Current first aid certificate' },
  { key: 'wwcc', help: 'Working With Children Check' },
  { key: 'rsa', help: 'Responsible Service of Alcohol (licensed areas)' },
  { key: 'crowd_control', help: 'Crowd management experience or licence' },
  { key: 'security_licence', help: 'Security licence' },
];
const COMMON_LANGS = ['Mandarin', 'Arabic', 'Vietnamese', 'Hindi', 'Spanish', 'Greek', 'Italian', 'Korean', 'Cantonese', 'Auslan'];

/** Volunteer registration (and skills editing for an existing volunteer). */
export default function Register() {
  const t = useTheme();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const me = useStore((s) => (edit && s.currentUserId ? s.volunteers[s.currentUserId] : undefined));
  const zones = useStore((s) => s.festival.zones);

  const [name, setName] = useState(me?.name ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [skills, setSkills] = useState<Set<Skill>>(new Set(me?.skills ?? []));
  const [langs, setLangs] = useState<Set<string>>(new Set((me?.languages ?? ['English']).filter((l) => l !== 'English')));
  const [otherLang, setOtherLang] = useState('');
  const [zoneId, setZoneId] = useState(me?.zoneId ?? zones[0].id);

  const toggle = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };

  const languages = ['English', ...langs, ...(otherLang.trim() ? [otherLang.trim()] : [])];
  const input = [styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.backgroundElement }];

  const save = () => {
    if (me) {
      updateVolunteer(me.id, { name: name.trim(), phone: phone.trim() || undefined, skills: [...skills], languages });
      router.back();
      return;
    }
    const id = registerVolunteer({
      name: name.trim(),
      phone: phone.trim() || undefined,
      skills: [...skills],
      languages,
      zoneId,
      availability: slotsFromBlocks(new Set(BLOCKS.map((b) => b.id))),
    });
    signInAs(id);
    router.dismissAll();
    router.replace('/volunteer/shift');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="title">{me ? 'My skills' : 'Register'}</Txt>
        <Button title="Cancel" variant="secondary" size="sm" onPress={() => router.back()} />
      </Row>

      <Section title="About you">
        <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={t.textSecondary} style={input} />
        <TextInput value={phone} onChangeText={setPhone} placeholder="Mobile (optional)" keyboardType="phone-pad" placeholderTextColor={t.textSecondary} style={input} />
      </Section>

      <Section title="Certifications & skills">
        <Card style={{ gap: Spacing.three }}>
          {SKILLS.map((s) => (
            <Row key={s.key} style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="body" style={{ fontWeight: '700' }} color={skills.has(s.key) ? SkillColors[s.key] : t.text}>
                  {SKILL_LABELS[s.key]}
                </Txt>
                <Txt variant="caption">{s.help}</Txt>
              </View>
              <Switch value={skills.has(s.key)} onValueChange={() => setSkills((x) => toggle(x, s.key))} trackColor={{ true: SkillColors[s.key] }} />
            </Row>
          ))}
        </Card>
      </Section>

      <Section title="Languages besides English">
        <View style={styles.chips}>
          {COMMON_LANGS.map((l) => (
            <Pressable
              key={l}
              onPress={() => setLangs((x) => toggle(x, l))}
              style={[styles.chip, { borderColor: langs.has(l) ? t.tint : t.border, backgroundColor: langs.has(l) ? `${t.tint}22` : t.backgroundElement }]}>
              <Txt variant="caption" style={{ fontWeight: langs.has(l) ? '800' : '500' }}>{l}</Txt>
            </Pressable>
          ))}
        </View>
        <TextInput value={otherLang} onChangeText={setOtherLang} placeholder="Other language" placeholderTextColor={t.textSecondary} style={input} />
      </Section>

      {!me && (
        <Section title="Preferred area">
          <View style={styles.chips}>
            {zones.map((z) => (
              <Pressable
                key={z.id}
                onPress={() => setZoneId(z.id)}
                style={[styles.chip, { borderColor: zoneId === z.id ? t.tint : t.border, backgroundColor: zoneId === z.id ? `${t.tint}22` : t.backgroundElement }]}>
                <Txt variant="caption" style={{ fontWeight: zoneId === z.id ? '800' : '500' }}>{z.name}</Txt>
              </Pressable>
            ))}
          </View>
          <Txt variant="caption">The safety lead may place you elsewhere based on skills. You can set your availability next.</Txt>
        </Section>
      )}

      <Button title={me ? 'Save' : 'Register & set availability'} size="lg" disabled={!name.trim()} onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: Radius.md, padding: 12, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
});
