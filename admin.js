(() => {
  "use strict";
  const cfg = window.STORE_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR_PROJECT_ID")
    && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.includes("REPLACE_WITH");
  const client = configured && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY) : null;
  const $ = id => document.getElementById(id);
  let user = null, products = [], orders = [], existingImage = "", previewUrl = "";
  let hasLoadedOrders = false, latestOrderId = null;

  function message(text, type = "ok", target = "notice") {
    const el = $(target); if (!el) return;
    el.textContent = text; el.className = "notice show " + type;
  }
  function clearMessage(target = "notice") {
    const el = $(target); if (el) { el.className = "notice"; el.textContent = ""; }
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function money(value) { return "₹" + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function showDashboard() {
    $("loginPanel").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    $("inventoryPanel").classList.remove("hidden");
    $("ordersPanel").classList.add("hidden");
    updateOrdersToggleLabel();
  }
  function showLogin() {
    $("loginPanel").classList.remove("hidden");
    $("dashboard").classList.add("hidden");
    $("inventoryPanel").classList.add("hidden");
    $("ordersPanel").classList.add("hidden");
  }
  function updateOrdersToggleLabel() {
    const panel = $("ordersPanel");
    if (!panel || !$("ordersToggle")) return;
    if (!panel.classList.contains("hidden")) $("ordersToggle").textContent = "Hide customer orders";
    else $("ordersToggle").textContent = orders.length ? `View customer orders (${orders.length})` : "View customer orders";
  }
  async function isAdmin() {
    if (!client || !user) return false;
    const { data, error } = await client.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    return !error && !!data;
  }

  async function loadInventory() {
    if (!client || !user) return;
    const { data, error } = await client.from("products").select("*").order("created_at", { ascending: false });
    if (error) { message("Could not load products: " + error.message, "error"); return; }
    products = data || []; renderInventory();
  }
  function renderInventory() {
    const root = $("inventory");
    if (!products.length) { root.innerHTML = '<p class="sub">No products yet. Use the form above to add your first clock.</p>'; return; }
    root.innerHTML = products.map(p => `<article class="item"><img src="${escapeHTML(p.image_url || "assets/clock-1.jpg")}" alt="${escapeHTML(p.name)}"><div class="body"><h3>${escapeHTML(p.name)}</h3><p><strong>${money(p.price)}</strong> · Stock: ${Number(p.stock) || 0}</p><p>${escapeHTML(p.category || "Traditional")} · <span class="pill">${p.is_active ? "Published" : "Draft"}</span></p><p>${escapeHTML(p.description || "No description")}</p><div class="actions"><button class="btn secondary" data-edit="${escapeHTML(p.id)}">Edit</button><button class="btn danger" data-delete="${escapeHTML(p.id)}">Delete</button></div></div></article>`).join("");
  }
  function resetForm() {
    $("productForm").reset(); $("productId").value = ""; $("stock").value = "10"; $("active").value = "true";
    $("saveBtn").textContent = "Publish product"; existingImage = ""; $("imageHelp").textContent = "Choose a photo to upload.";
    if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = "";
    $("preview").classList.add("hidden"); $("preview").removeAttribute("src"); clearMessage();
  }
  function editProduct(id) {
    const p = products.find(x => String(x.id) === String(id)); if (!p) return;
    $("productId").value = p.id; $("name").value = p.name; $("price").value = p.price; $("category").value = p.category || "Traditional";
    $("stock").value = p.stock ?? 0; $("description").value = p.description || ""; $("badge").value = p.badge || "";
    $("active").value = String(p.is_active); existingImage = p.image_url || "";
    $("imageHelp").textContent = existingImage ? "Current image retained unless you choose a new one." : "No image currently set.";
    $("saveBtn").textContent = "Save product changes";
    if (existingImage) { $("preview").src = existingImage; $("preview").classList.remove("hidden"); }
    else $("preview").classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function uploadImage(file, productId) {
    if (!file) return existingImage || null;
    if (file.size > 5 * 1024 * 1024) throw new Error("Image is over 5 MB. Please choose a smaller file.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use JPG, PNG or WebP image format.");
    const ext = ({ "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" })[file.type];
    const path = `${productId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await client.storage.from("product-images").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = client.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  }

  function formatDate(value) {
    try { return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
    catch (_) { return String(value || ""); }
  }
  function getItemQuantity(order) {
    return (Array.isArray(order.items) ? order.items : []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }
  function renderOrders() {
    const root = $("ordersList");
    const search = ($("orderSearch").value || "").trim().toLowerCase();
    const status = $("orderStatusFilter").value;
    const filtered = orders.filter(o => {
      const haystack = [o.order_number, o.customer_name, o.customer_phone, o.pincode, o.city, o.district, o.courier_name, o.tracking_number].join(" ").toLowerCase();
      return (!search || haystack.includes(search)) && (status === "all" || o.status === status);
    });
    const countNew = orders.filter(o => o.status === "new").length;
    const countActive = orders.filter(o => ["confirmed", "processing", "shipped"].includes(o.status)).length;
    const countAll = orders.length;
    $("orderStats").innerHTML = `<span><strong>${countAll}</strong> recent orders</span><span><strong>${countNew}</strong> new</span><span><strong>${countActive}</strong> in progress</span>`;
    if (!filtered.length) {
      root.innerHTML = `<div class="orders-empty">${orders.length ? "No orders match that search or status." : "No customer orders yet. When someone places an order, it will appear here with its product photos and delivery details."}</div>`;
      return;
    }
    root.innerHTML = filtered.map(o => {
      const first = Array.isArray(o.items) ? o.items[0] : null;
      const photo = first?.image_url || "assets/clock-1.jpg";
      const count = getItemQuantity(o);
      return `<article class="order-card"><img src="${escapeHTML(photo)}" alt="${escapeHTML(first?.name || "Order product photo")}" onerror="this.onerror=null;this.src='assets/clock-1.jpg'"><div><h3>${escapeHTML(o.order_number)}</h3><p><strong>${escapeHTML(o.customer_name)}</strong> · ${escapeHTML(o.customer_phone)}</p><p>${escapeHTML(o.city)}, ${escapeHTML(o.state)} · PIN <strong>${escapeHTML(o.pincode)}</strong></p><p>${count} item${count === 1 ? "" : "s"} · Subtotal ${money(o.subtotal)} · ${escapeHTML(formatDate(o.created_at))}</p>${o.courier_name || o.tracking_number ? `<p>Shipping: ${escapeHTML(o.courier_name || "Carrier not set")}${o.tracking_number ? " · AWB " + escapeHTML(o.tracking_number) : ""}</p>` : ""}<span class="order-status">${escapeHTML(o.status || "new")}</span></div><a class="btn primary order-view" href="order.html?id=${encodeURIComponent(o.id)}">Open full order ↗</a></article>`;
    }).join("");
  }
  async function loadOrders(silent = false) {
    if (!client || !user) return;
    if (!silent || !$("ordersPanel").classList.contains("hidden")) $("ordersList").innerHTML = '<div class="orders-empty">Loading customer orders…</div>';
    const { data, error } = await client.from("orders")
      .select("id,order_number,created_at,status,payment_status,customer_name,customer_phone,city,district,state,pincode,subtotal,items,courier_name,tracking_number")
      .order("created_at", { ascending: false }).limit(300);
    if (error) {
      $("ordersList").innerHTML = '<div class="orders-empty">Orders table is not ready yet. Open Supabase SQL Editor and run the updated supabase-schema.sql file, then refresh this page.</div>';
      if (!silent || !$("ordersPanel").classList.contains("hidden")) message("Could not load orders: " + error.message, "error");
      return;
    }
    const nextOrders = data || [];
    const nextLatestId = nextOrders[0]?.id || null;
    if (hasLoadedOrders && nextLatestId && latestOrderId && nextLatestId !== latestOrderId) {
      message(`New customer order received: ${nextOrders[0].order_number}`, "ok");
    }
    orders = nextOrders;
    latestOrderId = nextLatestId;
    hasLoadedOrders = true;
    renderOrders();
    updateOrdersToggleLabel();
  }
  async function init() {
    if ($("pickupPincode")) $("pickupPincode").textContent = cfg.PICKUP_PINCODE || "263641";
    if ($("parcelWeight")) $("parcelWeight").textContent = `${Math.round(Number(cfg.DEFAULT_PARCEL_WEIGHT_GRAMS || 1000) / 1000 * 10) / 10} kg`;
    if (!client) {
      message("Connect Supabase first: check SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in config.js, then run supabase-schema.sql.", "error", "loginError");
      $("loginBtn").disabled = true; return;
    }
    const { data } = await client.auth.getSession(); user = data.session?.user || null;
    if (user) {
      if (await isAdmin()) { showDashboard(); await Promise.all([loadInventory(), loadOrders(true)]); }
      else { await client.auth.signOut(); user = null; message("This account is not authorized as an owner. Add its UUID to admin_users in Supabase.", "error", "loginError"); }
    }
  }

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault(); if (!client) return; clearMessage("loginError");
    $("loginBtn").disabled = true; $("loginBtn").textContent = "Signing in…";
    const { data, error } = await client.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
    $("loginBtn").disabled = false; $("loginBtn").textContent = "Sign in securely";
    if (error) { message(error.message, "error", "loginError"); return; }
    user = data.user;
    if (!await isAdmin()) {
      await client.auth.signOut(); user = null;
      message("Login succeeded, but this user is not in admin_users. Add the user's UUID in Supabase SQL Editor.", "error", "loginError"); return;
    }
    showDashboard(); await Promise.all([loadInventory(), loadOrders(true)]);
  });
  $("logoutBtn").addEventListener("click", async () => { await client?.auth.signOut(); user = null; showLogin(); message("You have been signed out.", "ok", "loginError"); });
  $("image").addEventListener("change", () => {
    const file = $("image").files[0]; if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file); $("preview").src = previewUrl; $("preview").classList.remove("hidden");
  });
  $("productForm").addEventListener("submit", async e => {
    e.preventDefault(); if (!client || !user) return; clearMessage();
    const editing = Boolean($("productId").value); const id = $("productId").value || crypto.randomUUID(); const file = $("image").files[0];
    $("saveBtn").disabled = true; $("saveBtn").textContent = "Saving…";
    try {
      const image_url = await uploadImage(file, id);
      const row = { id, name: $("name").value.trim(), price: Number($("price").value), category: $("category").value,
        stock: Number($("stock").value), description: $("description").value.trim(), badge: $("badge").value || null,
        is_active: $("active").value === "true", image_url, updated_at: new Date().toISOString() };
      if (!row.name) throw new Error("Product name is required.");
      if (!Number.isFinite(row.price) || row.price < 0) throw new Error("Enter a valid price.");
      const { error } = await client.from("products").upsert(row, { onConflict: "id" });
      if (error) throw error;
      message(editing ? "Product updated successfully." : "Product published successfully.", "ok");
      resetForm(); await loadInventory();
    } catch (err) { message(err.message || "Could not save product.", "error"); }
    finally { $("saveBtn").disabled = false; $("saveBtn").textContent = $("productId").value ? "Save product changes" : "Publish product"; }
  });
  $("inventory").addEventListener("click", async e => {
    const edit = e.target.closest("[data-edit]"), del = e.target.closest("[data-delete]");
    if (edit) { editProduct(edit.dataset.edit); return; }
    if (del) {
      const p = products.find(x => String(x.id) === String(del.dataset.delete));
      if (!p || !confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
      const { error } = await client.from("products").delete().eq("id", p.id);
      if (error) message(error.message, "error"); else { message("Product deleted.", "ok"); await loadInventory(); }
    }
  });
  $("resetBtn").addEventListener("click", resetForm);
  $("refreshBtn").addEventListener("click", loadInventory);
  $("ordersToggle").addEventListener("click", async () => {
    const panel = $("ordersPanel");
    if (panel.classList.contains("hidden")) {
      panel.classList.remove("hidden"); updateOrdersToggleLabel();
      await loadOrders(); panel.scrollIntoView({ behavior: "smooth", block: "start" });
    } else { panel.classList.add("hidden"); updateOrdersToggleLabel(); }
  });
  $("hideOrdersBtn").addEventListener("click", () => { $("ordersPanel").classList.add("hidden"); updateOrdersToggleLabel(); });
  $("refreshOrdersBtn").addEventListener("click", loadOrders);
  $("orderSearch").addEventListener("input", renderOrders);
  $("orderStatusFilter").addEventListener("change", renderOrders);
  window.setInterval(() => { if (user) loadOrders(true); }, 30000);
  init();
})();
