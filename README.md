# Supply Room

A dental practice inventory app for tracking everyday supplies, supplier websites and optional online-order logins, order cadence, procedure links, a configurable monthly budget, and durable equipment purchase, warranty, and repair records. Supabase provides email/password sign-in and a shared practice workspace; Vercel builds and hosts the app.

## Run locally

1. Create a Supabase project and run [`supabase-schema.sql`](./supabase-schema.sql) in its SQL Editor.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project API settings.
3. Run `npm install`, then `npm run dev`.

The first account can create a practice workspace and share its invite code with other team members. Each teammate signs up and joins using that code. Inventory, equipment, expenses, budget, and categories sync to the workspace, including live updates. If two people edit at the same time, the app detects the conflict and asks them to reload rather than overwrite newer cloud data. On the first workspace creation, existing browser data seeds the new workspace; when joining an existing workspace, its cloud data is used.

If Supabase is not configured, the app opens its demo workspace automatically. When Supabase is configured, select **Preview demo data** on the sign-in screen. Demo changes are stored only in that browser and are separate from practice workspace data.

## Deploy to Vercel

1. Push this repository to GitHub and import it in Vercel. Vercel uses the included `vercel.json` and `npm run build`.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Vercel environment variables for the deployments you use, then redeploy.
3. In Supabase Authentication settings, set the production Site URL and add your Vercel deployment URL to the allowed redirect URLs. Configure the local URL too if testing locally. Email confirmation can remain enabled; new users will need to confirm before signing in.
4. Open the deployed app, create an account, create the practice workspace, and share the displayed invite code with the team.

Only use the Supabase project URL and public anon/publishable key in Vercel. Never expose a `service_role` key in this browser app. Keep `.env.local` out of source control. The schema enables row-level security and limits workspace access to authenticated members.

The app still does not connect to TDO12 or sync procedure usage automatically.

## Project notes

- TDO4Endo support ticket [28002](https://intranet.tdo4endo.com/Secure/Support/Ticket.aspx?id=28002) — reference for this project.

## Monthly budget and equipment

Set a monthly budget from the dashboard. Logged supply purchases, equipment purchases, and repair costs are counted against the month in which they occurred. Use **Log purchase** to record a supply order (and optionally receive stock); adding equipment with a purchase price records that purchase once. Equipment records include serial/asset number, purchase date and price, warranty expiration, dealer/contact and optional online login, repair-provider contact, notes, and a viewable repair and issue history. Issues can be marked resolved or reopened.

The inventory is split into **Clinical**, **Office**, and **Equipment** tabs. Clinical supplies can use procedure-based reminders and use estimates. Office supplies have a separate minimum-quantity threshold instead, with no uses-left estimate. Clinical and office categories can be renamed, added, or removed from **Manage categories**; categories assigned to existing items must be reassigned before removal. Larger durable assets belong in the Equipment tab. Materials can be associated with procedure names or codes in the item editor. These mappings are setup data only: this standalone prototype does not connect to TDO12, ingest completed procedures, or decrement stock automatically. A TDO12 integration/API or export format is needed to enable that sync.

Supplies can be flagged as backordered with an order date and optional expected delivery date. The reorder queue offers product-search links at other suppliers already listed in the inventory. These links do not verify product match or live availability; they open a web search limited to the alternate supplier's domain.

## Import and export

Use **Import CSV** to append supplies, or **Export** to download the current supply inventory. CSV headers are case-insensitive; spaces and hyphens are accepted in place of underscores. Required columns are `name` and `quantity`.

| Column | Example |
| --- | --- |
| `name` | Universal composite |
| `category` | Clinical disposable |
| `quantity` | 18 |
| `unit` | syringes |
| `minimum_quantity` | 3 |
| `unit_price` | 42.50 |
| `supplier` | Henry Schein |
| `supplier_url` | https://www.henryschein.com/ |
| `supplier_login_url` | https://example.com/account/login |
| `supplier_contact` | 1-800-472-4346 |
| `order_frequency_days` | 30 |
| `procedure_links` | Apicoectomy, procedure code |
| `units_per_procedure` | 1 |
| `reorder_threshold_uses` | 8 |
| `backordered` | true |
| `backordered_order_date` | 2026-10-30 |
| `expected_delivery_date` | 2026-11-12 |
| `backorder_note` | Vendor confirmation 12345 |

Procedure usage, minimum quantity, and order-cycle estimates are optional; leave those fields blank when unknown. Supplier-sale discovery is not enabled yet: supplier site addresses are needed to identify product search/catalog pages or official deal feeds, and automatic checks require a server/API/feed to avoid browser cross-origin and background-run limitations. The requested initial behavior is in-app alerts checked when the inventory is opened, for tracked-item deals only. For a TDO12 Cloud deployment, the host application still needs to provide authentication, shared storage, the Cloud-tab entry point, and a supported procedure data connection.
