// ============================================================
//  Creative Corpus – Editor Assignment Notification Script
//
//  Watches the "projects" sheet and emails the creative one
//  hour after an editor is assigned AND the status is set to
//  "in progress".
//
//  HOW TO DEPLOY
//  1. Open your Google Spreadsheet.
//  2. Extensions → Apps Script → paste this file.
//  3. ⚠️  Set STATUS_COL below to match your actual status column letter.
//  4. Save, then run createTrigger() ONCE to install the 15-min trigger.
//  5. Authorise the script when prompted.
// ============================================================

// ── Configuration ────────────────────────────────────────────
var PROJECTS_SHEET  = "projects";
var CONTACTS_SHEET  = "contacts";

// Column indices (0-based, A=0, B=1, …)
var COL_CREATIVE_EMAIL = 1;  // B – recipient
var COL_PROJECT_NAME   = 5;  // F
var COL_EDITOR_NAME    = 11; // L
var COL_CREATIVE_NAME  = 23; // X
var COL_STATUS         = 12; // M ← ⚠️ CHANGE THIS to match your status column
                              //   (A=0, B=1, C=2, … M=12, N=13, …)

// The exact status text that triggers notifications (case-insensitive)
var TRIGGER_STATUS = "in progress";

// Tracking columns written by this script (choose two unused columns)
// Default: Y (24) and Z (25) — change if those are already in use.
var COL_QUEUED_AT  = 24; // Y – timestamp when conditions were first met
var COL_NOTIFIED   = 25; // Z – set to "YES" after email is sent

// Contacts sheet columns (0-based)
var COL_CONTACT_NAME  = 0; // A
var COL_CONTACT_EMAIL = 1; // B

// Delay in milliseconds (1 hour)
var DELAY_MS = 60 * 60 * 1000;

// Only notify projects received STRICTLY AFTER this date.
// Rows with a receive date on or before this date are ignored.
var COL_RECEIVE_DATE = 0;                    // A – date the project was received
var CUTOFF_DATE      = new Date(2026, 3, 2); // April 2, 2026 (month is 0-based)

// ── Main function (runs every 15 minutes via trigger) ─────────
function checkProjectsAndNotify() {
  var ss             = SpreadsheetApp.getActiveSpreadsheet();
  var projectsSheet  = ss.getSheetByName(PROJECTS_SHEET);
  var contactsSheet  = ss.getSheetByName(CONTACTS_SHEET);

  if (!projectsSheet || !contactsSheet) {
    Logger.log("ERROR: Could not find '" + PROJECTS_SHEET + "' or '" + CONTACTS_SHEET + "' sheet.");
    return;
  }

  // Build editor name → email map from contacts sheet
  var contactsData = contactsSheet.getDataRange().getValues();
  var editorEmailMap = {};
  for (var c = 0; c < contactsData.length; c++) {
    var eName  = String(contactsData[c][COL_CONTACT_NAME]).trim();
    var eEmail = String(contactsData[c][COL_CONTACT_EMAIL]).trim();
    if (eName && eEmail && eEmail.indexOf("@") !== -1) {
      editorEmailMap[eName.toLowerCase()] = eEmail;
    }
  }

  var projectsData = projectsSheet.getDataRange().getValues();
  var now          = new Date();
  var emailsSent   = 0;

  for (var r = 0; r < projectsData.length; r++) {
    var row          = projectsData[r];
    var editorName   = String(row[COL_EDITOR_NAME]).trim();
    var status       = String(row[COL_STATUS]).trim().toLowerCase();
    var queuedAt     = row[COL_QUEUED_AT];
    var notified     = String(row[COL_NOTIFIED]).trim().toUpperCase();

    // Skip rows already notified (guarantees email is sent only once)
    if (notified === "YES") continue;

    // Skip projects received on or before the cutoff date
    var receiveDate = parseDateCell(row[COL_RECEIVE_DATE]);
    if (!receiveDate || receiveDate <= CUTOFF_DATE) continue;

    // Both trigger conditions must be met
    var conditionsMet = editorName !== "" && status === TRIGGER_STATUS;

    if (conditionsMet && !queuedAt) {
      // First time we see this row ready — stamp the queue time
      projectsSheet.getRange(r + 1, COL_QUEUED_AT + 1).setValue(now.toISOString());
      Logger.log("Row " + (r + 1) + ": Queued at " + now.toISOString());
      continue;
    }

    if (conditionsMet && queuedAt) {
      var queuedDate  = new Date(queuedAt);
      var elapsedMs   = now.getTime() - queuedDate.getTime();

      if (elapsedMs < DELAY_MS) {
        Logger.log("Row " + (r + 1) + ": Waiting (" + Math.round(elapsedMs / 60000) + " min elapsed).");
        continue;
      }

      // 1 hour has passed — gather data and send
      var creativeEmail = String(row[COL_CREATIVE_EMAIL]).trim();
      var projectName   = String(row[COL_PROJECT_NAME]).trim();
      var creativeName  = String(row[COL_CREATIVE_NAME]).trim();
      var editorEmail   = editorEmailMap[editorName.toLowerCase()];

      if (!creativeEmail || creativeEmail.indexOf("@") === -1) {
        Logger.log("Row " + (r + 1) + ": Invalid creative email – skipped.");
        continue;
      }
      if (!editorEmail) {
        Logger.log("Row " + (r + 1) + ": No email found for editor '" + editorName + "' – skipped.");
        continue;
      }

      var subject  = buildSubject(projectName);
      var htmlBody = buildEmailBody(creativeName, projectName, editorName, editorEmail);

      MailApp.sendEmail({ to: creativeEmail, subject: subject, htmlBody: htmlBody });

      // Mark row as notified
      projectsSheet.getRange(r + 1, COL_NOTIFIED + 1).setValue("YES");
      emailsSent++;
      Logger.log("Row " + (r + 1) + ": Email sent to " + creativeEmail);
    }
  }

  Logger.log("Done. Emails sent this run: " + emailsSent);
}

// ── Email builders ────────────────────────────────────────────
function buildSubject(projectName) {
  return "Project Update: Editor Assigned for " + projectName;
}

function buildEmailBody(creativeName, projectName, editorName, editorEmail) {
  var firstName = creativeName.split(" ")[0];
  return "<div style='font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;max-width:680px'>"
    + "<p>Hi " + firstName + ",</p>"
    + "<p>Thanks for submitting your project!</p>"
    + "<p>Just a quick update to let you know that <strong>" + editorName + "</strong> has been assigned "
    + "as the lead editor for this wedding and has already started working on the edit.</p>"
    + "<p>If you have any specific notes, additional files, or creative questions regarding this project, "
    + "feel free to reach out to them directly at:</p>"
    + "<p>📩 <a href='mailto:" + editorEmail + "'>" + editorEmail + "</a></p>"
    + "<p>We're excited to see this one come together!</p>"
    + "<p>Best,<br><strong>Creative Corpus LLC team</strong></p>"
    + "</div>";
}

// ── Date helper ───────────────────────────────────────────────
/**
 * Accepts a Date object, a Sheets serial number, or a date string.
 * Returns a Date at local midnight, or null if unparseable.
 */
function parseDateCell(raw) {
  if (raw instanceof Date && !isNaN(raw)) {
    return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }
  if (typeof raw === "number" && raw > 0) {
    var d = new Date(new Date(1899, 11, 30).getTime() + raw * 86400000);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  var str   = String(raw).trim();
  var parts = str.match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/);
  if (parts) {
    return new Date(parseInt(parts[3], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return null;
}

// ── Diagnostic helper ─────────────────────────────────────────
/**
 * Run debugNotifications() from the Apps Script editor to inspect
 * every row without sending any emails. Check View → Logs.
 */
function debugNotifications() {
  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var projectsSheet = ss.getSheetByName(PROJECTS_SHEET);
  var contactsSheet = ss.getSheetByName(CONTACTS_SHEET);

  Logger.log("=== DEBUG START ===");
  if (!projectsSheet) { Logger.log("FAIL: Sheet '" + PROJECTS_SHEET + "' not found!"); return; }
  if (!contactsSheet) { Logger.log("FAIL: Sheet '" + CONTACTS_SHEET + "' not found!"); return; }

  var contactsData   = contactsSheet.getDataRange().getValues();
  var editorEmailMap = {};
  Logger.log("contacts rows (incl. header): " + contactsData.length);
  for (var c = 0; c < contactsData.length; c++) {
    var en = String(contactsData[c][COL_CONTACT_NAME]).trim();
    var ee = String(contactsData[c][COL_CONTACT_EMAIL]).trim();
    Logger.log("  contacts row " + (c + 1) + ": name='" + en + "'  email='" + ee + "'");
    if (en && ee && ee.indexOf("@") !== -1) editorEmailMap[en.toLowerCase()] = ee;
  }

  var now          = new Date();
  var projectsData = projectsSheet.getDataRange().getValues();
  Logger.log("projects rows (incl. header): " + projectsData.length);
  Logger.log("Current time: " + now.toISOString());
  Logger.log("Trigger status: '" + TRIGGER_STATUS + "'  |  Delay: " + (DELAY_MS / 60000) + " min");

  var eligibleCount = 0;

  for (var r = 0; r < projectsData.length; r++) {
    var row         = projectsData[r];
    var editorName  = String(row[COL_EDITOR_NAME]).trim();
    var status      = String(row[COL_STATUS]).trim();
    var queuedAt    = row[COL_QUEUED_AT];
    var notified    = String(row[COL_NOTIFIED]).trim().toUpperCase();
    var receiveDate = parseDateCell(row[COL_RECEIVE_DATE]);
    var elapsed     = queuedAt ? Math.round((now - new Date(queuedAt)) / 60000) + " min" : "not queued";

    // Determine skip reason (same logic as main function)
    var skipReason = "";
    if (notified === "YES") {
      skipReason = "SKIP – already notified";
    } else if (!receiveDate || receiveDate <= CUTOFF_DATE) {
      skipReason = "SKIP – received on/before cutoff (" + (receiveDate ? receiveDate.toDateString() : "no date") + ")";
    } else if (editorName === "" || status.toLowerCase() !== TRIGGER_STATUS) {
      skipReason = "SKIP – conditions not met (editor='" + editorName + "', status='" + status + "')";
    }

    if (skipReason) {
      // Only log skipped rows briefly to keep the output readable
      Logger.log("  Row " + (r + 1) + " | " + skipReason);
    } else {
      // This row is eligible — log it in full
      eligibleCount++;
      Logger.log("  ✅ ELIGIBLE Row " + (r + 1)
        + " | receiveDate=" + receiveDate.toDateString()
        + " | editor='" + editorName + "'"
        + " | status='" + status + "'"
        + " | queuedAt='" + queuedAt + "'"
        + " | elapsed=" + elapsed
        + " | editorEmail=" + (editorEmailMap[editorName.toLowerCase()] || "⚠️ NOT FOUND IN CONTACTS")
        + " | notified=" + notified);
    }
  }

  Logger.log("Eligible rows found: " + eligibleCount);

  Logger.log("=== DEBUG END ===");
}

// ── Test helper ──────────────────────────────────────────────
/**
 * Sends a test email for any row in the "projects" sheet to YOUR
 * inbox instead of the creative's real address.
 *
 * HOW TO USE:
 *   1. Change TEST_ROW_NUMBER to the row you want to preview (e.g. 765).
 *   2. Select sendTestEmail from the function drop-down and click ▶ Run.
 *   3. Check shanvit1201@gmail.com — the email will arrive in seconds.
 *
 * Nothing in the sheet is modified and no real recipient is contacted.
 */
function sendTestEmail() {
  var TEST_ROW_NUMBER  = 765;                      // ← change to any row number
  var TEST_RECIPIENT   = "shanvit1201@gmail.com";  // ← your inbox

  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var projectsSheet = ss.getSheetByName(PROJECTS_SHEET);
  var contactsSheet = ss.getSheetByName(CONTACTS_SHEET);

  if (!projectsSheet || !contactsSheet) {
    Logger.log("ERROR: Sheet not found."); return;
  }

  // Build editor email map
  var contactsData   = contactsSheet.getDataRange().getValues();
  var editorEmailMap = {};
  for (var c = 0; c < contactsData.length; c++) {
    var en = String(contactsData[c][COL_CONTACT_NAME]).trim();
    var ee = String(contactsData[c][COL_CONTACT_EMAIL]).trim();
    if (en && ee && ee.indexOf("@") !== -1) editorEmailMap[en.toLowerCase()] = ee;
  }

  // Read the requested row (convert 1-based row number to 0-based array index)
  var allRows      = projectsSheet.getDataRange().getValues();
  var rowIndex     = TEST_ROW_NUMBER - 1;

  if (rowIndex < 0 || rowIndex >= allRows.length) {
    Logger.log("ERROR: Row " + TEST_ROW_NUMBER + " is out of range (sheet has " + allRows.length + " rows).");
    return;
  }

  var row          = allRows[rowIndex];
  var creativeName = String(row[COL_CREATIVE_NAME]).trim();
  var projectName  = String(row[COL_PROJECT_NAME]).trim();
  var editorName   = String(row[COL_EDITOR_NAME]).trim();
  var editorEmail  = editorEmailMap[editorName.toLowerCase()] || "(editor email not found)";

  var subject  = buildSubject(projectName);
  var htmlBody = buildEmailBody(creativeName, projectName, editorName, editorEmail);

  MailApp.sendEmail({ to: TEST_RECIPIENT, subject: subject, htmlBody: htmlBody });

  Logger.log("Test email sent to " + TEST_RECIPIENT + " using data from row " + TEST_ROW_NUMBER + ".");
  Logger.log("  creativeName='" + creativeName + "' | projectName='" + projectName + "' | editorName='" + editorName + "' | editorEmail='" + editorEmail + "'");
}

// ── One-time trigger installer ────────────────────────────────
/**
 * Run this ONCE from the Apps Script editor to install a trigger
 * that calls checkProjectsAndNotify() every 15 minutes.
 * Safe to re-run — will not create duplicate triggers.
 */
function createTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var t = 0; t < triggers.length; t++) {
    if (triggers[t].getHandlerFunction() === "checkProjectsAndNotify") {
      Logger.log("Trigger already exists – nothing to do.");
      return;
    }
  }
  ScriptApp.newTrigger("checkProjectsAndNotify")
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log("15-minute trigger created for checkProjectsAndNotify.");
}
