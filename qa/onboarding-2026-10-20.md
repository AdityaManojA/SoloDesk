# Onboarding and guided tour — 20 October 2026

Implemented a browser-wide one-time install banner; four-step onboarding with installation on its final step; an eight-step route-aware tour; and replay buttons in Settings and More. Existing cream/pastel and dark styles are retained. No workspace records, TaskFlow data, rules or functions are changed by these flows.

## Verified

- `npm run check`: 69 tests pass; production build succeeds. Preference tests cover account/demo isolation and blocked storage.
- Fresh local origin: top install banner opens already-expanded guidance in one click; dismiss/Done and reload do not repeat the banner.
- First local demo entry opens onboarding. All four steps and final install action work. Completing onboarding/tour and reloading does not reopen onboarding.
- All eight tour steps navigate correctly at desktop 1280×720 and mobile 390×844. Spotlight and callout remain visible in inspected desktop/mobile views. Finish restores the starting route.
- Settings and More replay work. Escape closes and restores the route. Keyboard focus resets to the dialog on each step, Shift+Tab wraps to the last control, Tab wraps to Close. Background is inert while dialogs are open.
- 320×568 onboarding final step, expanded installation instructions and its scroll area fit horizontally. Long contents scroll within the dialog.
- 667×375 landscape uses a scrollable callout without a spotlight; 390×844 dark onboarding was visually checked.

## Limits

Tests use local demo data and browser viewport emulation. Physical iOS/Android installation and OS-level native installation are not asserted. Account completion flags are browser-local, so a new browser/device can show onboarding again. If storage is blocked, preferences cannot persist and prompts may reappear.

## Release

Precise highlighting follow-up: replaced broad page headers with actual Add/Create buttons, the first revenue metric, Month/Agenda view switch and the replay button. Spotlight follows each target's border radius, clips all four edges consistently and tracks route entrance transforms for 40 animation frames, plus resize, scroll and visual viewport events. A masked SVG dims only the area outside the target. The instruction card anchors beside, below or above the target with a 16px gap; constrained space scrolls the body while retaining actions.

Geometry validation: all eight steps checked at 1280×720 and 320×568. Each spotlight aligned with its target to the intended 5px padding, all instruction cards avoided the target, and all navigation controls remained in view. Inspected light/dark, project and revenue steps, plus 667×375 landscape. Four new geometry tests cover clipping, target radius, adjacent placement, phone constraints and visual viewport offsets. 75 tests and production build pass. Screenshot: `screenshots/tour-project-highlight.png`.

Visual onboarding follow-up: all four introduction steps and all eight tour steps now include small HTML/CSS screen examples (explicitly labelled Example). Dashboard totals, client/project/task relationships, the create dock, a calendar with Google/TaskFlow context, invoice stages and installation/settings controls use illustrative sample data. Descriptions are shortened and key actions use semantic strong text. No personal records or screenshot capture is used in the examples. Checked all 12 steps at 320×568: each example renders, every navigation footer stays in the viewport, and the onboarding copy has bold emphasis. Inspected desktop workflow, 390×844 calendar and dark welcome layouts. Screenshots: `screenshots/onboarding-visual-workflow.png` and `screenshots/onboarding-visual-calendar-mobile.png`.

Follow-up repair: onboarding now has four named, numbered step buttons. Dialog title and Back/Next/Finish actions stay outside the scrollable body; the overlay tracks the visual viewport, and tour cards are positioned inside it. Removed the double scroll offset caused by combining scroll-padding with scrollIntoView. Short desktop layouts highlight one metric to leave room for instructions. Settings/More now have a clearly named Onboarding & tour section and Start onboarding again button. Corrected focus restoration to the button that opened the dialog.

Browser follow-up checks: all eight tour dialogs and their navigation buttons stay inside a 1280×491 desktop viewport and a 320×568 phone viewport. Expanded installation instructions scroll independently while the final onboarding controls remain visible at both sizes. Step jumping, skipping and restarting from Settings work; Escape returns focus to Start onboarding again. Screenshot: `screenshots/onboarding-steps-fixed.png`. These are emulated browser sizes, not physical-device tests.

Deployed only `hosting:solodesk` to `taskflow-solodesk.web.app`. Live browser reload confirmed `index-D-gKnjtT.js`, the top banner, first-run demo introduction and all four onboarding steps including the final install/tour controls. Screenshot: `screenshots/onboarding-final-desktop.png`. Firebase rules, functions and TaskFlow Hosting were not deployed.
