# Parent Points Tracker

A small, installable family points app for tracking chores, points, and rewards. The app is a static website: it does not require an app-store install or a server to run. It can be opened in a browser, installed as a Progressive Web App (PWA), and used locally or synced with a family's own Google Sheet. Google Sheets can be connected directly with Google sign-in, or through the legacy Apps Script option.

## Try the app

The GitHub Pages deployment is:

<https://deytrfrancisco.github.io/parent-points/>

Open the link in a supported browser. To install it, use the browser's **Install app** option (Chrome/Edge) or **Add to Home Screen** (mobile Safari/Chrome). Installation availability depends on browser and device.

The PWA caches the app shell for offline use after it has loaded successfully online. Google Sheets sync requires an internet connection.

## What the app does

- Shows each child's point balance, progress toward a goal, and recent activity.
- Awards preset points and supports parent adjustments, including deductions and notes.
- Tracks chores, eligible children, daily completions, and chore activity.
- Provides a reward shop and a queue for reward requests awaiting fulfillment.
- Lets a parent manage the family banner, PIN, child roster, chores, and rewards in Admin.
- Supports multiple children. A parent can add a child with a name, optional birthday, point goal, avatar, and color; edit a name or birthday; and remove a child with confirmation.
- Offers a first-run choice to use local storage, connect a family's Apps Script URL, or create/connect a Google Sheet using Google sign-in.
- Saves changes in the current browser by default. Optional Google Sheets sync lets authorized devices share the same app data.

### Admin and reset options

Open **Admin** and enter the Parent PIN. The initial PIN is `1234`; change it in Admin.

- **Reset Points & Activity** resets point balances and histories, chore records, and pending reward requests. It keeps the roster, chores, rewards, banner, and settings.
- **Full Reset** restores the starter app data and default PIN while keeping the locally configured sync URL. If sync is configured, the reset is also sent to the connected Sheet after a revision check.

The PIN is a convenience gate in the app, not a security boundary for data stored in the browser or Google Sheet.

## First-run setup and starter data

On a first visit with no saved app data, the app offers three choices: create/connect a Google Sheet, paste a family's existing Apps Script sync URL, or use the app on this device only. The starter data is neutral sample data (one profile named **Child 1**, generic chores and rewards). Add or rename profiles in Admin. Full Reset returns to this neutral starter setup. Existing saved family data is not automatically changed by app updates.

The app does not yet support choosing an existing shared Sheet through Google Picker. The direct Google sign-in flow can find Sheets created by this app in the same Google account, which is useful when reconnecting another device signed into that same account. To join a different family member's sheet with the direct API flow, Picker-based shared-sheet selection still needs to be implemented. In the meantime, a family can use its Apps Script URL option.

## Where data is stored

Without Google Sheets sync, the app stores its data in browser `localStorage`. That means:

- Data is local to that browser profile and device; another device does not automatically see it.
- Clearing site/browser data can remove the local copy.
- Anyone using the same browser profile can access that local app data.
- The app shell may be cached for offline use, but cloud sync cannot run offline.

With either Google Sheets sync option, the app stores a JSON snapshot in the sheet tab named `AppData`: cell `A1` contains the app data and `B1` contains a revision number. The snapshot includes the roster, birthdays, points, activity, chore and reward configuration, pending rewards, and the app's Parent PIN.

## Direct Google sign-in setup (app maintainer)

The direct sign-in flow creates a private `Parent Points Family Data` spreadsheet in the signed-in user's Drive, initializes its `AppData` tab, and reads/writes through the Google Sheets API. The Drive API is also used to find spreadsheets created by this app when the same Google account connects from another browser or device. OAuth access tokens are held in memory and are not saved in local storage; Google access must be renewed from a user action after a token expires.

Before this button can work on a deployed copy, the app maintainer must configure a Google Cloud project:

1. Create/select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Sheets API** and **Google Drive API** for that project.
3. Configure the OAuth consent screen/Google Auth Platform with the app name, support email, and audience. Add pilot users as test users while the app is in testing mode.
4. Create an **OAuth client ID** of type **Web application**.
5. Add the published origin (currently `https://deytrfrancisco.github.io`) to **Authorized JavaScript origins**. For local HTTPS development, add only the exact development origin you use.
6. Copy the client ID into `GOOGLE_OAUTH_CLIENT_ID` near the top of the app's inline JavaScript in [`index.html`](./index.html). The client ID is public browser configuration, not a client secret. Never put a client secret in this static app.
7. Deploy the app changes to GitHub Pages. Open it over HTTPS, choose **Create a Google Sheet**, and grant the requested access. The Google account creates/owns the Sheet. The app's first connection initializes that Sheet with the current browser's app data.

The app requests the `drive.file` scope, which is intended to limit access to files created/opened with this app, rather than unrestricted access to the user's Drive. The app currently creates new files and discovers files it created; it does not yet provide Google Picker to select an existing shared spreadsheet. A Google family member who uses a different Google account cannot connect to the direct-created Sheet through Picker yet; use the Apps Script URL option as a pilot workaround or wait for Picker support.

The direct API path uses a read-then-write revision check and verifies writes, but Google Sheets does not provide the atomic compare-and-set used by the Apps Script `LockService` flow. Treat this first version as suitable for a small pilot where edits are not simultaneous; concurrent writes may still race. A stronger multi-writer experience needs an authenticated backend or another atomic coordination mechanism.

OAuth consent, verification, and API quota requirements are set by Google and can change. Testing-mode OAuth apps are limited to configured test users. Do not describe this setup as a guaranteed free service or as a production security review.

## Legacy Apps Script sync setup

This remains available for families who already have a deployed endpoint or want to connect another device using a shared endpoint. Each family should create and control its **own spreadsheet and Apps Script deployment**. Do not paste another family's endpoint into your app, use a shared test spreadsheet for real family data, or publish the deployed endpoint in a public repository, chat, or website.

### Security and privacy warning

The legacy Apps Script endpoint has **no user authentication or per-family authorization**. Anyone who obtains its web app URL may be able to read or overwrite the data in the spreadsheet it is configured to use. The app's Parent PIN does not protect the endpoint; the PIN itself is included in the synced data. Google Apps Script deployment access settings may make the endpoint accessible to anyone, depending on the option selected.

Use this legacy sync flow only for a small, trusted test with non-sensitive data, and share the endpoint privately only with the person who needs to connect another device to that family's data. Do not store information you would not want exposed to someone who gets the URL. This is not suitable for public multi-family production use; that needs authenticated access and stronger server-side authorization.

### Create the spreadsheet

1. Sign in to the Google account that will own the family's data.
2. Create a new Google spreadsheet, for example **Parent Points - Test Family**. Keep it restricted to the people you intend to share it with.
3. Copy the spreadsheet ID from its URL. For a URL of the form `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`, copy only the `SPREADSHEET_ID` part.
4. Keep this spreadsheet separate from any other family's sheet. The script will create a tab named `AppData` the first time it is used.

### Create and configure the Apps Script

1. In the spreadsheet, choose **Extensions → Apps Script**.
2. In the Apps Script editor, open `Code.gs`, remove its contents, and paste the complete script below (also available in [`google-apps-script.js`](./google-apps-script.js)).
3. Replace `PASTE_YOUR_SPREADSHEET_ID_HERE` with the ID copied in the previous section. Keep the ID inside the quotes.
4. Save the project. Give it a recognizable name, such as **Parent Points - Test Family**.

```javascript
// Replace SPREADSHEET_ID with the ID of your own Google spreadsheet before deploying.
// App data stays in AppData!A1; AppData!B1 stores the revision used for conflict checks.
const SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE';
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
```

### Deploy the script as a web app

1. In Apps Script, select **Deploy → New deployment**.
2. Choose the gear icon / deployment type selector, then choose **Web app**.
3. Set **Execute as** to your account (the account that owns the spreadsheet).
4. Choose the access option that allows the intended app clients to call it. Google may show different options based on the account and organizational policy. The broad **Anyone** setting means anyone with the URL may access this unauthenticated endpoint; see the security warning above.
5. Select **Deploy** and authorize the requested Google Sheets access when prompted.
6. Copy the **Web app URL** ending in `/exec`. Keep it private. If you change the script later, create a new version and update the deployment so the live endpoint runs the latest code.

### Connect the app

1. Open the published app over HTTPS: <https://deytrfrancisco.github.io/parent-points/>.
2. Go to **Admin** and enter the Parent PIN.
3. In **Google Drive / Google Sheets Cloud Sync**, paste the private `/exec` URL and choose **Connect & Sync**.
4. On an empty new Sheet, the app initializes it with the current browser's data. Confirm that the sync status reports a verified sync.
5. To connect a second device to the same family, open the app on that device and connect it to the **same family's** endpoint. If the app detects different local and Sheet data, read the prompt carefully: choose to load the Sheet when the Sheet is the source of truth, or keep the local data and upload it only when that is intended.

The app saves its endpoint and current Sheet revision in that browser's local storage. Each device/browser must be connected separately. If a sync conflict occurs, the app keeps local changes and asks you to resolve the mismatch; use **Sync now** and review the prompt rather than assuming either copy was merged.

## Small pilot with another person

For the simplest test, send them the GitHub Pages link. Their first visit offers local-only use, a Google Sheet, or a family Apps Script URL. Direct sign-in must first be enabled/configured by the app owner, and Google OAuth testing may require adding the tester as a test user. The direct Sheet flow can rediscover a Sheet on another device signed into the same Google account. To share a family's data with someone using a different Google account, create a **separate test spreadsheet and Apps Script deployment** and privately give the trusted tester that family's `/exec` URL; the Apps Script endpoint has the security limitations above.

Never give a tester the endpoint currently used by another family. The endpoint is effectively a bearer link: possession grants access under the current implementation.

## Updating the app

The app is hosted as static files on GitHub Pages. After changes to the repository are deployed, reload the site to get the new version. The service worker caches the app shell for offline use, so a previously installed copy may continue to show its cached shell until it reconnects and updates. Google Apps Script deployments are separate: updating the source file in the repository does not update an already deployed web app. Redeploy the Apps Script project when its code changes.

## Repository files

- [`index.html`](./index.html) — app UI, app logic, starter data, local storage, and client-side sync.
- [`google-apps-script.js`](./google-apps-script.js) — Apps Script web app source to copy into the family's own Apps Script project after replacing the spreadsheet ID placeholder.
- [`manifest.webmanifest`](./manifest.webmanifest) — installable PWA metadata.
- [`service-worker.js`](./service-worker.js) — app-shell caching and offline behavior.
- [`icons/`](./icons/) — PWA icons.
