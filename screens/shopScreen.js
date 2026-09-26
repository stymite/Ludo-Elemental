import React from 'react';
import { StyleSheet, View, Text, Pressable, Image, ScrollView, Modal } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, Ellipse } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, ScreenHeader, Rise } from '../components/ui';
import { COLORS, TYPE, SPACE, RADIUS } from '../theme';
import { SECTIONS, itemsIn, displayPrice } from '../shop';

const TAB_LABEL = { BOARD: 'Board', DICE: 'Dice', TOKEN: 'Token', SYMBOL: 'Symbol' };
const CATEGORIES = SECTIONS.map(sec => ({
  key: sec.key,
  label: TAB_LABEL[sec.key] || sec.title
}));

const ITEM_ART = {
  ludo_board_classic: require('../assets/Board.webp'),
  ludo_board_anime: require('../assets/Board-Anime.webp'),
  ludo_board_astra: require('../assets/Board-Astra.webp'),
  ludo_board_future: require('../assets/Board-Future.webp'),
  ludo_board_gear: require('../assets/Board-Gear.webp'),
  ludo_board_spirit: require('../assets/Board-Spirit.webp'),
  ludo_board_sport: require('../assets/Board-Sport.webp'),

  ludo_dice_classic: require('../assets/r5.png'),
  ludo_token_classic: require('../assets/fire.png'),
  ludo_symbol_classic: require('../assets/fire.png')
};

const SECTION_ICON = {
  BOARD: 'grid',
  DICE: 'dice',
  TOKEN: 'ellipse',
  SYMBOL: 'flame'
};

const ItemArt = ({ item }) => {
  const art = ITEM_ART[item.id] || (item.imageUrl ? { uri: item.imageUrl } : null);
  const isBoard = item.section === 'BOARD';

  if (art) {
    return (
      <View style={[s.artContainer, isBoard && s.boardArtContainer]}>
        <Image
          source={art}
          style={s.artImage}
          resizeMode={isBoard ? 'cover' : 'contain'}
        />
      </View>
    );
  }

  return (
    <View style={[s.artContainer, isBoard && s.boardArtContainer, s.artPlaceholder, { borderColor: item.accent + '55' }]}>
      <Ionicons name={SECTION_ICON[item.section] || 'cube-outline'} size={isBoard ? 56 : 48} color={item.accent} />
    </View>
  );
};

const SYMBOL_SETS = {
  ludo_symbol_classic: [
    require('../assets/air.png'),
    require('../assets/fire.png'),
    require('../assets/water.png'),
    require('../assets/earth.png'),
  ]
};

const SymbolShopItem = ({ item, owned, equipped, price, busy, onBuy, onEquip, delay }) => {
  const symbols = SYMBOL_SETS[item.id] || (item.symbols ? item.symbols : [
    require('../assets/air.png'),
    require('../assets/fire.png'),
    require('../assets/water.png'),
    require('../assets/earth.png'),
  ]);

  const accentColor = item.accent || COLORS.accent;

  return (
    <Rise delay={delay} style={s.symbolItemWrap}>
      <Pressable
        onPress={() => (owned ? onEquip(item) : onBuy(item))}
        disabled={!!busy}
        style={({ pressed }) => [
          s.symbolItemBox,
          equipped && {
            borderColor: accentColor,
            borderWidth: 2,
            backgroundColor: 'rgba(63, 208, 201, 0.12)',
            shadowColor: accentColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            // No elevation: on Android it draws a dark rectangle under a see-through fill (rgba fill).
          },
          pressed && !busy && { transform: [{ scale: 0.98 }] },
          busy && { opacity: 0.6 }
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          owned
            ? `${item.name}. Owned. ${equipped ? 'Equipped' : 'Tap to equip'}`
            : `${item.name}. Buy for ${price}`
        }
      >
        <View style={s.symbolGrid}>
          {symbols.map((src, idx) => (
            <View key={`symbol_${idx}`} style={s.symbolIconTile}>
              <Image
                source={typeof src === 'string' ? { uri: src } : src}
                style={s.symbolImage}
                resizeMode="contain"
              />
            </View>
          ))}
        </View>

        <View style={s.itemContentCol}>
          <View style={s.itemMeta}>
            <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={s.itemBlurb} numberOfLines={2}>{item.blurb}</Text>
          </View>

          <View style={s.itemActionRow}>
            {owned ? (
              <View style={[s.symbolStatusTag, equipped ? { backgroundColor: accentColor } : s.symbolStatusTagOwned]}>
                <Text style={[s.symbolStatusText, equipped ? { color: '#0A0A0E' } : { color: COLORS.textMid }]}>
                  {equipped ? 'EQUIPPED' : 'EQUIP'}
                </Text>
              </View>
            ) : (
              <View style={s.priceTag}>
                <Text style={s.priceText}>{price}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Rise>
  );
};

const TOKEN_THEMES = {
  RED: {
    rimTop: '#FF6B81',
    rimMid: '#E60026',
    rimBot: '#54000B',
    innerTop: '#D90429',
    innerBot: '#380006',
  },
  YELLOW: {
    rimTop: '#FFF59D',
    rimMid: '#FFB300',
    rimBot: '#7C3F00',
    innerTop: '#FFA000',
    innerBot: '#5E2A00',
  },
  GREEN: {
    rimTop: '#B9F6CA',
    rimMid: '#00D060',
    rimBot: '#004818',
    innerTop: '#00A344',
    innerBot: '#003810',
  },
  BLUE: {
    rimTop: '#80D8FF',
    rimMid: '#0099FF',
    rimBot: '#003380',
    innerTop: '#0077E6',
    innerBot: '#002566',
  }
};

const TokenCoin = ({ color, size = 36, id = 'coin' }) => {
  const theme = TOKEN_THEMES[color] || TOKEN_THEMES.RED;
  const rimId = `rim_${id}_${color}`;
  const innerId = `inner_${id}_${color}`;
  const glossId = `gloss_${id}_${color}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={rimId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={theme.rimTop} />
          <Stop offset="35%" stopColor={theme.rimMid} />
          <Stop offset="100%" stopColor={theme.rimBot} />
        </LinearGradient>
        <LinearGradient id={innerId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={theme.innerTop} />
          <Stop offset="100%" stopColor={theme.innerBot} />
        </LinearGradient>
        <LinearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Outer Metallic Bezel */}
      <Circle cx="50" cy="50" r="48" fill={`url(#${rimId})`} />

      {/* Specular Edge Highlight */}
      <Circle cx="50" cy="50" r="47.5" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />

      {/* Inner Groove Drop Shadow */}
      <Circle cx="50" cy="50" r="38" fill="rgba(0,0,0,0.4)" />

      {/* Inner Colored Glass Disc */}
      <Circle cx="50" cy="50" r="36.5" fill={`url(#${innerId})`} />

      {/* Top Gloss Arc Sheen */}
      <Ellipse cx="50" cy="27" rx="27" ry="14" fill={`url(#${glossId})`} />
    </Svg>
  );
};

const TokenShopItem = ({ item, owned, equipped, price, busy, onBuy, onEquip, delay }) => {
  const tokenColors = ['RED', 'YELLOW', 'GREEN', 'BLUE'];
  const accentColor = item.accent || COLORS.accent;

  return (
    <Rise delay={delay} style={s.symbolItemWrap}>
      <Pressable
        onPress={() => (owned ? onEquip(item) : onBuy(item))}
        disabled={!!busy}
        style={({ pressed }) => [
          s.symbolItemBox,
          equipped && {
            borderColor: accentColor,
            borderWidth: 2,
            backgroundColor: 'rgba(63, 208, 201, 0.12)',
            shadowColor: accentColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            // No elevation: on Android it draws a dark rectangle under a see-through fill (rgba fill).
          },
          pressed && !busy && { transform: [{ scale: 0.98 }] },
          busy && { opacity: 0.6 }
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          owned
            ? `${item.name}. Owned. ${equipped ? 'Equipped' : 'Tap to equip'}`
            : `${item.name}. Buy for ${price}`
        }
      >
        <View style={s.symbolGrid}>
          {tokenColors.map((color, idx) => (
            <View key={`token_${color}_${idx}`} style={s.symbolIconTile}>
              <TokenCoin color={color} size={40} id={`item_${item.id}_${idx}`} />
            </View>
          ))}
        </View>

        <View style={s.itemContentCol}>
          <View style={s.itemMeta}>
            <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={s.itemBlurb} numberOfLines={2}>{item.blurb}</Text>
          </View>

          <View style={s.itemActionRow}>
            {owned ? (
              <View style={[s.symbolStatusTag, equipped ? { backgroundColor: accentColor } : s.symbolStatusTagOwned]}>
                <Text style={[s.symbolStatusText, equipped ? { color: '#0A0A0E' } : { color: COLORS.textMid }]}>
                  {equipped ? 'EQUIPPED' : 'EQUIP'}
                </Text>
              </View>
            ) : (
              <View style={s.priceTag}>
                <Text style={s.priceText}>{price}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Rise>
  );
};

const ShopItem = ({ item, owned, equipped, price, busy, onBuy, onEquip, delay }) => {
  const accentColor = item.accent || COLORS.accent;
  const isBoard = item.section === 'BOARD';

  return (
    <Rise delay={delay} style={s.symbolItemWrap}>
      <Pressable
        onPress={() => (owned ? onEquip(item) : onBuy(item))}
        disabled={!!busy}
        style={({ pressed }) => [
          s.symbolItemBox,
          isBoard && s.boardItemBox,
          equipped && {
            borderColor: accentColor,
            borderWidth: 2,
            backgroundColor: 'rgba(63, 208, 201, 0.12)',
            shadowColor: accentColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            // No elevation: on Android it draws a dark rectangle under a see-through fill (rgba fill).
          },
          pressed && !busy && { transform: [{ scale: 0.98 }] },
          busy && { opacity: 0.6 }
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          owned
            ? `${item.name}. Owned. ${equipped ? 'Equipped' : 'Tap to equip'}`
            : `${item.name}. Buy for ${price}`
        }
      >
        <ItemArt item={item} />

        <View style={s.itemContentCol}>
          <View style={s.itemMeta}>
            <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={s.itemBlurb} numberOfLines={2}>{item.blurb}</Text>
          </View>

          <View style={s.itemActionRow}>
            {owned ? (
              <View style={[s.symbolStatusTag, equipped ? { backgroundColor: accentColor } : s.symbolStatusTagOwned]}>
                <Text style={[s.symbolStatusText, equipped ? { color: '#0A0A0E' } : { color: COLORS.textMid }]}>
                  {equipped ? 'EQUIPPED' : 'EQUIP'}
                </Text>
              </View>
            ) : (
              <View style={s.priceTag}>
                <Text style={s.priceText}>{price}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Rise>
  );
};

const ShopScreen = ({
  owned = new Set(),
  equipped = {},
  prices = {},
  busyItem = null,
  error = null,
  storeReady = false,
  restoring = false,
  onBuy,
  onRestore,
  onEquip,
  onBack,
  onDismissError
}) => {
  const [activeCategory, setActiveCategory] = React.useState('BOARD');
  const items = itemsIn(activeCategory);

  return (
    <Screen scroll>
      <ScreenHeader
        title="Shop"
        titleStyle={s.headerTitle}
        onBack={onBack}
        right={storeReady ? (
          // Up here rather than under the grid: someone reinstalling should not
          // have to scroll past things they already paid for to get them back.
          <Pressable
            onPress={onRestore}
            disabled={Boolean(restoring || busyItem)}
            hitSlop={12}
            style={({ pressed }) => [s.restoreBtn, pressed ? s.restorePressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            accessibilityState={{ disabled: !!restoring, busy: !!restoring }}
          >
            <Text style={s.restoreText}>{restoring ? 'Restoring…' : 'Restore'}</Text>
          </Pressable>
        ) : null}
      />

      {/* Category Tabs */}
      <View style={s.categoryBar}>
        {CATEGORIES.map((cat, idx) => {
          const isActive = activeCategory === cat.key;
          return (
            <React.Fragment key={cat.key}>
              {idx > 0 && <Text style={s.catDivider}>|</Text>}
              <Pressable
                onPress={() => setActiveCategory(cat.key)}
                style={[s.catTab, isActive && s.catTabActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: !!isActive }}
              >
                <Text style={[s.catText, isActive && s.catTextActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>

      {/* Items Grid */}
      <View style={s.grid}>
        {items.map((item, i) => (
          item.section === 'SYMBOL' ? (
            <SymbolShopItem
              key={item.id}
              item={item}
              owned={owned.has(item.id)}
              equipped={equipped[activeCategory] === item.id}
              price={displayPrice(item, prices)}
              busy={Boolean(busyItem || restoring)}
              onBuy={onBuy}
              onEquip={onEquip}
              delay={40 * i}
            />
          ) : item.section === 'TOKEN' ? (
            <TokenShopItem
              key={item.id}
              item={item}
              owned={owned.has(item.id)}
              equipped={equipped[activeCategory] === item.id}
              price={displayPrice(item, prices)}
              busy={Boolean(busyItem || restoring)}
              onBuy={onBuy}
              onEquip={onEquip}
              delay={40 * i}
            />
          ) : (
            <ShopItem
              key={item.id}
              item={item}
              owned={owned.has(item.id)}
              equipped={equipped[activeCategory] === item.id}
              price={displayPrice(item, prices)}
              busy={Boolean(busyItem || restoring)}
              onBuy={onBuy}
              onEquip={onEquip}
              delay={40 * i}
            />
          )
        ))}
      </View>

      {activeCategory !== 'BOARD' && (
        <View style={s.comingSoonCard}>
          <Ionicons name="sparkles-outline" size={24} color={COLORS.accent} />
          <Text style={s.comingSoonTitle}>More Cosmetics Dropping Soon</Text>
          <Text style={s.comingSoonDesc}>
            Custom elemental dice sets, coin bezels and crest symbols will arrive in the next update!
          </Text>
        </View>
      )}

      {/* Centered Purchase Notice Modal with top-right X button */}
      <Modal
        visible={Boolean(error)}
        transparent={true}
        animationType="fade"
        onRequestClose={onDismissError}
      >
        <View style={s.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onDismissError}
            accessibilityLabel="Close notice backdrop"
          />
          <View
            style={s.modalCard}
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel={String(error || 'Purchase notice')}
          >
            <Pressable
              onPress={onDismissError}
              hitSlop={14}
              style={({ pressed }) => [s.modalCloseBtn, pressed ? s.modalCloseBtnPressed : null]}
              accessibilityRole="button"
              accessibilityLabel="Close notice"
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>

            <View style={s.modalIconWrap}>
              <Ionicons name="alert-circle" size={36} color={COLORS.danger} />
            </View>

            <Text style={s.modalTitle} maxFontSizeMultiplier={1.3}>
              Purchase Notice
            </Text>
            <Text style={s.modalMessage} maxFontSizeMultiplier={1.3}>
              {error}
            </Text>

            <Pressable
              onPress={onDismissError}
              style={({ pressed }) => [s.modalActionBtn, pressed ? s.modalActionBtnPressed : null]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss notice"
            >
              <Text style={s.modalActionBtnText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const s = StyleSheet.create({
  headerTitle: {
    fontFamily: 'Aligarh',
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: 2,
    textTransform: 'uppercase'
  },

  restoreBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)'
  },
  restorePressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  restoreText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 13,
    color: COLORS.textHi
  },

  categoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: SPACE.xl
  },
  catTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm
  },
  catTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)'
  },
  catDivider: {
    fontFamily: 'Nunito-Bold',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 4
  },
  catText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 14,
    color: COLORS.textMid,
    letterSpacing: 0.5
  },
  catTextActive: {
    color: '#FFFFFF'
  },

  grid: {
    width: '100%',
    marginBottom: SPACE.xl
  },
  itemWrap: {
    width: '100%',
    marginBottom: SPACE.md
  },
  symbolItemWrap: {
    width: '100%',
    marginBottom: SPACE.md
  },
  symbolItemBox: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(25, 28, 35, 0.92)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 154
  },
  boardItemBox: {
    minHeight: 164,
  },
  symbolGrid: {
    width: 116,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flexShrink: 0
  },
  symbolIconTile: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  symbolImage: {
    width: 38,
    height: 38
  },
  symbolActionWrap: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  symbolStatusTag: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center'
  },
  symbolStatusTagOwned: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)'
  },
  symbolStatusText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8
  },
  artContainer: {
    width: 108,
    height: 108,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  boardArtContainer: {
    width: '38%',
    maxWidth: 136,
    height: undefined,
    aspectRatio: 1,
    borderRadius: 18,
  },
  artImage: {
    width: '100%',
    height: '100%'
  },
  artPlaceholder: {
    borderWidth: 1,
    borderStyle: 'dashed'
  },
  itemContentCol: {
    flex: 1,
    alignSelf: 'stretch',
    paddingLeft: 14,
    justifyContent: 'space-between',
    paddingVertical: 2,
    zIndex: 1,
  },
  itemMeta: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  itemName: {
    fontFamily: 'Nunito-Bold',
    fontSize: 19.5,
    fontWeight: '800',
    color: COLORS.textHi,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  itemBlurb: {
    ...TYPE.body,
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 18.5,
  },
  itemActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    zIndex: 10,
  },
  priceTag: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },

  comingSoonCard: {
    backgroundColor: 'rgba(63, 208, 201, 0.08)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(63, 208, 201, 0.2)',
    padding: SPACE.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    marginBottom: SPACE.xl
  },
  comingSoonTitle: {
    ...TYPE.heading,
    fontSize: 15,
    color: COLORS.textHi
  },
  comingSoonDesc: {
    ...TYPE.body,
    fontSize: 12,
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 17
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACE.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(20, 24, 33, 0.96)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(229, 72, 77, 0.45)',
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 16,
    position: 'relative',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalCloseBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ scale: 0.94 }],
  },
  modalIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(229, 72, 77, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(229, 72, 77, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  modalMessage: {
    fontSize: 14,
    color: '#D0D0DC',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  modalActionBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(229, 72, 77, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(229, 72, 77, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtnPressed: {
    backgroundColor: 'rgba(229, 72, 77, 0.4)',
    transform: [{ scale: 0.98 }],
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
    letterSpacing: 0.8,
  }
});

export default ShopScreen;
