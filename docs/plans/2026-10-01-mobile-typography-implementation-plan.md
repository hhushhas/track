# Track Mobile Typography Implementation

**Status:** Not done: native font rendering and visual review are unverified, built-in Android calendar headings ignore the app's text-scale limit, and the required audit reports an unpatched high severity node-forge advisory. The current generated dependency tree is uncertain after pnpm check commands invoked a filtered install and stopped at build-script approval.
**Owner:** Track mobile
**Scope:** Manrope V5 in apps/mobile, its design guidance, and required verification.
**Decision:** Use the official Manrope V5 Static release for app-owned mobile text. Keep web typography and OS-owned controls unchanged.

## 1. Font research and license

The official creator release is bundled unchanged at apps/mobile/assets/fonts/ in weights 400, 500, 600, 700, and 800. The asset README records the publisher source, retrieval date, and SHA-256 hashes. The original license is included, and the required attribution, "Manrope V5 by Mikhail Sharanda," appears in the account's Fonts and licenses section.

The creator permits commercial app embedding and requires the font files and family name to remain unchanged. The creator recommends the static files for small-size clarity. See the [official Manrope V5 terms](https://www.sharanda.com/manrope).

A read-only character-map audit found 680 mapped Unicode values in each of the five static weights. The font contains the tested ASCII, Western European, Greek, Russian, and Ukrainian characters; it does not contain the tested Arabic, Hebrew, Devanagari, or CJK characters. Track Mobile has no locale translation catalog, but user names and messages can contain any script, so missing glyphs rely on platform fallback. Android and Apple document font fallback ([Android Typeface fallback](https://developer.android.com/reference/android/graphics/Typeface.CustomFallbackBuilder), [Apple Core Text fallback](https://developer.apple.com/documentation/coretext/ctfontcopydefaultcascadelistforlanguages%28_%3A_%3A%29)). Mixed-script fallback rendering and line metrics remain unverified on native devices.

## 2. Native font configuration and tokens

The existing Expo font plugin maps all five static weights for Android and iOS. The shared theme maps platform-specific font names and weights; monospace remains a separate role for fixed identifiers. The root font scale remains enabled up to a multiplier of 2.

The workspace pins pnpm 11.28.2 because pnpm 10.19 fails intermittently while relinking hoisted workspaces that use patched dependencies. The lockfile records the React Native 0.86.3 patch and its hash. The patched source is present in the current `node_modules/react-native` directory, but the generated dependency tree is uncertain. Filtered checks reported 116 package removals, then stopped with `ERR_PNPM_IGNORED_BUILDS`; do not treat that tree as a clean install or native proof.

**Verified:** Expo SDK 57 config introspection resolves all five font paths. The native plugin has not been run, so generated Android resources and on-device font-family resolution remain unproved. Expo's [SDK 57 font docs](https://docs.expo.dev/versions/v57.0.0/sdk/font/) require a native build for config-plugin fonts.

## 3. Shared components and controls

ThemedText and ThemedTextInput enforce `no-common-ligatures` while preserving other requested variants such as tabular numerals. Android React Native already maps the setting. The pinned React Native 0.86.3 patch adds parsing, bridge serialization, and an iOS Fabric Core Text mapping, with native parser regression cases. The patch source is present in the current installed package, but no native build has compiled it. Date/calendar day cells use ThemedText. The `react-native-calendars` month and weekday headings still use raw package text with `allowFontScaling={false}`; their font family is set, but they do not meet the app's 2x scaling contract or guaranteed ligature setting. This remains an accessibility gap.

A source scan found no app-owned raw React Native Text outside ThemedText. Every app-owned editable text field uses ThemedTextInput, which merges `no-common-ligatures` with local font variants and applies the shared 2x text-size cap.

## 4. Screen migration

The shared roles cover sign-in, conversation and thread text, message composition, task creation and detail, task boards and lists, search, Inbox, dashboards, settings, navigation, date controls, and transient sheets. Names, timestamps, counts, and ordinary labels use sans; fixed identifiers retain the mono role. System-owned native controls keep their platform typography.

## 5. Accessibility and visual review

App text and editable fields scale up to 2x, and essential compact labels use the caption role. Code and design guidance preserve wrapping and growing controls, with the calendar-header exception above. The implementation has not yet been visually reviewed on native iOS or Android in light and dark themes, with large text, long content, and narrow layouts. No current device screenshots or simulator recordings exist for this font build.

## 6. Verification and remaining work

Direct focused mobile checks passed against the current source:

- `oxlint .` through the local binary: passed
- `tsc -p tsconfig.json --noEmit` through the local binary: passed
- Vitest through the local binary: 41 files and 174 tests passed, including weight mapping and font-variant merge regression cases
- Expo SDK 57 config introspection resolved all five font paths
- A scoped Codex review of the earlier typography diff found no concrete integration defects; it predates the React Native ligature patch

The full repository gates and Expo export remain unverified. Normal pnpm check commands attempted a filtered install and stopped on `ERR_PNPM_IGNORED_BUILDS`, so the lint, typecheck, and test scripts did not run through pnpm. Direct mobile checks passed, but they do not prove the dependency tree is consistent. Dependency regeneration is awaiting explicit approval.

The required pnpm audit --prod check failed with one high severity finding: node-forge@1.4.0, through expo > @expo/cli, is affected by [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv). The advisory lists no patched version. Do not force an override without a compatible upstream fix.

The Android native directory already exists and is ignored by Git. The protected command npx expo prebuild --platform android, run from apps/mobile, may regenerate or update files under apps/mobile/android. It needs explicit approval before execution. An Android AVD named Pixel_2_XL is configured, but no device was attached during the check. Windows cannot run the iOS Simulator. The iOS patch also needs a native build on macOS to prove the Objective-C++ mapping compiles and renders.

After the dependency install approval, run the mobile and full repository gates, audit, and Expo export. After Android prebuild approval, inspect the generated Android diff, then request separate approval before npx expo run:android. Review light and dark themes, large text, long labels, messages and descriptions, pills, dates, keyboard-open forms, and the core conversation and task routes on the Android emulator. The audit advisory currently lists no fixed node-forge version; rerun it when upstream publishes a fix.

### Completion criteria

- [x] Font choice, original static weights, license, and required attribution are recorded.
- [x] Mobile guidance and shared typography roles use one family; web guidance remains separate.
- [x] Shared components, direct inputs, navigation, calendar labels, pills, badges, metadata, and screen text use the shared roles.
- [x] Monospace remains separate from ordinary app copy; text scaling is enabled.
- [ ] Native font generation and rendering are verified on Android and iOS.
- [ ] Light/dark, large text, narrow layout, long content, and core native flows have visual evidence.
- [ ] Every required gate passes, including pnpm audit --prod.
- [ ] Final handoff includes native screenshots or recordings and the clean verification results.
