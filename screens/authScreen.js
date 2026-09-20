import React from 'react';
import { StyleSheet, View, Text, Pressable, ImageBackground, Image, Platform, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBanner } from '../components/ui';
import { CHROME_SCALE } from '../theme';

const GoogleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </Svg>
);

const GoldenDividerLine = ({ flip = false }) => (
  <View style={{ flex: 1, height: 8, justifyContent: 'center' }}>
    <Svg width="100%" height="8" viewBox="0 0 100 8" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={flip ? "goldTaperR" : "goldTaperL"} x1={flip ? "0%" : "100%"} y1="0%" x2={flip ? "100%" : "0%"} y2="0%">
          <Stop offset="0%" stopColor="#E5C07B" stopOpacity="0.8" />
          <Stop offset="30%" stopColor="#C59B27" stopOpacity="0.6" />
          <Stop offset="70%" stopColor="#A88220" stopOpacity="0.2" />
          <Stop offset="100%" stopColor="#85581A" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {flip ? (
        <Path d="M 0 1.5 Q 45 3.2 100 4 Q 45 4.8 0 6.5 Z" fill="url(#goldTaperR)" />
      ) : (
        <Path d="M 100 1.5 Q 55 3.2 0 4 Q 55 4.8 100 6.5 Z" fill="url(#goldTaperL)" />
      )}
    </Svg>
  </View>
);

const SocialButton = ({
  icon, iconNode, label, onPress, style, textStyle,
  loading = false, disabled = false, color = '#ffffff',
  brand = null,
}) => (
  <Pressable
    onPress={onPress}
    disabled={Boolean(disabled || loading)}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
    style={({ pressed }) => [
      s.social,
      style,
      pressed && s.socialPressed,
    ]}
  >
    {iconNode ? (
      <View style={s.socialIcon}>{iconNode}</View>
    ) : icon ? (
      <Ionicons name={icon} size={20} color={color} style={s.socialIcon} />
    ) : brand ? (
      <Ionicons name={brand} size={20} color={color} style={s.socialIcon} />
    ) : null}
    <Text
      style={[s.socialText, textStyle]}
      numberOfLines={1}
      maxFontSizeMultiplier={CHROME_SCALE}
    >
      {loading ? 'Signing in...' : label}
    </Text>
  </Pressable>
);

const PlayOfflineButton = ({ onPress, style }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel="Play offline"
    style={({ pressed }) => [s.playOfflineBtn, style, pressed && s.playOfflinePressed]}
  >
    <Ionicons name="game-controller-outline" size={18} color="#ffffff" />
    <Text style={s.playOfflineText} maxFontSizeMultiplier={CHROME_SCALE}>Play Offline</Text>
  </Pressable>
);

const AuthScreen = ({
  onGoogle, onGuest, onPlayOffline,
  busy = null, error, onDismissError
}) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={s.root}>
      <ImageBackground
        source={require('../assets/auth-page/background.webp')}
        style={s.background}
        imageStyle={s.bgImage}
        resizeMode="cover"
      >
        {/* Dark overlay to reduce background brightness */}
        <View style={s.darkOverlay} pointerEvents="none" />

        {/* Center Logo */}
        <Image
          source={require('../assets/auth-page/center.webp')}
          style={s.imgLogo}
          resizeMode="contain"
          pointerEvents="none"
        />

        {/* Play Offline button - wrapping the offline image directly */}
        <Pressable
          onPress={onPlayOffline}
          style={({ pressed }) => [
            s.imgOfflineWrapper,
            { marginTop: insets.top },
            pressed && s.btnPressed
          ]}
          accessibilityRole="button"
          accessibilityLabel="Play offline image"
        >
          <Image
            source={require('../assets/auth-page/offline.webp')}
            style={s.imgOffline}
            resizeMode="contain"
          />
        </Pressable>

        {/* Our made Play Offline button (opacity: 0) */}
        <PlayOfflineButton onPress={onPlayOffline} style={{ marginTop: insets.top }} />

        {error ? (
          <View style={s.errorContainer}>
            <ErrorBanner onDismiss={onDismissError}>{error}</ErrorBanner>
          </View>
        ) : null}

        {/* Social and Guest action buttons (Artwork layer) */}
        <View style={s.socialImagesGroup}>
          {/* Continue with Google */}
          <Pressable
            onPress={onGoogle}
            disabled={Boolean(busy)}
            style={({ pressed }) => [
              s.socialBtnPressable,
              s.googleBtnWrapper,
              pressed && s.btnPressed
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ busy: busy === 'google', disabled: Boolean(busy) }}
          >
            <Image
              source={require('../assets/auth-page/google.webp')}
              style={[s.socialImg, s.googleImg]}
              resizeMode="stretch"
            />
            {busy === 'google' ? (
              <ActivityIndicator style={StyleSheet.absoluteFill} color="#FFFFFF" size="small" />
            ) : null}
          </Pressable>

          {/* Facebook - disabled/unavailable badge */}
          <View
            style={[s.socialImg, s.facebookImg]}
            accessible
            accessibilityLabel="Continue with Facebook. Currently Unavailable"
          >
            <Image source={require('../assets/auth-page/facebook.webp')} style={s.unavailableImg} resizeMode="stretch" />
            <View style={s.unavailableNote} pointerEvents="none">
              <Ionicons name="lock-closed" size={17} color="#FFFFFF" />
              <Text style={s.unavailableText} maxFontSizeMultiplier={CHROME_SCALE}>Currently Unavailable</Text>
            </View>
          </View>
          
          {/* Golden OR divider */}
          <View style={s.goldenOrRow} pointerEvents="none">
            <GoldenDividerLine flip={false} />
            <Text style={s.goldenOrText}>OR</Text>
            <GoldenDividerLine flip={true} />
          </View>

          {/* Play as guest */}
          <Pressable
            onPress={onGuest}
            disabled={Boolean(busy)}
            style={({ pressed }) => [
              s.socialBtnPressable,
              s.guestBtnWrapper,
              pressed && s.btnPressed
            ]}
            accessibilityRole="button"
            accessibilityLabel="Play as guest"
            accessibilityState={{ busy: busy === 'guest', disabled: Boolean(busy) }}
          >
            <Image
              source={require('../assets/auth-page/guest.webp')}
              style={[s.socialImg, s.guestImg]}
              resizeMode="stretch"
            />
            {busy === 'guest' ? (
              <ActivityIndicator style={StyleSheet.absoluteFill} color="#FFFFFF" size="small" />
            ) : null}
          </Pressable>
        </View>

        {/* Our made buttons (opacity: 0) */}
        <View style={s.actions}>
          <View style={s.buttonsContainer}>
            <SocialButton
              label="Continue with Google"
              onPress={onGoogle}
              loading={busy === 'google'}
              disabled={Boolean(busy)}
              style={s.googleBtn}
              textStyle={{ color: '#000000' }}
              iconNode={<GoogleIcon />}
            />

            <SocialButton
              brand="logo-facebook"
              label="Currently unavailable"
              disabled
              style={s.facebookBtn}
              textStyle={{ color: '#ffffff' }}
              color="#ffffff"
            />

            <SocialButton
              label="Play as Guest"
              onPress={onGuest}
              loading={busy === 'guest'}
              disabled={Boolean(busy)}
              style={s.guestBtn}
              textStyle={{ color: '#ffffff' }}
              icon="person-outline"
            />
          </View>
        </View>
      </ImageBackground>
    </View>
  );
};

const s = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  bgImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },

  imgLogo: {
    position: 'absolute',
    top: '18.5%',
    width: '100%',
    height: '44%',
    alignSelf: 'center',
    transform: [{ scale: 1.1 }, { translateX: -8 }],
  },

  imgOfflineWrapper: {
    position: 'absolute',
    top: '2%',
    right: -24,
    width: 200,
    height: 71,
    zIndex: 90,
    elevation: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgOffline: {
    width: 200,
    height: 71,
    opacity: 1,
  },

  playOfflineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: 148,
    height: 71,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    position: 'absolute',
    top: '2%',
    right: 2,
    opacity: 0,
    zIndex: 110,
    elevation: 110,
  },
  playOfflinePressed: { opacity: 0 },
  playOfflineText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },

  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  socialImagesGroup: {
    position: 'absolute',
    top: '61.5%', // Shifted a little bit down
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 90,
    elevation: 90,
  },

  actions: {
    position: 'absolute',
    top: '61.5%', // Shifted a little bit down, matching artwork
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 110,
    elevation: 110,
    opacity: 0,
  },

  buttonsContainer: {
    width: '100%',
    alignItems: 'center',
  },

  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    opacity: 0,
  },
  socialPressed: { opacity: 0 },
  socialIcon: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  googleBtn: {
    width: '78%',
    height: 66,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    opacity: 0,
  },
  facebookBtn: {
    width: '78%',
    height: 66,
    marginTop: 4,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    opacity: 0,
  },
  guestBtn: {
    width: '78%',
    height: 80,
    marginTop: 26,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    opacity: 0,
  },

  socialBtnPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnWrapper: {
    width: '100%',
  },
  guestBtnWrapper: {
    width: '100%',
  },

  socialImg: {
    width: '78%',
    height: 66,
    opacity: 1,
  },
  googleImg: {
    height: 66,
    opacity: 1,
  },
  facebookImg: {
    height: 66,
    marginTop: 4,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    opacity: 1,
  },
  unavailableImg: {
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  unavailableNote: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    zIndex: 10,
    opacity: 1,
  },
  unavailableText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'Nunito-Bold', android: 'Nunito-Bold', default: 'sans-serif' }),
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    opacity: 1,
  },
  guestImg: {
    height: 80,
    marginTop: -4,
    opacity: 1,
  },
  goldenOrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '78%',
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 4,
    opacity: 0.85,
  },
  goldenOrText: {
    fontSize: 18,
    fontWeight: '800',
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Snell Roundhand', default: 'cursive' }),
    color: '#E5C07B',
    paddingHorizontal: 10,
    letterSpacing: 3,
    textShadowColor: 'rgba(212, 175, 55, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },

  errorContainer: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    right: '15%',
    zIndex: 120,
  },
});

export default AuthScreen;
