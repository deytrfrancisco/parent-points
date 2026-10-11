# Parent Points Tracker

A small, installable family points app for tracking chores, points, and rewards. The app is a static website: it does not require an app-store install or a server to run. It can be opened in a browser, installed as a Progressive Web App (PWA), and used locally or synced with a family's own Google Sheet through its Apps Script web app.

## Contents

- [1. Try the app](#1-try-the-app)
- [2. Getting started](#2-getting-started)
- [3. Add the app to a phone's Home Screen](#3-add-the-app-to-a-phones-home-screen)
  - [3.1 iPhone or iPad (Safari)](#31-iphone-or-ipad-safari)
  - [3.2 Android (Chrome)](#32-android-chrome)
- [4. Google Sheets sync setup (Apps Script)](#4-google-sheets-sync-setup-apps-script)
  - [4.1 Create the spreadsheet](#41-create-the-spreadsheet)
  - [4.2 Create and configure the Apps Script](#42-create-and-configure-the-apps-script)
  - [4.3 Deploy the script as a web app](#43-deploy-the-script-as-a-web-app)
  - [4.4 Connect the app](#44-connect-the-app)
  - [4.5 Security and privacy warning](#45-security-and-privacy-warning)
- [5. What the app does](#5-what-the-app-does)
  - [5.1 Admin and reset options](#51-admin-and-reset-options)
- [6. First-run setup and starter data](#6-first-run-setup-and-starter-data)
- [7. Where data is stored](#7-where-data-is-stored)
- [8. Data privacy and safety](#8-data-privacy-and-safety)
- [9. Small pilot with another person](#9-small-pilot-with-another-person)
- [10. Direct Google sign-in (NOT IMPLEMENTED)](#10-direct-google-sign-in-not-implemented)
- [11. Updating the app](#11-updating-the-app)
- [12. Repository files](#12-repository-files)


## 1. Try the app

The GitHub Pages deployment is:

<https://deytrfrancisco.github.io/parent-points/>

Open the link in a supported browser. On a phone, follow the platform-specific install directions below to add it to the Home Screen.

The PWA caches the app shell for offline use after it has loaded successfully online. Google Sheets sync requires an internet connection.

## 2. Getting started

For the easiest first try, open the published app and choose **Use on this device only**. You can start setting up your family right away; the app saves data in that browser on that phone. You do not need to create a Google Sheet or deploy a script first.

The initial Parent PIN is **1234**. Change it in **Admin** after getting started.

When you are ready to share the family's data across devices, set up the family's Google Sheet and Apps Script using the instructions below. Then open **Admin** in the app and paste the Apps Script web app URL into **Google Drive / Google Sheets Cloud Sync** and select **Connect & Sync**. The same family endpoint can then be connected from each family member's device. Treat that URL as private; anyone who obtains it may be able to access the family data.

Direct Google sign-in is not implemented yet, so do not select that option expecting it to create a sheet. You can continue using local-only data until the Apps Script setup is ready.

## 3. Add the app to a phone's Home Screen

### 3.1 iPhone or iPad (Safari)

1. Open the app link in **Safari**: <https://deytrfrancisco.github.io/parent-points/>.
2. Tap Safari's **Share** button (the square with an upward arrow, as if sharing the page with someone).
3. Scroll the share sheet if needed, then tap **Add to Home Screen**. If you do not see it, scroll to the bottom of the actions, tap **Edit Actions**, and add it.
4. Choose a name if desired, then tap **Add**. Open Parent Points from its new Home Screen icon.

### 3.2 Android (Chrome)

1. Open the app link in **Chrome**: <https://deytrfrancisco.github.io/parent-points/>.
2. Tap Chrome's **three-dot menu** in the top-right corner.
3. Tap **Install app** or **Add to Home screen** (the wording can vary by device).
4. Confirm by tapping **Install** or **Add**, then launch Parent Points from the new icon.

If the install option is not shown, first open the app link in the platform browser above and let the page finish loading. Browser and operating-system versions can change the menu wording or availability.

## 4. Google Sheets sync setup (Apps Script)

Set up a spreadsheet and an Apps Script web app for each family. This is the currently supported way to sync a family's data across devices. Each family should create and control its **own spreadsheet and Apps Script deployment**.

### 4.1 Create the spreadsheet

1. Sign in to the Google account that will own the family's data.
2. Create a new Google spreadsheet, for example **Parent Points - Test Family**. Keep it restricted to the people you intend to share it with.
3. Copy the spreadsheet ID from its URL. For a URL of the form `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`, copy only the `SPREADSHEET_ID` part.
4. Keep this spreadsheet separate from any other family's sheet. The script will create a tab named `AppData` the first time it is used.

### 4.2 Create and configure the Apps Script

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

### 4.3 Deploy the script as a web app

1. In Apps Script, select **Deploy → New deployment**.
2. Choose the gear icon / deployment type selector, then choose **Web app**.
3. Set **Execute as** to your account (the account that owns the spreadsheet).
4. Choose the access option that allows the intended app clients to call it. Google may show different options based on the account and organizational policy. The broad **Anyone** setting means anyone with the URL may access this unauthenticated endpoint; see the security warning above.
5. Select **Deploy** and authorize the requested Google Sheets access when prompted.
6. Copy the **Web app URL** ending in `/exec`. Keep it private. If you change the script later, create a new version and update the deployment so the live endpoint runs the latest code.

### 4.4 Connect the app

1. Open the published app over HTTPS: <https://deytrfrancisco.github.io/parent-points/>.
2. Go to **Admin** and enter the Parent PIN.
3. In **Google Drive / Google Sheets Cloud Sync**, paste the private `/exec` URL and choose **Connect & Sync**.
4. On an empty new Sheet, the app initializes it with the current browser's data. Confirm that the sync status reports a verified sync.
5. To connect a second device to the same family, open the app on that device and connect it to the **same family's** endpoint. If the app detects different local and Sheet data, read the prompt carefully: choose to load the Sheet when the Sheet is the source of truth, or keep the local data and upload it only when that is intended.

The app saves its endpoint and current Sheet revision in that browser's local storage. Each device/browser must be connected separately. If a sync conflict occurs, the app keeps local changes and asks you to resolve the mismatch; use **Sync now** and review the prompt rather than assuming either copy was merged.

### 4.5 Security and privacy warning

The Apps Script endpoint has **no user authentication or per-family authorization**. Anyone who obtains its web app URL may be able to read or overwrite the data in the spreadsheet it is configured to use. The app's Parent PIN does not protect the endpoint; the PIN itself is included in the synced data. Google Apps Script deployment access settings may make the endpoint accessible to anyone, depending on the option selected.

Treat the `/exec` URL as private and share it only with trusted family members who should access that family's data. Do not post it publicly, use another family's endpoint, or send the URL to the app developer. Do not store information you would not want exposed to someone who gets the URL. This setup is intended for trusted family use, not public multi-family production; that requires authenticated access and stronger server-side authorization.

## 5. What the app does

- Shows each child's point balance, progress toward a goal, and recent activity.
- Awards preset points and supports parent adjustments, including deductions and notes.
- Tracks chores, eligible children, daily completions, and chore activity.
- Provides a reward shop and a queue for reward requests awaiting fulfillment.
- Lets a child cancel a pending reward request to return its points, and shows how many days each request has been waiting.
- Lets a parent manage the family banner, PIN, child roster, chores, and rewards in Admin.
- Supports multiple children. A parent can add a child with a name, optional birthday, point goal, avatar, and color; edit a name or birthday; and remove a child with confirmation.
- Offers a first-run choice to use local storage or connect a family's Apps Script URL. A direct Google sign-in option is visible in the app but is not implemented yet.
- Saves changes in the current browser by default. Optional Google Sheets sync lets authorized devices share the same app data.

### 5.1 Admin and reset options

Open **Admin** and enter the Parent PIN. The initial PIN is `1234`; change it in Admin.

- **Reset Points & Activity** resets point balances and histories and clears chore records. It keeps the roster, chores, rewards, banner, settings, and pending reward requests.
- **Full Reset** restores the starter app data and default PIN while keeping the locally configured sync URL. If sync is configured, the reset is also sent to the connected Sheet after a revision check.

The PIN is a convenience gate in the app, not a security boundary for data stored in the browser or Google Sheet.
Daily chore completions are tracked by date; pending reward requests are not part of that daily reset and remain queued until a parent fulfills them or the request is canceled. The **Reset Points & Activity** option also preserves pending reward requests. Canceling a request refunds its point cost and records the cancellation in the child's activity history. Requests created before requested dates were recorded show that their age is unavailable.

## 6. First-run setup and starter data

On a first visit with no saved app data, the app offers local-only use or connection to a family's Apps Script URL. The direct Google sign-in choice is currently a placeholder and will not connect. The starter data has one neutral profile named **Child 1** and uses the chore and reward catalog provided for the original family as example options. Chores are initially assigned to Child 1. Change or remove any options and add or rename profiles in Admin. Full Reset restores these starter options and the default PIN, not any family's saved data. Existing saved family data is not automatically changed by app updates.

## 7. Where data is stored

Without Google Sheets sync, the app stores its data in browser `localStorage`. That means:

- Data is local to that browser profile and device; another device does not automatically see it.
- Clearing site/browser data can remove the local copy.
- Anyone using the same browser profile can access that local app data.
- The app shell may be cached for offline use, but cloud sync cannot run offline.

With Apps Script sync, the app stores a JSON snapshot in the sheet tab named `AppData`: cell `A1` contains the app data and `B1` contains a revision number. The snapshot includes the roster, birthdays, points, activity, chore and reward configuration, pending rewards, and the app's Parent PIN.

## 8. Data privacy and safety

- The app is hosted as static files. It does not have a developer-operated database or server that receives family records. With local-only use, app data stays in that browser's local storage. With Apps Script sync, the family’s data is stored in the Google spreadsheet configured by that family.
- The app developer does not automatically get access to a family's Google account or spreadsheet just because the family uses the published app. Google Drive sharing controls who can open the spreadsheet itself.
- The Parent PIN is included in the synced app data. It is only an in-app convenience lock; it does not encrypt the Sheet or secure the Apps Script URL.
- **Important limitation:** the current Apps Script web app does not authenticate individual users. Anyone who obtains its `/exec` URL may be able to read or change that family’s app data through the app, even if the spreadsheet itself is not shared with them. Treat that URL like a password: share it privately only with trusted family members who should use that family’s data. Do not post it publicly or send it to the app developer.
- Keep the spreadsheet restricted to the intended people, use a separate spreadsheet and deployment for each family, and avoid storing sensitive information. Google account security, spreadsheet sharing settings, and possession of the endpoint URL matter.

The app can be shared publicly; that does not itself give the developer access to the family's Sheet. However, anyone with the family-specific Apps Script URL may be able to access the data the script exposes. Do not interpret this setup as end-to-end encryption or as a security guarantee.

## 9. Small pilot with another person

For the simplest test, send them the GitHub Pages link. They can use the app locally, or you can set up a family spreadsheet and Apps Script endpoint and privately give the trusted family member that family's `/exec` URL. Anyone with the URL may be able to access that family's data, so share it only with people who should have access. Direct Google sign-in is not implemented and is not required for the Apps Script setup.

Never give a tester the endpoint currently used by another family. The endpoint is effectively a bearer link: possession grants access under the current implementation.

## 10. Direct Google sign-in (NOT IMPLEMENTED)

The app displays an early placeholder for creating a Sheet through Google sign-in, but users cannot currently complete this flow. Do not follow OAuth setup instructions or expect a Google login prompt to create a working sync. This feature would require a configured Google Cloud project, OAuth client, and additional implementation and testing before it is ready. The currently supported Google Sheets setup is the manual Apps Script process described above.

## 11. Updating the app

The app is hosted as static files on GitHub Pages. After changes to the repository are deployed, reload the site to get the new version. The service worker caches the app shell for offline use, so a previously installed copy may continue to show its cached shell until it reconnects and updates. Google Apps Script deployments are separate: updating the source file in the repository does not update an already deployed web app. Redeploy the Apps Script project when its code changes.

## 12. Repository files

- [`index.html`](./index.html) — app UI, app logic, starter data, local storage, and client-side sync.
- [`google-apps-script.js`](./google-apps-script.js) — Apps Script web app source to copy into the family's own Apps Script project after replacing the spreadsheet ID placeholder.
- [`manifest.webmanifest`](./manifest.webmanifest) — installable PWA metadata.
- [`service-worker.js`](./service-worker.js) — app-shell caching and offline behavior.
- [`icons/`](./icons/) — PWA icons.
