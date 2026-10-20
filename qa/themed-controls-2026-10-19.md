# Themed controls verification

- Reports date button opens the custom calendar in light and dark themes.
- Selecting 20 October updates the report's To field and closes the calendar.
- ArrowRight then Enter selects the following date and returns focus to the trigger.
- Settings currency dropdown opens a themed options panel.
- ArrowDown then Enter changes USD to EUR.
- Saving Settings and reloading preserves EUR, confirming native form submission values.
- Currency was restored to USD and saved after the check.
- Settings file-upload surface and select trigger inspected in both themes.
- Task dialog stays open when Escape dismisses its priority menu or date calendar.
- All 27 existing automated tests passed and production build passed.

The operating system file dialog is intentionally native. Actual upload selection was not exercised in this pass. After deployment, Tab from the open From calendar closed the panel and moved focus into the To date field. The deployed Reports picker was also visually checked in dark mode. No full accessibility or mobile compatibility certification is claimed.
