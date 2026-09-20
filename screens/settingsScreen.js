import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Image, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Screen, ScreenHeader, Card, Divider, SectionLabel, Button, Chip, ICON
} from '../components/ui';
import { COLORS, TYPE, SPACE, TARGET, RADIUS } from '../theme';
import { isSupabaseConfigured } from '../supabase';

// Served by GitHub Pages from docs/privacy.html. Play needs the same URL on the
// store listing, and its #delete section is the account deletion web link.
const PRIVACY_URL = 'https://stymite.github.io/Ludo-Elemental/privacy.html';

const GoogleIcon = ({ size = 20, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path fill={color || "#4285F4"} d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <Path fill={color || "#34A853"} d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <Path fill={color || "#FBBC05"} d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <Path fill={color || "#EA4335"} d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </Svg>
);

const InfoRow = ({ label, value, tone }) => (
  <View style={s.row}>
    <Text style={s.rowLabel}>{label}</Text>
    {tone ? <Chip tone={tone}>{value}</Chip> : (
      <Text style={s.rowValue} numberOfLines={1}>{value}</Text>
    )}
  </View>
);

const LinkRow = ({ label, icon, onPress, hint, chevron = "chevron-forward" }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [s.row, pressed && s.rowPressed]}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={hint}
  >
    {icon ? <Ionicons name={icon} size={ICON.md} color={COLORS.textMid} /> : null}
    <Text style={[s.rowLabel, s.rowLink]}>{label}</Text>
    <Ionicons name={chevron} size={ICON.md} color={COLORS.textLow} />
  </Pressable>
);

const POWERS = [
  { id: 'fire', image: require('../assets/fire.png'), title: 'Fire (Red)', desc: 'The Blaze: Armed before rolling. Your token burns every enemy on the tiles it crosses, sending them back to base. (Stop signs and Ice provide shelter).' },
  { id: 'water', image: require('../assets/water.png'), title: 'Water (Blue)', desc: 'Ice Shield: Sheathes all your tokens in spiked ice. Enemies landing on a shielded token are captured! Also pulls one token out of the base. Immune to other abilities.' },
  { id: 'earth', image: require('../assets/earth.png'), title: 'Earth (Green)', desc: 'The Wall: Drops a wall on any track tile, blocking opponents. Dropping it on a safe stop sign shoves everyone sheltering there one step forward.' },
  { id: 'air', image: require('../assets/air.png'), title: 'Air (Yellow)', desc: 'The Gust: Adds 9 extra steps to whatever you roll (e.g. a 3 carries 12 steps). Note: Cannot be used to carry a token out of the yard.' }
];

const ContactForm = ({ username }) => {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    checkLimit();
  }, []);

  const checkLimit = async () => {
    try {
      const lastSent = await AsyncStorage.getItem('last_contact_time');
      if (lastSent) {
        const timeDiff = Date.now() - parseInt(lastSent, 10);
        if (timeDiff < 24 * 60 * 60 * 1000) {
          setStatus('limited');
        }
      }
    } catch (e) { }
  };

  const submit = async () => {
    if (!text.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch('https://formspree.io/f/mkjnwrgr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: username || 'Player', message: text })
      });
      if (res.ok) {
        setStatus('sent');
        await AsyncStorage.setItem('last_contact_time', Date.now().toString());
      } else {
        setStatus('error');
      }
    } catch (e) {
      setStatus('error');
    }
  };

  if (status === 'limited') {
    return <Text style={s.contactMsg}>You can only send one message every 24 hours. Thanks for your feedback!</Text>;
  }

  if (status === 'sent') {
    return <Text style={s.contactMsg}>Message sent! Thanks for reaching out.</Text>;
  }

  return (
    <View style={s.contactContainer}>
      <TextInput
        style={s.contactInput}
        placeholder="Found a bug or have an idea?"
        placeholderTextColor={COLORS.textMid}
        multiline
        value={text}
        onChangeText={setText}
        maxLength={500}
      />
      <Button
        label={status === 'sending' ? 'Sending...' : 'Send Message'}
        tone="primary"
        onPress={submit}
        disabled={status === 'sending' || !text.trim()}
      />
      {status === 'error' && <Text style={s.errorText}>Failed to send. Please try again.</Text>}
    </View>
  );
};

// Two taps, the second one red and explained. Compact, low-profile danger action.
const DeleteAccountButton = ({ busy, onDelete, armed, setArmed }) => {
  return (
    <Pressable
      onPress={armed ? onDelete : () => setArmed(true)}
      disabled={Boolean(busy)}
      style={({ pressed }) => [
        s.deleteBtn,
        armed && s.deleteBtnArmed,
        pressed && s.btnPressed
      ]}
      accessibilityRole="button"
      accessibilityLabel={armed ? 'Yes, delete my account' : 'Delete account'}
      accessibilityHint={armed ? 'Deletes your account permanently' : 'Asks you to confirm first'}
    >
      <Ionicons name="trash-outline" size={13} color={armed ? '#FF4D6D' : '#FF6B81'} />
      <Text style={[s.deleteBtnText, armed && s.deleteBtnTextArmed]}>
        {busy === 'delete' ? 'Deleting...' : armed ? 'Confirm Delete' : 'Delete account'}
      </Text>
    </Pressable>
  );
};

const SettingsScreen = ({
  username, session, isGuest, online, provider, busy, error,
  avatarUrl, onPickAvatar,
  onBack, onSignInScreen, onLink, onLogout, onDeleteAccount
}) => {
  const [powersExpanded, setPowersExpanded] = useState(false);
  const [contactExpanded, setContactExpanded] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);

  return (
    <Screen scroll>
      <ScreenHeader title="Settings" titleStyle={s.headerTitle} onBack={onBack} />

      <SectionLabel>ACCOUNT</SectionLabel>
      <Card>
        <InfoRow label="Player" value={session ? (username || (isGuest ? 'Guest' : 'Player')) : 'Offline Player'} />
        {session ? (
          <>
            <Divider />
            <View style={s.row}>
              <Text style={s.rowLabel}>Profile picture</Text>
              <View style={s.picture}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={s.pictureImage} />
                ) : (
                  <Ionicons name="person" size={18} color={COLORS.textMid} />
                )}
              </View>
              {/* Google pictures come from the provider and refresh on
                  every sign-in, so only a guest has one to change. */}
              {isGuest ? (
                <Pressable
                  onPress={onPickAvatar}
                  hitSlop={8}
                  style={({ pressed }) => [s.changeBtn, pressed && s.rowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile picture"
                >
                  <Text style={s.changeText}>Change</Text>
                </Pressable>
              ) : (
                <Text style={s.rowValue} numberOfLines={1}>From {provider || 'your account'}</Text>
              )}
            </View>
          </>
        ) : null}
        <Divider />
        <View style={s.row}>
          <Text style={s.rowLabel}>Connection</Text>
          {session ? (
            <View style={[s.providerChip, { borderColor: !online ? COLORS.textLow : isGuest ? '#F97316' : COLORS.success }]}>
              <View style={[s.statusDot, { backgroundColor: !online ? COLORS.textLow : isGuest ? '#F97316' : COLORS.success }]} />
              <Text style={[s.providerChipText, { color: !online ? COLORS.textMid : isGuest ? '#F97316' : COLORS.success }]}>
                {!online ? 'No connection' : isGuest ? 'Guest Connected' : 'Connected'}
              </Text>
            </View>
          ) : (
            <View style={[s.providerChip, { borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(255, 255, 255, 0.04)' }]}>
              <View style={[s.statusDot, { backgroundColor: COLORS.danger }]} />
              <Text style={[s.providerChipText, { color: COLORS.textMid }]}>Not connected</Text>
            </View>
          )}
        </View>
        <Divider />
        <View style={s.row}>
          <Text style={s.rowLabel}>Signed in</Text>
          {session ? (
            isGuest ? (
              <View style={[s.providerChip, { borderColor: '#F97316' }]}>
                <Ionicons name="person" size={14} color="#F97316" />
                <Text style={[s.providerChipText, { color: '#F97316' }]}>Guest</Text>
              </View>
            ) : provider?.toLowerCase() === 'google' ? (
              <View style={[s.providerChip, { borderColor: '#FFFFFF' }]}>
                <GoogleIcon size={14} color="#FFFFFF" />
                <Text style={[s.providerChipText, { color: '#FFFFFF' }]}>Google</Text>
              </View>
            ) : (
              <Chip tone="accent">Signed in</Chip>
            )
          ) : (
            <Text style={s.rowValue} numberOfLines={1}>Not signed in</Text>
          )}
        </View>
        {session && isGuest ? (
          <>
            <Divider />
            <Text style={s.warn}>
              This guest account belongs to this device. It stays here until you link it —
              link Google below and it becomes a real account, same name, same
              picture, same games, nothing to move.
            </Text>
          </>
        ) : null}
        {!session ? (
          <>
            <Divider />
            <Text style={s.warn}>
              You are playing in offline mode. Pass N Play, with friends or computer players, works
              as normal; online multiplayer and party codes require signing in.
            </Text>
          </>
        ) : null}
      </Card>

      {!isSupabaseConfigured ? (
        <>
          <SectionLabel>ONLINE PLAY</SectionLabel>
          <Card>
            <Text style={s.warn}>
              Online play is switched off because this build has no Supabase keys. The
              offline modes work normally.
            </Text>
          </Card>
        </>
      ) : null}

      <SectionLabel>ABOUT</SectionLabel>
      <Card>
        <InfoRow label="Version" value="v1.0.0.420.69" />
        <Divider />
        <LinkRow
          label="How the powers work"
          icon="sparkles-outline"
          onPress={() => {
            setPowersExpanded(!powersExpanded);
            if (!powersExpanded) setContactExpanded(false);
          }}
          chevron={powersExpanded ? 'chevron-down' : 'chevron-forward'}
        />
        {powersExpanded && (
          <View style={s.dropdown}>
            {POWERS.map(p => (
              <View key={p.title} style={s.powerItem}>
                <View style={s.powerIcon}>
                  <Image source={p.image} style={{ width: 22, height: 22, resizeMode: 'contain' }} />
                </View>
                <View style={s.powerTextCol}>
                  <Text style={s.powerTitle}>{p.title}</Text>
                  <Text style={s.powerDesc}>{p.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        <Divider />
        <LinkRow
          label="Contact Developer"
          icon="mail-outline"
          onPress={() => {
            setContactExpanded(!contactExpanded);
            if (!contactExpanded) setPowersExpanded(false);
          }}
          chevron={contactExpanded ? 'chevron-down' : 'chevron-forward'}
        />
        {contactExpanded && (
          <View style={s.dropdown}>
            <ContactForm username={username} />
          </View>
        )}
        <Divider />
        <LinkRow
          label="Privacy policy"
          icon="shield-checkmark-outline"
          chevron="open-outline"
          hint="Opens in your browser"
          onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
        />
      </Card>

      <View style={s.danger}>
        {!session ? (
          <View style={s.signInBox}>
            <View style={s.signInHeader}>
              <Ionicons name="cloud-offline-outline" size={22} color={COLORS.accent} />
              <Text style={s.signInPrompt}>Sign In to Play Online</Text>
            </View>
            <Text style={s.signInDesc}>
              Connect with Google or a guest account to unlock online multiplayer, custom room codes, and cloud sync.
            </Text>
            <Button
              label="Go to Sign-In Page"
              tone="primary"
              icon="log-in-outline"
              onPress={onSignInScreen}
              accessibilityHint="Opens the sign-in screen, where you can use Google or a guest account"
            />
          </View>
        ) : (
          <>
            {error ? (
              <Text style={{ color: '#EF4444', textAlign: 'center', marginBottom: SPACE.xs, ...TYPE.body, fontSize: 13 }}>
                {error}
              </Text>
            ) : null}
            {/* Big, highlighted Use another account */}
            <Button
              label={isGuest ? 'Use another account' : 'Sign out'}
              tone={isGuest ? 'primary' : 'danger'}
              icon={isGuest ? 'swap-horizontal-outline' : 'log-out-outline'}
              disabled={Boolean(busy)}
              onPress={onLogout}
              contentStyle={isGuest ? s.useAnotherAccountBtn : undefined}
              textStyle={isGuest ? s.useAnotherAccountText : undefined}
              accessibilityHint={
                isGuest
                  ? 'Goes back to the sign-in screen. This guest account stays on this device'
                  : 'Signs you out on this device'
              }
            />

            {/* Smaller Link Google button (guest only) */}
            {/* Danger confirmation message when armed */}
            {deleteArmed ? (
              <Text style={s.warn}>
                This deletes your account, name, picture and online games for good. Purchases
                stay with your Google Play account and come back with Restore in the shop.
              </Text>
            ) : null}

            {/* Secondary Actions: Link Google & Delete Account (at right of Google in red) */}
            <View style={s.bottomSecondaryRow}>
              {isGuest ? (
                <Pressable
                  onPress={() => onLink('google')}
                  disabled={Boolean(busy)}
                  style={({ pressed }) => [s.linkGoogleBtn, pressed && s.btnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Link Google account"
                >
                  <GoogleIcon size={14} />
                  <Text style={s.linkGoogleText}>
                    {busy === 'google' ? 'Linking...' : 'Link Google'}
                  </Text>
                </Pressable>
              ) : null}

              <DeleteAccountButton
                busy={busy}
                onDelete={onDeleteAccount}
                armed={deleteArmed}
                setArmed={setDeleteArmed}
              />
            </View>
          </>
        )}
      </View>
    </Screen>
  );
};

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    minHeight: TARGET.min, paddingVertical: SPACE.sm
  },
  rowPressed: { opacity: 0.65 },
  rowLabel: { ...TYPE.body, color: COLORS.textHi, flex: 1 },
  rowLink: { color: COLORS.textHi },
  rowValue: { ...TYPE.body, color: COLORS.textMid, maxWidth: '70%' },
  picture: {
    width: 36, height: 36, borderRadius: RADIUS.pill, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceHi, borderWidth: 1, borderColor: COLORS.line
  },
  pictureImage: { width: '100%', height: '100%' },
  changeBtn: {
    paddingHorizontal: SPACE.xs,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  changeText: {
    ...TYPE.label,
    fontFamily: 'Nunito-Bold',
    fontSize: 14,
    color: COLORS.accent,
  },

  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 4,
  },
  providerChipText: {
    ...TYPE.label,
    fontSize: 13,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  signInBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: SPACE.lg,
    gap: SPACE.sm,
    alignItems: 'stretch',
  },
  signInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  signInPrompt: {
    ...TYPE.heading,
    fontSize: 16,
    color: COLORS.textHi,
  },
  signInDesc: {
    ...TYPE.body,
    fontSize: 13,
    color: COLORS.textMid,
    lineHeight: 18,
    marginBottom: SPACE.xs,
  },

  warn: {
    ...TYPE.body, fontSize: 13, color: COLORS.textMid,
    paddingVertical: SPACE.md, lineHeight: 19
  },

  danger: {
    marginTop: SPACE.xxl,
    paddingBottom: SPACE.xl,
    gap: SPACE.md,
  },
  useAnotherAccountBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(63, 208, 201, 0.22)',
    borderWidth: 2,
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 4,
  },
  useAnotherAccountText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 0.4,
  },
  bottomSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: SPACE.xs,
    width: '100%',
    flexWrap: 'wrap',
  },
  linkGoogleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 35,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  linkGoogleText: {
    ...TYPE.label,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 35,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  deleteBtnArmed: {
    backgroundColor: 'rgba(239, 68, 68, 0.32)',
    borderColor: '#EF4444',
  },
  deleteBtnText: {
    ...TYPE.label,
    fontSize: 12,
    color: '#FF6B81',
    fontWeight: '700',
  },
  deleteBtnTextArmed: {
    color: '#FF4D6D',
    fontWeight: '800',
  },

  dropdown: {
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.sm,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: RADIUS.md,
    marginTop: SPACE.xs,
    marginBottom: SPACE.sm,
  },
  powerItem: {
    flexDirection: 'row',
    gap: SPACE.md,
    marginBottom: SPACE.lg,
    alignItems: 'flex-start'
  },
  powerIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(63, 208, 201, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerTextCol: {
    flex: 1,
  },
  powerTitle: {
    ...TYPE.heading,
    fontSize: 15,
    color: COLORS.textHi,
    marginBottom: 4
  },
  powerDesc: {
    ...TYPE.body,
    fontSize: 13,
    color: COLORS.textMid,
    lineHeight: 18
  },
  contactContainer: {
    gap: SPACE.md,
    paddingHorizontal: SPACE.xs
  },
  contactInput: {
    ...TYPE.body,
    fontSize: 14,
    color: COLORS.textHi,
    backgroundColor: COLORS.surfaceHi,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.md,
    padding: SPACE.md,
    minHeight: 120,
    textAlignVertical: 'top'
  },
  contactMsg: {
    ...TYPE.body,
    fontSize: 14,
    color: COLORS.textMid,
    textAlign: 'center',
    padding: SPACE.md,
    lineHeight: 20
  },
  errorText: {
    ...TYPE.caption,
    color: COLORS.danger,
    textAlign: 'center'
  },
  headerTitle: {
    fontFamily: 'Aligarh',
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  _radius: { borderRadius: RADIUS.sm }
});

export default SettingsScreen;
