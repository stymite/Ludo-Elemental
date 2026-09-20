import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Screen, ScreenHeader, Button, Card, Divider, SectionLabel,
  ErrorBanner, StateBlock, Chip, ICON, Rise
} from '../components/ui';
import { COLORS, SEAT, SEAT_ORDER, TYPE, SPACE, RADIUS, TARGET } from '../theme';
import { MODES } from '../online';

const labelFor = (mode) => MODES[mode]?.label || mode;

// The dot carries the colour that seat will play, which is the only place the seat
// colours are meaningful before the deal. An empty seat is a seat still waiting for a
// person — online games are people only, so there is nothing else it could be.
const SeatRow = ({ index, member, isHost }) => {
  const colour = SEAT[SEAT_ORDER[index]];
  return (
    <View style={s.seatRow}>
      <View
        style={[
          s.seatDot,
          member ? { backgroundColor: colour } : { borderColor: COLORS.line, borderWidth: 1.5 }
        ]}
      />
      <Text style={[s.seatName, !member && s.seatEmpty]} numberOfLines={1}>
        {member ? (member.name || 'Player') : 'Open seat'}
      </Text>
      {member?.isYou ? <Chip tone="accent">YOU</Chip> : null}
      {isHost && member ? <Chip>HOST</Chip> : null}
    </View>
  );
};

/**
 * One screen for both ways into an online game.
 *
 * kind 'MATCH' sits in the queue; kind 'ROOM' creates a code or joins a friend's.
 *
 * Colours are deliberately not promised here: they are dealt when the game starts, so
 * showing one in the lobby would be a lie.
 */
const LobbyScreen = ({
  kind, mode, code, members = [], required = 4, isHost,
  searching = false, waited = 0, found = null, noMatch = false,
  error, busy, onCreate, onJoin, onStart, onSearchAgain, onBack, onDismissError
}) => {
  const [entered, setEntered] = useState('');
  const inRoom = Boolean(code);
  const full = members.length >= required;

  const roster = Array.from({ length: required }, (_, i) =>
    members.find(m => m.seat === i) || null);

  const rosterCard = (
    <Card style={s.roster}>
      {roster.map((member, i) => (
        <View key={i}>
          {i > 0 ? <Divider /> : null}
          <SeatRow index={i} member={member} isHost={i === 0} />
        </View>
      ))}
    </Card>
  );

  return (
    <Screen scroll>
      <ScreenHeader
        title={kind === 'MATCH' ? 'Play Online' : 'Party Code'}
        onBack={onBack}
        titleStyle={{ fontFamily: 'Aligarh', fontSize: 38, textAlign: 'center', lineHeight: 45, paddingTop: 10 }}
      />

      <ErrorBanner onDismiss={onDismissError}>{error}</ErrorBanner>

      {kind === 'MATCH' ? (
        <>
          <StateBlock
            busy={searching}
            icon={noMatch ? 'time-outline' : 'search'}
            title={
              noMatch ? 'No matches found'
                : searching ? 'Looking for players'
                  : 'Starting search'
            }
            detail={
              noMatch
                ? `Nobody else was looking for ${labelFor(mode)}. Try again, or come back later.`
                : searching
                  ? `${found === null ? members.length : found} of ${required} found, ${waited}s elapsed`
                  : `You will be matched with anyone else waiting for ${labelFor(mode)}.`
            }
          />

          {searching ? rosterCard : null}

          {noMatch ? (
            <Rise style={s.backfill}>
              <Button
                label="Search again"
                tone="primary"
                icon="refresh"
                onPress={onSearchAgain}
              />
            </Rise>
          ) : null}
        </>
      ) : !inRoom ? (
        <>
          <SectionLabel>START A ROOM</SectionLabel>
          <Button
            label="Create room"
            tone="primary"
            icon="add-circle-outline"
            onPress={onCreate}
            loading={busy === 'create'}
            disabled={Boolean(busy)}
          />

          <View style={s.orRow}>
            <View style={s.orLine} />
            <Text style={s.orText}>OR</Text>
            <View style={s.orLine} />
          </View>

          <SectionLabel>JOIN A FRIEND</SectionLabel>
          <Text style={s.inputLabel}>Room code</Text>
          <TextInput
            value={entered}
            onChangeText={t => setEntered(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="ABC12"
            placeholderTextColor={COLORS.textLow}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={5}
            style={s.input}
            returnKeyType="go"
            onSubmitEditing={() => entered.length === 5 && onJoin(entered)}
            accessibilityLabel="Room code"
          />
          <Button
            label="Join room"
            tone="secondary"
            onPress={() => onJoin(entered)}
            loading={busy === 'join'}
            disabled={Boolean(busy) || entered.length < 5}
            style={s.gap}
          />
        </>
      ) : (
        <>
          <SectionLabel>SHARE THIS CODE</SectionLabel>
          <View style={s.codeBox}>
            <Text
              selectable
              style={s.code}
              accessibilityLabel={`Room code ${code.split('').join(' ')}`}
            >
              {code}
            </Text>
            <View style={s.codeHint}>
              <Ionicons name="people-outline" size={ICON.sm} color={COLORS.textLow} />
              <Text style={s.codeHintText}>
                {members.length} of {required} joined
              </Text>
            </View>
          </View>

          <SectionLabel>PLAYERS</SectionLabel>
          {rosterCard}

          {isHost ? (
            <View style={s.hostActions}>
              <Button
                label={full ? 'Start game' : 'Start with bots'}
                tone="primary"
                icon="play"
                onPress={onStart}
                loading={busy === 'start'}
                disabled={Boolean(busy)}
                accessibilityHint={
                  full ? 'Begin the match' : 'Open seats will be played by the computer'
                }
              />
              {!full ? (
                <Text style={s.fine}>
                  You do not have to wait for a full room. Open seats become bots.
                </Text>
              ) : null}
            </View>
          ) : (
            <Rise>
              <StateBlock
                busy
                title="Waiting for the host"
                detail="The game starts as soon as they begin it."
              />
            </Rise>
          )}
        </>
      )}
    </Screen>
  );
};

const s = StyleSheet.create({
  orRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginVertical: SPACE.xl },
  orLine: { flex: 1, height: 1, backgroundColor: '#FFFFFF', opacity: 0.6 },
  orText: { ...TYPE.caption, fontFamily: 'Nunito-Bold', color: '#FFFFFF' },

  inputLabel: { ...TYPE.label, fontFamily: 'Nunito-Bold', color: COLORS.textMid, marginBottom: SPACE.sm },
  input: {
    backgroundColor: COLORS.surfaceHi, borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line, borderRadius: RADIUS.sm,
    minHeight: TARGET.comfortable, paddingHorizontal: SPACE.lg,
    color: COLORS.textHi, fontSize: 24, fontWeight: '700',
    letterSpacing: 8, textAlign: 'center'
  },
  gap: { marginTop: SPACE.md },

  codeBox: {
    backgroundColor: COLORS.surface, borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.accent, borderRadius: RADIUS.md,
    paddingVertical: SPACE.xl, alignItems: 'center', gap: SPACE.sm
  },
  code: { fontSize: 40, lineHeight: 46, fontWeight: '800', color: COLORS.accent, letterSpacing: 10 },
  codeHint: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  codeHintText: { ...TYPE.body, fontSize: 12, color: COLORS.textLow },

  roster: { paddingVertical: SPACE.xs },
  seatRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    minHeight: TARGET.min
  },
  seatDot: { width: 10, height: 10, borderRadius: RADIUS.pill },
  seatName: { ...TYPE.body, color: COLORS.textHi, flex: 1 },
  seatEmpty: { color: COLORS.textLow },

  hostActions: { marginTop: SPACE.xl, gap: SPACE.sm },
  fine: { ...TYPE.body, fontSize: 12, color: COLORS.textLow, textAlign: 'center' },

  backfill: { marginTop: SPACE.lg, gap: SPACE.md }
});

export default LobbyScreen;
