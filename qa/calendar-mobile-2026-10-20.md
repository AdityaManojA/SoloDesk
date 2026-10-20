# Calendar dragging and mobile review — 20 October 2026

## Behavior

- SoloDesk calendar chips and agenda drag handles support pointer dragging (mouse, touch or pen) to a visible month date. Dragging near the viewport edges scrolls the page. Dropping outside a date or pressing Escape cancels. Clicks immediately following a drag are suppressed so they do not accidentally open details.
- Tasks retain local clock time, seconds and duration. A task's own deadline shifts by the same number of days. Project moves shift its existing start/end dates equally; grabbing the middle of a span uses that cell as the anchor. Linked tasks are not moved when moving a project.
- TaskFlow events remain read-only, with no drag handlers or workspace writes to TaskFlow.
- Event details offer a themed Move to date control, including cross-month moves, for keyboard users and precise phone interaction. Successful moves announce the new date and use the existing workspace save flow.
- Shared mobile CSS addresses long content, shrinkable grid children, input sizes, larger controls, stacked forms, invoice line editors, header/dock clearance and scrollable table regions. Invoice and storage tables intentionally scroll inside their own regions.
- The calendar puts the main grid ahead of the TaskFlow connection status. On phones, redundant introductory text is omitted. Calendar details render outside the animated page container, clearing the sticky header and dock even in a short viewport.

## Verification

- `npm run check`: **54 tests passed**, production build passed. Seven new tests cover isolated task/project changes, linked deadline offsets, duration/time preservation, invalid dates and atomic rejection, external events, leap/year boundaries and daylight-saving behavior. DST checks run under America/New_York, including rejection of a nonexistent spring-forward time.
- Real local browser drag: QA Task moved from 20 to 21 October, retaining 10:00 and 90 minutes. Move to date then moved it to 2 November. Reload and November navigation confirmed persistence.
- Real local browser drag: grabbed QA Project on 22 October and dropped on 24 October. Its whole span shifted from 19–30 October to 21 October–1 November.
- Real local browser drag in a 390px frame moved an all-day deadline from 19 to 20 October, updating both the grid and selected-day agenda.
- **60 layout observations**: Dashboard, Clients, Projects, Tasks, Invoices, Calendar, Reports, Settings, Integrations, More, Privacy and Cookies at **320, 360, 390, 430 and 768px**. No page-wide overflow; intentionally scrollable tables excluded from descendant-overflow flags. Raw observations: `mobile-layout-2026-10-20.json`.
- Visually inspected the phone dashboard, invoice editor, client dropdown, invoice date picker, settings currency dropdown, calendar grid and event details. Tested date selection and dropdown selection. Checked light and dark appearance on representative controls.
- Short 390×560 frame exposed an existing event-details stacking/containing-block problem; portal rendering and bounded height fixed it. Screenshot: `screenshots/calendar-mobile-move-2026-10-20.png`.

## Additional color check

TaskFlow's exact P1–P6 palette was applied to imported quest cards, calendar chips and agenda entries. A local `taskflow-palette.html` fixture rendered the actual components with six clearly labeled sample quests. Browser-computed colors matched all six source colors in light mode and six dark equivalents; calendar chips matched too. A 320px viewport showed no page overflow. Fixture data never reaches Firebase and is not bundled in the hosting build. Screenshot: `screenshots/taskflow-priority-colors-2026-10-20.png`.

## Limits

These are browser/frame checks, not a physical iPhone/Android or exhaustive accessibility matrix. The browser drag tool exercised the common pointer path with mouse input; physical touch/pen and on-screen keyboards still need device testing. Live authenticated Firestore writes, offline/network failures and real TaskFlow feed interactions were not exercised. Only local demo sample records were changed. Firebase rules, functions and TaskFlow hosting are unchanged.
