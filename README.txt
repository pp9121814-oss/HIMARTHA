SHAILYA — AIPAN ART CLOCKS ONLINE STORE
======================================
A complete, responsive storefront + owner admin + private order records.

WHAT IS INCLUDED
----------------
- index.html: premium ivory / maroon / gold storefront, Aipan-inspired art direction,
  animated glass-style navigation, water-drop decorations, responsive layout, search,
  category filters, product photos, cart, quantity controls and wishlist.
- Checkout form: receiver name, Indian mobile, house/street/village, locality, post
  office, landmark, city, district, state, 6-digit PIN, delivery instructions and
  optional GPS coordinates after browser permission. A consent checkbox is required.
- Secure order submission: customer checkout saves an order in Supabase and receives
  a unique SH-... order number. Order checkout does NOT send the order to WhatsApp.
- admin.html: owner email/password login, add/edit/delete products, price, stock,
  active/draft status, product-photo upload, orders search/filter and status counts.
- order.html: private, full order page with all ordered product photos, item quantities,
  prices, product subtotal, shipping fee / final total, full address, PIN, GPS map link,
  checkout consent, courier name, AWB/tracking ID, tracking URL, status and private notes.
  Owner can save/print this page to PDF and copy the delivery address.
- supabase-schema.sql: database tables, Row Level Security, product image storage,
  validated public order-creation function, order-number generation and safe owner-only
  access policies.
- assets/: five example clock images and hero photo.
- favicon.svg: matching Aipan-inspired maroon / gold browser icon.
- config.js: store name and safe frontend settings; starts with backend placeholders.
- SETUP-GUIDE.txt: new GitHub repo + Supabase steps for beginners.
- .nojekyll: avoids GitHub Pages Jekyll processing issues.

IMPORTANT: ZIP SOURCE IS READY; LIVE BACKEND IS NOT AUTO-CONNECTED
-------------------------------------------------------------------
You must create your own GitHub repository and Supabase project, enter your Supabase
Project URL + publishable/anon key in config.js, run supabase-schema.sql, create the
owner login and add its UUID to public.admin_users. Until then the store preview shows
sample products, but real checkout and owner login remain disabled by design.

SHIPPING / PAYMENTS
-------------------
Pickup planning defaults are PIN 263641 (Garur, Bageshwar, Uttarakhand) and 1,000 g
(1 kg) in config.js. Orders can contain any 6-digit India PIN, but actual courier
serviceability must be checked per PIN. Owner enters the shipping fee and, after booking
through their chosen courier account, can save carrier name, AWB/tracking number and URL
in the admin order page. Shiprocket, Delhivery, India Post, courier pickup, live rates,
label generation and payment collection are NOT automatically integrated in this ZIP;
these need a courier/payment provider account and API credentials/integration.

WHATSAPP
--------
The WhatsApp buttons are for enquiries/custom questions only. The order checkout and
owner order-management flow uses the database/admin dashboard, not WhatsApp. Configure
WHATSAPP_NUMBER in config.js only if you want the enquiry buttons to work.

Built with WEBLYFT.
