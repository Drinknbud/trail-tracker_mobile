# Trail Tracker — Store Submission Playbook (M7)

Working checklist for Apple App Store + Google Play submission, per
`docs/mobile-app-requirements.md` §7.5, §5.5, and §9.

## Accounts (owner: Drew)

- [ ] **Apple Developer Program** — developer.apple.com, $99/yr. Enroll first;
      approval can take days and gates everything iOS (TestFlight included).
- [ ] **Google Play Console** — play.google.com/console, $25 one-time.
- [ ] **Expo (EAS)** — expo.dev, free tier. Needed for all builds:
      `npx eas-cli login`, then `eas build --profile development --platform android`.
- [ ] **RevenueCat** — app.revenuecat.com, free under $2.5k MTR.

## App identity (already configured in app.json)

- Name: **Trail Tracker** (verify availability in both stores at first
  submission; fallback: "Trail Tracker — AT Section Hiker")
- Bundle ID / package: `com.trailtracker.app` (permanent once shipped)
- Category: Travel (Apple) / Maps & Navigation (Play); secondary Sports
- Keywords: appalachian trail, section hike, thru hike, hiking journal,
  offline trail map

## Subscriptions (RevenueCat)

Mirror current Stripe pricing (change later in store consoles, not code):

| Product id        | Price   | Trial              |
|-------------------|---------|--------------------|
| `premium_monthly` | $7.99/mo  | 14-day intro offer |
| `premium_annual`  | $54.99/yr | 14-day intro offer |

Setup order:
1. Create the two subscriptions in App Store Connect and Play Console with
   14-day free intro offers (store-managed trial — the Apple-friendly path).
2. In RevenueCat: one entitlement `premium`, one offering containing both
   packages; attach store products.
3. API keys → EAS env: `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`,
   `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (SDK activates automatically —
   `src/lib/purchases.ts`).
4. Webhook: RevenueCat dashboard → webhook URL
   `https://<production-domain>/api/webhooks/revenuecat`, Authorization
   header = `REVENUECAT_WEBHOOK_SECRET` (set the same value in Vercel env).
   Existing Stripe subscribers are unaffected — both systems write the same
   `subscriptionTier`/`subscriptionExpiresAt` fields and the server check is
   source-agnostic.

## Store assets

- [ ] App icon 1024×1024 (logo mark on trail-green `#2D6A4F` or navy `#0F172A`)
- [ ] Android adaptive icon foreground/background (current placeholders in
      `assets/images/` need replacing with the real logo from the web repo's
      `public/logo-*.svg`)
- [ ] Splash: square logo on `#0F172A` (already configured, placeholder image)
- [ ] Screenshots: iPhone 6.7" + 6.1" (Dashboard, Journal, Map, Briefing,
      celebration), Android phone + 7" tablet equivalents. Portrait only.
- [ ] Privacy policy URL (reuse the web app's; must be reachable pre-review)

## App Privacy / Data Safety declarations

| Data | Collected? | Linked to user | Purpose |
|---|---|---|---|
| Precise location | Yes (GPS tracking, geotagged photos, dead zones) | Yes | App functionality |
| Photos | Yes (user-initiated capture/upload) | Yes | App functionality |
| Name / email | Yes (account) | Yes | App functionality |
| User content (journals, messages) | Yes | Yes | App functionality |
| Identifiers (user id) | Yes | Yes | App functionality |
| Tracking / advertising | **No** | — | — |

## Apple review notes — background location (Risk §9)

Include with the submission (App Review Information):

> Trail Tracker records a hiker's GPS track while they walk the Appalachian
> Trail, including with the screen off — this is the app's core, user-initiated
> feature. Tracking starts only when the user taps "Start tracking" on the GPS
> screen, shows a persistent notification while active (Android) / the
> background-location indicator (iOS), and stops with one tap. Power modes
> throttle fixes to as low as one per 10 minutes for multi-day battery life.
> Demo video: <record 60–90s on the Pixel showing start → background → stop>.

Also required: `NSLocationAlwaysAndWhenInUseUsageDescription` /
`ACCESS_BACKGROUND_LOCATION` strings in app.json before the store build
(plus `expo-location` plugin config) — do this alongside the dev-build QA.

## Submission order

1. EAS dev build → M6 airplane-mode QA gauntlet on the Pixel (§11 matrix).
2. Fix findings; replace placeholder icons/splash; add location permission strings.
3. `eas build --profile production` both platforms.
4. TestFlight external beta + Play internal testing (recruit from web users).
5. Submit with review notes above.
