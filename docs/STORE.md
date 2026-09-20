# Ludo Elemental — store listing and Shipaton submission

Copy from here into Google Play Console and Devpost. Generated images live in
`store-assets/` (gitignored — upload them, do not commit them).

---

## Google Play listing

**App name** (30 max)

    Ludo Elemental

**Short description** (80 max)

    Ludo with elemental powers: burn, freeze, wall off and blow past your rivals.

**Full description**

    Ludo Elemental is the board game everyone knows, with four elemental powers that turn every roll into a real decision.

    FOUR ELEMENTS, FOUR WAYS TO WIN
    • Fire — The Blaze. Arm it before you roll and your token burns every enemy on the tiles it crosses, sending them home.
    • Water — Ice Shield. Wrap your tokens in spiked ice. Anyone who lands on them is captured.
    • Earth — The Wall. Drop a wall on any tile and block the road.
    • Air — The Gust. Add 9 extra steps to your roll and race ahead.

    Powers charge as you play, so timing is everything: burn now, or save it for the moment a rival is one step from home?

    PLAY YOUR WAY
    • Pass N Play on one phone — fill any seat with a friend or a computer player
    • Play Online with quick matchmaking
    • Party Code: share a code and play in a private room
    • Rejoin an online game if your connection drops
    • A guided tutorial that teaches every power

    MAKE THE TABLE YOURS
    Unlock premium boards: Anime Dream, Astral Cosmos, Cyber Neon, Steampunk Clockwork, Mystic Blossom and Arena Champions. One-time purchases, cosmetic only. Nothing you buy changes how the game plays.

    No ads. Play offline without an account.

**Category:** Board · **Tags:** Board, Casual, Multiplayer
**Privacy policy URL:** https://stymite.github.io/Ludo-Elemental/privacy.html
**Account deletion URL:** https://stymite.github.io/Ludo-Elemental/privacy.html#delete
**Target audience:** 13 and over (keeps the app out of the Families program)
**Ads:** No

### In-app products (Monetize → Products → One-time products)

| Product ID | Name | Price |
| --- | --- | --- |
| `ludo_board_anime` | Anime Dream Board | 2.99 USD |
| `ludo_board_astra` | Astral Cosmos Board | 2.99 USD |
| `ludo_board_future` | Cyber Neon Board | 2.99 USD |
| `ludo_board_gear` | Steampunk Clockwork Board | 2.99 USD |
| `ludo_board_spirit` | Mystic Blossom Board | 2.99 USD |
| `ludo_board_sport` | Arena Champions Board | 2.99 USD |

The IDs must match `shop.js` exactly. In RevenueCat, import them and set each
to **Non-consumable**.

### Data safety answers

| Data | Collected | Why | Optional |
| --- | --- | --- | --- |
| Name, email (Google sign-in) | Yes | Account management | Yes — guest or offline play |
| User IDs | Yes | Account management, app functionality | Yes |
| Photos (guest profile picture) | Yes | App functionality | Yes |
| Purchase history | Yes | App functionality (RevenueCat) | Yes |
| In-app messages (Contact Developer) | Yes | Customer support | Yes |

Shared with third parties: no (Supabase, RevenueCat and Formspree are service
providers). Encrypted in transit: yes. Users can request deletion: yes.

---

## Devpost submission

**Category: Next Gen Award** (students). It waives the store listing, which is why
it is the target: every other category needs a first public release before Sep 30,
and neither Play (12 testers × 14 days) nor Galaxy Store (seller approval) can be
done in time. Play and Galaxy carry on afterwards, for October.

Next Gen needs: a demo video under 2 minutes, a **public open-source repo with a
licence** (github.com/stymite/Ludo-Elemental, MIT), the text description below, the
1024×1024 icon, and one 1179×2556 screenshot. Eligibility: enrolled student with
a student email, 13+.

### Text description

**Ludo Elemental** takes the board game almost everyone has played and gives each colour an elemental power: Fire burns a path through enemies, Water freezes tokens into traps, Earth walls off the road, and Air gusts nine extra steps. Every power charges as you play, so each turn asks a question classic Ludo never did — use it now, or wait?

The four elements are a straight nod to **Avatar: The Last Airbender**. The show also gives each element a second, rarer form — waterbenders who bend blood, firebenders who throw lightning, earthbenders who bend metal. We looked at giving each colour a second power the same way, and cut it: a 4-player board where everyone has two abilities each turn stops being Ludo and starts being a different, much longer game. So one power per colour stayed, and the balancing lever became something else entirely — a charge meter. Every power costs 40 points to fire, and once one of your tokens gets all the way home, that cost drops to 30. Progress makes you stronger; it does not hand you a second ability.

**What it does**
- Four elemental powers with their own timing rules, animations and counters (Ice is immune to Fire; walls shove sheltered tokens)
- Pass N Play with any mix of friends and computer players, online matchmaking, and private Party Code rooms
- Host-authoritative online play: one device runs the rules, others send moves, so nobody can cheat by editing their client, and a dropped player can rejoin
- A guided tutorial with Stymite, the game's mascot, that teaches every power in play

**How it makes money — RevenueCat**
The shop sells premium game boards as one-time, non-consumable Google Play products, powered by the RevenueCat SDK (`react-native-purchases`):
- Ownership comes only from RevenueCat's `CustomerInfo`, never from local storage, so unlocks cannot be faked
- Prices are fetched from the store and shown in the player's own currency
- Purchases are tied to the player's account with `Purchases.logIn`, so a board bought on one phone is there on the next; Restore brings everything back after a reinstall
- An item is owned if its product was bought *or* an entitlement of the same name is active, so a bundle can be launched from the RevenueCat dashboard with no app update
- Everything sold is cosmetic. Nothing is pay-to-win, and there are no ads

**How we built it**
Expo SDK 57 and React Native 0.86 with Reanimated 4 for animation; Supabase Auth and Realtime for accounts and multiplayer; RevenueCat for purchases. The rules engine is plain JavaScript with no UI imports, so every power, turn rule and online authority check runs in Node test suites before a build ever happens.

**Challenges**
Shipping an Android-only game without an Android device: every release is checked with custom scripts that catch the crashes that only happen on a phone (worklets calling plain functions, non-boolean native props, styles web accepts and Android does not), plus an in-app crash screen.

**What's next**
Dice sets, coin bezels and crest symbols in the shop (the tabs are already there), a discounted all-boards bundle, and ranked online seasons.

### Judge access

Next Gen does not require a promo code, but judges should be able to try it. Ship
them the sideloaded APK built with RevenueCat's **Test Store** key: the shop works
end to end and purchases complete without any real store or money.

1. Install the APK (link in the submission).
2. Open **Shop** and buy any board — the Test Store sheet completes it.
3. **Restore** in the shop header brings purchases back.

APK: `(paste the EAS build link here)`

### Demo video plan (under 2:00, recorded on the phone)

| Time | Shot |
| --- | --- |
| 0:00–0:10 | Launch, splash, home screen |
| 0:10–0:40 | Pass N Play against computer seats: roll, move, then each power firing — Blaze, Ice Shield, Wall, Gust |
| 0:40–1:00 | Party Code: two phones join the same room |
| 1:00–1:35 | Shop: browse boards, buy one through the Google Play sheet, equip it, start a game on the new board |
| 1:35–1:50 | Settings → Restore purchases |
| 1:50–2:00 | Logo and store link |

No copyrighted music. Upload to YouTube as Public or Unlisted-public.

### Publishing from a friend's Play account

- The app is listed under that account's developer name and email. The privacy
  policy points to "the developer email on the Play listing", so it stays correct.
- Invite yourself in Play Console → Users and permissions (Admin) so you can
  manage the listing and create promo codes yourself.
- If that account is a **personal** account created after Nov 13, 2023, it must
  run a closed test with 12 testers for 14 days before production. An older or
  organisation account can publish straight away.
- The package name `com.stymite.ludoelemental` is fixed forever once uploaded.
- RevenueCat needs a Google Play service account JSON from that same Play
  account (RevenueCat → Project settings → Google Play → Service account).

### Checklist (Next Gen)

- [x] Public repo, open source, MIT `LICENSE` visible
- [x] README explaining the game, the RevenueCat integration and the architecture
- [x] `supabase-schema-v2.sql` applied and tested (grants, account deletion, hardening)
- [x] GitHub Pages on, privacy page loads
- [ ] RevenueCat Test Store key in `eas.json`, judge APK built
- [ ] Video on YouTube, under 2 minutes, recorded on a phone
- [ ] Devpost: description, icon, screenshot, repo link, video link, student email
- [ ] Video on YouTube, under 2 minutes
- [ ] `store-assets/icon-1024.png`
- [ ] At least one `store-assets/screenshot-*.png` (1179×2556, no frame)
- [ ] Promo codes in the submission
- [ ] Submitted before Sep 30, 2026, 11:45pm PDT
