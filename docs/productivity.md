# Planning & productivity guide

Open [Terracove](https://taskflow-solodesk.web.app) and sign in, or choose **Explore the demo** to try sample data. Demo changes stay in your browser. Use **Commands** in the header or **More** on desktop and mobile. **Calendar → Daily plan** opens the planner; **Projects → Project templates** and **Invoices → Recurring drafts** keep related tools together. **More → Data & connections → Backup & restore** contains JSON backups and individual CSV exports. **More → Recovery** contains Undo and Trash. Settings groups business details, appearance, getting started, connections and account controls.

| Tool | How to use it | Example |
| --- | --- | --- |
| **Daily planner** | Open Daily planner, choose a date and working hours, then schedule a task with a start time and duration. | [Planner](screenshots/13-daily-planner-desktop.png) |
| **Conflicts & free time** | Review overlapping timed work and choose a suggested free slot. You can also open this from Calendar. | [Scheduling suggestions](screenshots/21-conflicts-and-free-time.png) |
| **Calendar task tray** | Drag an unscheduled Terracove task onto a calendar date. Use the planner to give it a timed work block. | [Calendar](screenshots/04-calendar-desktop.png) |
| **Global search** | Use the header search button or **Ctrl/Command K**, enter a title or name, and select a result. | [Search](screenshots/15-global-search-desktop.png) |
| **Undo & Trash** | Use Undo for recent changes, or open Trash and choose Restore for a deleted record. | [Trash](screenshots/19-trash-desktop.png) |
| **Recurring tasks & drafts** | Set a task's repeat option when editing it. Completing it creates its next occurrence. For recurring invoices, create a schedule and choose **Generate due drafts** when due. | [Invoice draft schedules](screenshots/18-recurring-drafts-desktop.png) |
| **Project templates** | Pick a workflow, client, project name and start date. Create reusable templates from existing project tasks or enter tasks with day offsets; invoice milestones are optional drafts. | [Templates](screenshots/14-project-templates-desktop.png) |
| **Client timeline** | Open a client to review its linked activity in one timeline. | [Client activity](screenshots/17-client-timeline-desktop.png) |
| **Focus timer** | Open Focus or start from a task. Pause when needed and choose Finish to log elapsed time toward project totals. | [Focus](screenshots/16-focus-timer-desktop.png) |

## Things to know

- **TaskFlow and Google events are read-only.** Sign in with the same account as TaskFlow to see its shared quests and events. Conflict suggestions use the timed records currently loaded; refresh TaskFlow for its latest Google events. Deadlines and project date ranges do not reserve working time.
- **Undo is session-only**, with up to 20 changes. Reloading or signing out clears Undo. **Trash persists** in the workspace and does not automatically expire. Restoring a deleted client also restores the linked records removed with it.
- **Recurring invoice generation is manual.** Each click creates up to 24 due drafts per schedule. These remain unsent; there are no automatic charges or payment follow-up messages.
- **Focus measures elapsed wall-clock time**, including time while the app is closed, capped at 24 hours per session. Finish records the session.
- **Activity history keeps the latest 500 entries.** It is a workspace convenience, not an unlimited audit archive.

The [21-image gallery](screenshots/README.md) includes desktop, mobile, dark mode and onboarding examples. See [verification and implementation limits](../qa/productivity-2026-10-20.md) for the tested behavior.
