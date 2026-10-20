# Themed scrollbars — 20 October 2026

Added `src/scrollbars.css`, imported after the shared theme/layout styles. The native scrollbars now use a rounded yellow thumb with an inset ink outline, a theme-matched track and orange hover state. Dark mode uses amber on graphite. Chromium/WebKit scrollbar arrow buttons are removed. Firefox receives standard thin, theme-colored scrollbars; OS overlay scrollbars may retain platform behavior. Forced-color mode uses system colors.

This is CSS only: wheel, touch, native thumb dragging, keyboard input and existing scroll containers retain their browser behavior. Stable gutters prevent dialog/dropdown width shifts.

Verified: production build passed. Light/dark invoice dialogs visually inspected; wheel scrolling moved the dialog to its end (217.5px scroll offset). The currency dropdown was exercised in a 320×300 viewport: 368px content inside a 272px viewport; Home/End navigation scrolled it to 96px. No page-width overflow at 320px. Computed styles confirmed 12px width and hidden scrollbar buttons. Screenshot: `screenshots/themed-scrollbar-2026-10-20.png`. Firefox, physical touch devices and forced-color rendering were not directly exercised.
