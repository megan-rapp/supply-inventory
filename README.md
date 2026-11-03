# Supply Room

A standalone inventory dashboard prototype for a dental practice. It tracks everyday supplies, supplier websites and optional online-order logins, order cadence, procedure links, a configurable monthly budget, and durable equipment purchase, warranty, and repair records.

## Run

Open `index.html` in a modern browser. The starter supply inventory is sample data. Changes are saved in that browser's local storage; this prototype does not connect to TDO12 or sync between devices.

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
