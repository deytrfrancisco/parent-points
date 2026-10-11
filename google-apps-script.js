// Replace the existing Apps Script code with this file's contents.
// App data stays in AppData!A1; AppData!B1 stores the revision used for conflict checks.
const SPREADSHEET_ID = '1DsJwwajJxYhTh9F8-4_QlaN7iQzgjF-ZC4YNww9LXO4';
const DATA_SHEET_NAME = 'AppData';
const DATA_RANGE = 'A1:B1';

function getDataSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(DATA_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(DATA_SHEET_NAME);
  }

  return sheet;
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function readSnapshot_(sheet) {
  const values = sheet.getRange(DATA_RANGE).getValues()[0];
  const storedData = values[0];
  const storedRevision = values[1];
  const revision = storedRevision === '' ? 0 : Number(storedRevision);

  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('The sync revision in AppData!B1 is invalid.');
  }

  const data = storedData ? JSON.parse(storedData) : null;
  if (data !== null && (!data || !Array.isArray(data.kids))) {
    throw new Error('The saved app data in AppData!A1 is invalid.');
  }

  return { data, revision };
}

function doGet(e) {
  const callback = e && e.parameter && e.parameter.callback;
  if (!callback || !/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return jsonResponse_({ error: 'A valid callback is required.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  let snapshot;
  try {
    snapshot = readSnapshot_(getDataSheet_());
  } finally {
    lock.releaseLock();
  }

  return ContentService
    .createTextOutput(`${callback}(${JSON.stringify(snapshot)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(e) {
  const contents = e && e.postData && e.postData.contents;
  if (!contents) {
    return jsonResponse_({ ok: false, error: 'No sync request received.' });
  }

  const request = JSON.parse(contents);
  if (
    !request ||
    !request.data ||
    !Array.isArray(request.data.kids) ||
    !Number.isSafeInteger(request.expectedRevision) ||
    request.expectedRevision < 0
  ) {
    return jsonResponse_({ ok: false, error: 'The revision-checked sync request is invalid.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  let response;
  try {
    const sheet = getDataSheet_();
    const current = readSnapshot_(sheet);
    if (request.expectedRevision !== current.revision) {
      response = {
        ok: false,
        conflict: true,
        revision: current.revision
      };
    } else {
      const nextRevision = current.revision + 1;
      sheet.getRange(DATA_RANGE).setValues([
        [JSON.stringify(request.data), nextRevision]
      ]);
      response = { ok: true, revision: nextRevision };
    }
  } finally {
    lock.releaseLock();
  }

  return jsonResponse_(response);
}
