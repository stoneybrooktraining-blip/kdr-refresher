/**
 * KDR Analytics - Google Apps Script Web App
 *
 * Receives anonymous KDR code data when students generate reports.
 * Writes to "KDR Analytics" sheet in the ASPEQ Feedback spreadsheet.
 *
 * SETUP:
 * 1. Open Google Sheets: https://docs.google.com/spreadsheets/d/1JGiHeLi0BEG1EUkyPRhTE5YP05W2IaIA0d8-wJMLGhE
 * 2. Extensions > Apps Script
 * 3. Paste this entire file, replacing any existing code
 * 4. Click Deploy > New deployment
 * 5. Type: Web app
 * 6. Execute as: Me
 * 7. Who has access: Anyone
 * 8. Click Deploy, authorise, copy the URL
 * 9. Paste the URL into index.html where it says PASTE_YOUR_APPS_SCRIPT_URL_HERE
 */

const SPREADSHEET_ID = '1JGiHeLi0BEG1EUkyPRhTE5YP05W2IaIA0d8-wJMLGhE';
const SHEET_NAME = 'KDR Analytics';

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
      // Format header row
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

    // Write one row per code (allows easy pivot/count later)
    const timestamp = new Date().toISOString();
    const examType = data.examType || 'Unknown';
    const codesCount = data.codes.length;
    const rows = data.codes.map(code => [timestamp, data.subject, code, data.hash, examType, codesCount]);

    if (rows.length > 0) {
      sheet.getRange(lastRow + 1, 1, rows.length, 6).setValues(rows);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok', recorded: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (for testing — just returns status)
 */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'KDR Analytics endpoint active' }))
    .setMimeType(ContentService.MimeType.JSON);
}
