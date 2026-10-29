# Librairie Samir Shoker — Shop & Owner apps

Two phone apps (they also open on a PC) that share one database:

| App | Address | Who uses it | What it does |
|---|---|---|---|
| **Shop** (blue) | `…/staff/` | Employees, and owners at the till | Sell with barcode scanning, $ and LL payments, customers and credit, bike repair jobs, stock entry and counts, PDF receipts |
| **Owner** (green) | `…/owner/` | You and your father | Everything above, plus cost prices, suppliers, purchase orders, profit and sales reports, employee accounts, settings, school book planner |

The database enforces the split: an employee account cannot read cost prices, suppliers, purchase orders, profits or reports, cannot change selling prices, and cannot change stock quantities except through a sale or a logged stock adjustment. Hiding screens is not what protects this; the database refuses the data.

Arabic, French and English, switchable at the top of every screen.

---

## Setup (about 30 minutes, once)

### 1. Create the database (Supabase)
1. Create a free account at https://supabase.com and click **New project**. Pick a region close to Lebanon (for example Frankfurt). Save the database password somewhere safe.
2. In the project, open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and click **Run**. It should finish with "Success". You can run it again later without losing data.
3. Open **Authentication → Sign In / Providers → Email** and:
   - turn **Confirm email** OFF (employees log in with a username, so no confirmation email can reach them);
   - keep **Enable email signups** ON (the Owner app uses it to create employee accounts).
4. Open **Project Settings → API keys** (called "API" in some projects) and copy:
   - the **Project URL**;
   - the **anon public** key. In newer dashboards it sits under **API Keys → Legacy API keys**; use that one.
   Never use the `service_role` / secret key in the apps.

### 2. Connect the apps to the database
Edit `shared/config.js` and paste the two values:

```js
export const SUPABASE_URL = "https://abcdefgh.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi…";
```

The anon key is designed to be public; the database permissions protect the data.

### 3. Put the apps online (free)
**GitHub Pages** (simplest):
1. Create a repository on GitHub and upload this whole folder (or push it with git).
2. In the repository: **Settings → Pages → Build and deployment → Deploy from a branch**, branch `main`, folder `/ (root)`.
3. After a minute the apps are at:
   - `https://<your-github-name>.github.io/<repo>/owner/`
   - `https://<your-github-name>.github.io/<repo>/staff/`

GitHub Pages needs a public repository on a free account. The code holds no secrets, but if you want the repository private, use **Netlify** or **Cloudflare Pages** instead (both free): connect the GitHub repository, leave the build command empty, and set the publish folder to `/`.

### 4. First login
1. Open the **Owner** app and tap **First time? Create the owner account**. Use your email and a strong password. The first account created this way becomes the owner; later sign-ups get no access.
2. Go to **More → Team → Add employee**:
   - add your father with role **Owner**;
   - add each employee with role **Employee** and a simple username such as `rami`. Write the username and password down for them.
3. **More → Settings**: shop address, phone, receipt footer, and the LL exchange rate.

### 5. Install on phones
- **Android (Chrome):** open the app address, then menu ⋮ → **Install app** (or **Add to Home screen**).
- **iPhone (Safari):** open the address, then Share → **Add to Home Screen**.

Employees install the **Shop** address. You and your father install the **Owner** address (the Shop app also works for you at the till).

---

## Everyday use
- **Selling:** tap **Scan** and point the camera at barcodes. Each one is added to the sale, and the camera stays open for the next. A USB or Bluetooth barcode scanner (around $20–30) is faster at the counter: tap the search box and scan. Items without a barcode can be searched by name; photocopies and services go in as a **Custom item**.
- **Payment:** enter what the customer paid in $ and/or LL; the app shows the change in LL. If a customer is attached, tick "put the unpaid part on the customer's account" to record credit.
- **Receipts:** after each sale, **Download PDF**. On phones this opens the share sheet, so it can go straight to WhatsApp. Owners can reopen and cancel any receipt from **Receipts**.
- **Bike repairs:** **Repairs → New repair job**: customer, bike, problem, labour, parts. Print a repair ticket for the customer. When the bike is ready, **Bill & hand over** fills the till with the parts and labour.
- **Loading stock:** employees add products in **Stock → Add product** (scan the barcode, enter price and quantity). Owners can instead import an Excel sheet saved as CSV (**Stock → Import CSV**) with the columns `name, barcode, category, cost, price, qty, min, supplier`. Products already in the catalogue are skipped.
- **Book season:** **More → Schools**: for each school, add classes with student numbers and link the books. The planner shows how many to order and creates one purchase order per supplier.

## Good to know
- **Internet is required** to save sales. The apps open without internet, but they warn that nothing can be saved until the connection is back.
- **Supabase free plan:** 500 MB of data (years of sales for one shop) and 2 projects. A free project is **paused after one week with no activity**. A shop that sells every day won't hit that, but if the shop closes for a while, open the Supabase dashboard and restore the project. The Pro plan ($25/month) removes the pause and adds daily backups.
- **Backups on the free plan:** export from **Stock → Export CSV** and **Reports → Export CSV** regularly.
- **Forgotten employee password:** there is no reset by email. In **Team**, set the old account to inactive and create a new one.
- **Prices:** stored in US dollars. LL amounts use the rate in Settings and are rounded to 1,000 LL.

## Making changes later
The code is plain HTML, CSS and JavaScript with no build step:

```
supabase/schema.sql    database tables, permissions and functions
shared/config.js       your Supabase address and key
shared/core.js         every read and write to the database
shared/views-common.js Sell, Stock, Customers, Repairs, Receipts (both apps)
shared/views-owner.js  Dashboard, Reports, Orders, Suppliers, Schools, Team, Settings
shared/i18n.js         all Arabic / French / English text
shared/receipt.js      receipt and repair ticket PDFs
shared/scanner.js      camera barcode scanning
shared/styles.css      look and feel
shared/vendor/         bundled libraries (supabase-js 2.45.4, html2pdf.js 0.10.2, html5-qrcode 2.3.8)
staff/  owner/         the two app entry pages, icons and install files
```

To have Claude (or any developer) change something, share the repository or a zip of this folder. Database changes go in a new SQL file run in the SQL Editor, so existing data stays intact. After changing app files, bump `CACHE` in `staff/sw.js` and `owner/sw.js` (e.g. `ls-v2`) so installed phones pick up the update.
