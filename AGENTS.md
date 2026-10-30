# Editor assignment notifications

Creative Corpus Google Apps Script in `sendEditorAssignmentNotifications.gs`. `checkProjectsAndNotify()` notifies the creative approximately one hour after an editor is assigned and the project status becomes `in progress`. It reads project/contact data and maintains tracking columns. Read the source configuration/header; the README is only a short label.

- This workflow concerns editing projects in the PE media list, not Blue Belle contractor assignment or pre-event reminders. Related folders are `../assignment-notification` and `../Creative-s-notification`.
- Preserve the configured status column, receive-date cutoff, delay, date parsing and tracking/deduplication semantics. Inspect the current sheet schema before changing the default tracking columns.
- `createTrigger()` installs the 15-minute schedule; check the owning account and existing trigger before adding another. `sendTestEmail()` sends mail. Do not execute send/trigger functions merely to inspect the project.
- No local automated test harness is documented. `debugNotifications()` is the source diagnostic entry point; inspect what the current version reads/writes before using it against a sheet.
- All files within the deployed Apps Script project share a namespace. Generic names here (for example `createTrigger`, `sendTestEmail`) can collide if combined with similarly named local projects.
- Keep editor/creative contacts, message contents and external IDs out of general context notes. Last Git commit describes a sending-failure fix; verify behavior rather than treating that label as a current test result.

When working in `D:\Dev`, consult `../workspace-context/PROJECTS.md` for workspace routing and `../workspace-context/WORKSPACE_CONTEXT.md` for shared context if present. These workspace files are local context, not a dependency of the project. Record confirmed schema/timing decisions when they change.
