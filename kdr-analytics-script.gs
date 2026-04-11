/**
 * KDR Analytics - Google Apps Script Web App
 *
 * Receives anonymous KDR code data when students generate reports.
 * Writes to "KDR Analytics" sheet in the ASPEQ Feedback spreadsheet.
 * Maintains a "KDR Summary" sheet with code frequency rankings.
 * Sends a weekly email report every Monday at 8am NZ time.
 *
 * SETUP:
 * 1. Open Google Sheets: https://docs.google.com/spreadsheets/d/1JGiHeLi0BEG1EUkyPRhTE5YP05W2IaIA0d8-wJMLGhE
 * 2. Extensions > Apps Script
 * 3. Paste this entire file, replacing any existing code
 * 4. Click Deploy > Manage deployments > Edit (pencil icon) > Version: New version > Deploy
 * 5. Run setupWeeklyEmail() once from the editor (Run button) to create the weekly trigger
 *    - It will ask for authorisation to send email — approve it
 */

const SPREADSHEET_ID = '1JGiHeLi0BEG1EUkyPRhTE5YP05W2IaIA0d8-wJMLGhE';
const SHEET_NAME = 'KDR Analytics';
const SUMMARY_SHEET_NAME = 'KDR Summary';
const REPORT_EMAIL = 'stoneybrooktraining@gmail.com';

/**
 * Handle POST requests from the KDR Refresher Generator
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Validate required fields
    if (!data.subject || !data.codes || !data.hash) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing required fields' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Create sheet with headers if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['Timestamp', 'Subject', 'Code', 'Hash', 'Exam Type', 'Codes Count']);
      const headerRange = sheet.getRange(1, 1, 1, 6);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#139DA3');
      headerRange.setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }

    // Check for duplicate hash — if this KDR has already been recorded, skip
    const hashCol = 4; // Column D
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const hashes = sheet.getRange(2, hashCol, lastRow - 1, 1).getValues().flat();
      if (hashes.includes(data.hash)) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'duplicate', message: 'KDR already recorded' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Write one row per code
    const timestamp = new Date().toISOString();
    const examType = data.examType || 'Unknown';
    const codesCount = data.codes.length;
    const rows = data.codes.map(code => [timestamp, data.subject, code, data.hash, examType, codesCount]);

    if (rows.length > 0) {
      sheet.getRange(lastRow + 1, 1, rows.length, 6).setValues(rows);
    }

    // Rebuild the summary sheet after each new KDR
    rebuildSummary();

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok', recorded: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (for testing)
 */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'KDR Analytics endpoint active' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ====================================================
// SUMMARY SHEET — auto-maintained code frequency table
// ====================================================

function rebuildSummary() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rawSheet = ss.getSheetByName(SHEET_NAME);
  if (!rawSheet || rawSheet.getLastRow() < 2) return;

  // Get all raw data
  const data = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, 6).getValues();

  // Count code frequency: { "CPL|human factors|34.30.14(b)": count }
  const codeCounts = {};
  const uniqueHashes = new Set();

  data.forEach(row => {
    const subject = row[1];
    const code = row[2];
    const hash = row[3];
    const examType = row[4];
    const key = examType + '|' + subject + '|' + code;
    codeCounts[key] = (codeCounts[key] || 0) + 1;
    uniqueHashes.add(hash);
  });

  // Build sorted summary rows (most frequent first)
  const summaryRows = Object.entries(codeCounts)
    .map(([key, count]) => {
      const parts = key.split('|');
      return [parts[0], parts[1], parts[2], count];
    })
    .sort((a, b) => b[3] - a[3]); // Sort by count descending

  // Create or clear summary sheet
  let summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  if (!summarySheet) {
    summarySheet = ss.insertSheet(SUMMARY_SHEET_NAME);
  } else {
    summarySheet.clearContents();
  }

  // Stats header
  summarySheet.getRange(1, 1).setValue('KDR Analytics Summary');
  summarySheet.getRange(1, 1).setFontSize(14).setFontWeight('bold').setFontColor('#139DA3');
  summarySheet.getRange(2, 1).setValue('Last updated: ' + new Date().toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' }));
  summarySheet.getRange(2, 1).setFontColor('#666666').setFontSize(9);

  summarySheet.getRange(3, 1).setValue('Total unique KDRs processed:');
  summarySheet.getRange(3, 2).setValue(uniqueHashes.size);
  summarySheet.getRange(3, 1, 1, 2).setFontWeight('bold');

  summarySheet.getRange(4, 1).setValue('Total code appearances:');
  summarySheet.getRange(4, 2).setValue(data.length);

  // Table headers at row 6
  const headerRow = 6;
  const headers = ['Exam Type', 'Subject', 'Code', 'Times Appeared'];
  summarySheet.getRange(headerRow, 1, 1, 4).setValues([headers]);
  summarySheet.getRange(headerRow, 1, 1, 4)
    .setFontWeight('bold')
    .setBackground('#139DA3')
    .setFontColor('#FFFFFF');
  summarySheet.setFrozenRows(headerRow);

  // Write summary data
  if (summaryRows.length > 0) {
    summarySheet.getRange(headerRow + 1, 1, summaryRows.length, 4).setValues(summaryRows);

    // Colour-code the top 10 most frequent codes
    const topCount = Math.min(10, summaryRows.length);
    summarySheet.getRange(headerRow + 1, 1, topCount, 4).setBackground('#FFF9E0'); // Light gold highlight
  }

  // Auto-resize columns
  summarySheet.autoResizeColumns(1, 4);
}

// ====================================================
// WEEKLY EMAIL REPORT
// ====================================================

/**
 * Run this function ONCE manually to set up the weekly email trigger.
 * Go to Run > setupWeeklyEmail in the Apps Script editor.
 */
function setupWeeklyEmail() {
  // Remove any existing weekly triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendWeeklyReport') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger: every Monday at 8am NZ time
  ScriptApp.newTrigger('sendWeeklyReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .nearMinute(0)
    .inTimezone('Pacific/Auckland')
    .create();

  Logger.log('Weekly email trigger created — runs every Monday at 8am NZT');
}

/**
 * Compiles and sends the weekly analytics report.
 * Called automatically by the trigger, or run manually to test.
 */
function sendWeeklyReport() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rawSheet = ss.getSheetByName(SHEET_NAME);

  if (!rawSheet || rawSheet.getLastRow() < 2) {
    // No data yet — don't send an empty email
    return;
  }

  const allData = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, 6).getValues();

  // Filter to last 7 days
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const thisWeek = allData.filter(row => new Date(row[0]) >= oneWeekAgo);
  const thisWeekHashes = new Set(thisWeek.map(row => row[3]));
  const allTimeHashes = new Set(allData.map(row => row[3]));

  // This week's code frequency
  const weekCodeCounts = {};
  const weekSubjectCounts = {};
  thisWeek.forEach(row => {
    const subject = row[1];
    const code = row[2];
    const examType = row[4];
    const key = examType + ' ' + subject + ' — ' + code;
    weekCodeCounts[key] = (weekCodeCounts[key] || 0) + 1;

    const subKey = examType + ' ' + subject;
    if (!weekSubjectCounts[subKey]) weekSubjectCounts[subKey] = new Set();
    weekSubjectCounts[subKey].add(row[3]); // Count unique KDRs per subject
  });

  // All-time code frequency
  const allCodeCounts = {};
  allData.forEach(row => {
    const key = row[4] + ' ' + row[1] + ' — ' + row[2];
    allCodeCounts[key] = (allCodeCounts[key] || 0) + 1;
  });

  // Sort by frequency
  const topWeekCodes = Object.entries(weekCodeCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topAllTimeCodes = Object.entries(allCodeCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

  // Build email body
  const nzDate = new Date().toLocaleDateString('en-NZ', { timeZone: 'Pacific/Auckland', day: 'numeric', month: 'long', year: 'numeric' });

  let html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">';
  html += '<div style="background:#1F2528;padding:20px;border-bottom:3px solid #BBB546;">';
  html += '<h1 style="color:#fff;margin:0;font-size:20px;">KDR Analytics — Weekly Report</h1>';
  html += '<p style="color:#BBB546;margin:4px 0 0;font-size:13px;">' + nzDate + '</p>';
  html += '</div>';

  // This week summary
  html += '<div style="padding:20px;">';
  html += '<h2 style="color:#139DA3;font-size:16px;border-bottom:2px solid #BBB546;padding-bottom:8px;">This Week</h2>';
  html += '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">';
  html += '<tr><td style="padding:6px 0;font-weight:bold;">KDRs processed this week:</td><td style="text-align:right;">' + thisWeekHashes.size + '</td></tr>';
  html += '<tr><td style="padding:6px 0;font-weight:bold;">Total KDRs all time:</td><td style="text-align:right;">' + allTimeHashes.size + '</td></tr>';
  html += '<tr><td style="padding:6px 0;font-weight:bold;">Code appearances this week:</td><td style="text-align:right;">' + thisWeek.length + '</td></tr>';
  html += '</table>';

  // Subject breakdown
  if (Object.keys(weekSubjectCounts).length > 0) {
    html += '<h3 style="color:#1F2528;font-size:14px;">Subjects this week</h3>';
    html += '<table style="width:100%;border-collapse:collapse;">';
    Object.entries(weekSubjectCounts)
      .sort((a, b) => b[1].size - a[1].size)
      .forEach(([subject, hashes]) => {
        html += '<tr><td style="padding:4px 0;">' + subject + '</td><td style="text-align:right;">' + hashes.size + ' KDR' + (hashes.size > 1 ? 's' : '') + '</td></tr>';
      });
    html += '</table>';
  }

  // Top codes this week
  if (topWeekCodes.length > 0) {
    html += '<h2 style="color:#139DA3;font-size:16px;border-bottom:2px solid #BBB546;padding-bottom:8px;margin-top:24px;">Top Failing Codes This Week</h2>';
    html += '<table style="width:100%;border-collapse:collapse;">';
    html += '<tr style="background:#139DA3;color:#fff;"><th style="padding:8px;text-align:left;">Code</th><th style="padding:8px;text-align:right;">Count</th></tr>';
    topWeekCodes.forEach(([code, count], i) => {
      const bg = i < 5 ? '#FFF9E0' : '#fff';
      html += '<tr style="background:' + bg + ';"><td style="padding:6px 8px;border-bottom:1px solid #eee;">' + code + '</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee;">' + count + '</td></tr>';
    });
    html += '</table>';
  }

  // Top codes all time
  if (topAllTimeCodes.length > 0) {
    html += '<h2 style="color:#139DA3;font-size:16px;border-bottom:2px solid #BBB546;padding-bottom:8px;margin-top:24px;">Top Failing Codes All Time</h2>';
    html += '<table style="width:100%;border-collapse:collapse;">';
    html += '<tr style="background:#139DA3;color:#fff;"><th style="padding:8px;text-align:left;">Code</th><th style="padding:8px;text-align:right;">Count</th></tr>';
    topAllTimeCodes.forEach(([code, count], i) => {
      const bg = i < 5 ? '#FFF9E0' : '#fff';
      html += '<tr style="background:' + bg + ';"><td style="padding:6px 8px;border-bottom:1px solid #eee;">' + code + '</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #eee;">' + count + '</td></tr>';
    });
    html += '</table>';
  }

  // Footer
  html += '<div style="margin-top:24px;padding-top:16px;border-top:2px solid #BBB546;font-size:12px;color:#666;">';
  html += '<p><a href="https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '" style="color:#139DA3;">Open full spreadsheet</a></p>';
  html += '<p>Stoneybrook Training — KDR Analytics</p>';
  html += '</div></div></div>';

  MailApp.sendEmail({
    to: REPORT_EMAIL,
    subject: 'KDR Analytics Weekly Report — ' + nzDate,
    htmlBody: html
  });
}
