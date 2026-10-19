(() => {
  "use strict";
  const cfg = window.STORE_CONFIG || {};
  const ready = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR_PROJECT_ID")
    && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.includes("REPLACE_WITH");
  const client = ready && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY) : null;
  const $ = id => document.getElementById(id);
  const orderId = new URLSearchParams(window.location.search).get("id");
  let order = null, renderedAddress = "";
  const money = n => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function show(id) { $(id).classList.remove("hidden"); }
  function hide(id) { $(id).classList.add("hidden"); }
  function dateText(value) {
    try { return new Date(value).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" }); }
    catch (_) { return String(value || ""); }
  }
  function flash(text, kind = "ok") {
    const el = $("saveMessage"); el.textContent = text; el.className = "notice " + kind;
    show("saveMessage");
  }
  function renderOrder() {
    $("orderNumber").textContent = order.order_number || "SHAILYA Order";
    $("orderCreated").textContent = "Placed on " + dateText(order.created_at) + " · Customer order reference";
    $("orderStatusBadge").textContent = String(order.status || "new").replace(/_/g, " ");
    $("orderSubtotal").textContent = money(order.subtotal);
    $("orderShipping").textContent = order.shipping_charge == null ? "To be confirmed" : money(order.shipping_charge);
    $("orderGrandTotal").textContent = order.grand_total == null ? "Pending shipping" : money(order.grand_total);

    const items = Array.isArray(order.items) ? order.items : [];
    $("orderItems").innerHTML = items.length ? items.map(item => `
      <article class="item">
        <img src="${esc(item.image_url || "assets/clock-1.jpg")}" alt="${esc(item.name || "Aipan clock photo")}" onerror="this.onerror=null;this.src='assets/clock-1.jpg'">
        <div><h3>${esc(item.name || "Aipan Art Clock")}</h3><p>${esc(item.category || "Traditional")} · Quantity: <strong>${Number(item.quantity || 0)}</strong></p><p>Unit price ${money(item.unit_price)} × ${Number(item.quantity || 0)}</p></div>
        <div class="item-price">${money(item.line_total ?? (Number(item.unit_price || 0) * Number(item.quantity || 0)))}</div>
      </article>`).join("") : '<div class="notice">No item snapshots were saved with this order.</div>';

    const gps = order.latitude != null && order.longitude != null
      ? `<a class="map-link" href="https://www.google.com/maps?q=${encodeURIComponent(order.latitude)},${encodeURIComponent(order.longitude)}" target="_blank" rel="noopener noreferrer">Open exact customer GPS location ↗</a><br><small>${esc(order.latitude)}, ${esc(order.longitude)}</small>`
      : "Customer did not share GPS location. Use written address and PIN code.";
    const fullAddress = [order.address_line, order.area, order.post_office ? "Post Office: " + order.post_office : "", order.landmark ? "Landmark: " + order.landmark : "", order.city, order.district, order.state, "India — PIN " + order.pincode].filter(Boolean).join("\n");
    renderedAddress = `${order.customer_name}\n${order.customer_phone}\n${fullAddress}`;
    const fields = [
      ["Customer name", order.customer_name], ["Mobile number", order.customer_phone], ["PIN code", order.pincode],
      ["City / District", [order.city, order.district].filter(Boolean).join(", ")],
      ["State", order.state], ["Complete delivery address", fullAddress, true],
      ["Exact map location", gps, true],
      ["Delivery instructions", order.delivery_notes || "No extra instructions"],
      ["Courier / shipping company", order.courier_name || "Not set yet"],
      ["Tracking / AWB number", order.tracking_number || "Not set yet"],
      ["Tracking URL", order.tracking_url || "Not set yet", true],
      ["Checkout consent", order.customer_consent ? "Customer agreed to share details for order and delivery processing." : "Consent was not recorded on this order.", true]
    ];
    $("customerGrid").innerHTML = fields.map(([label, value, wide]) => {
      let body;
      if (label === "Exact map location") body = gps;
      else if (label === "Complete delivery address") body = esc(value).replace(/\n/g, "<br>");
      else if (label === "Tracking URL" && value) {
        try {
          const u = new URL(value);
          body = ["http:", "https:"].includes(u.protocol) ? `<a class="map-link" href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">Open courier tracking page ↗</a>` : esc(value);
        } catch (_) { body = esc(value); }
      } else body = esc(value || "Not provided");
      return `<div class="detail ${wide ? "span2" : ""}"><span class="label">${esc(label)}</span><p class="${label === "Complete delivery address" ? "address" : ""}">${body}</p></div>`;
    }).join("");

    $("statusSelect").value = order.status || "new";
    $("paymentSelect").value = order.payment_status || "pending";
    $("shippingInput").value = order.shipping_charge == null ? "" : order.shipping_charge;
    $("courierName").value = order.courier_name || "";
    $("trackingNumber").value = order.tracking_number || "";
    $("trackingUrl").value = order.tracking_url || "";
    $("adminNote").value = order.admin_note || "";
    updateTotalPreview();
  }
  function updateTotalPreview() {
    const val = $("shippingInput").value;
    if (val === "") { $("totalPreview").value = "Pending shipping charge"; return; }
    const fee = Number(val);
    $("totalPreview").value = Number.isFinite(fee) && fee >= 0 ? money(Number(order?.subtotal || 0) + fee) : "Enter a valid charge";
  }
  function showError(title, details) {
    hide("loading"); hide("orderContent"); hide("loginRequired");
    $("errorTitle").textContent = title; $("errorText").textContent = details; show("errorPanel");
  }
  async function verifyAdmin() {
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    if (!user) return false;
    const { data: admin, error } = await client.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (error || !admin) return false;
    return true;
  }
  async function loadOrder() {
    hide("errorPanel"); hide("loginRequired"); hide("orderContent"); show("loading");
    if (!client) { showError("Supabase isn't configured", "Check config.js and run supabase-schema.sql in your Supabase project first."); return; }
    if (!orderId) { showError("Order reference is missing", "Open an order using the View full order link from the owner dashboard."); return; }
    try {
      const allowed = await verifyAdmin();
      if (!allowed) { hide("loading"); show("loginRequired"); return; }
      const { data, error } = await client.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (error) throw error;
      if (!data) { showError("Order not found", "This order may have been removed, or its ID may be incorrect. Return to the Orders list to select a saved order."); return; }
      order = data; renderOrder(); hide("loading"); show("orderContent");
    } catch (error) {
      console.error("Load order:", error);
      showError("Could not load this order", error.message || "Check your connection and make sure the updated orders schema has been run in Supabase.");
    }
  }
  $("shippingInput").addEventListener("input", updateTotalPreview);
  $("copyAddressBtn").addEventListener("click", async () => {
    if (!renderedAddress) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(renderedAddress);
      else throw new Error("Clipboard API unavailable");
      flash("Customer delivery address copied.", "ok");
    } catch (_) {
      const helper = document.createElement("textarea"); helper.value = renderedAddress;
      helper.style.position = "fixed"; helper.style.opacity = "0"; document.body.appendChild(helper); helper.select();
      const ok = document.execCommand("copy"); helper.remove();
      flash(ok ? "Customer delivery address copied." : "Could not copy automatically. Select and copy the address from the details above.", ok ? "ok" : "");
    }
  });
  $("retryBtn").addEventListener("click", loadOrder);
  $("orderManagementForm").addEventListener("submit", async event => {
    event.preventDefault(); if (!client || !order) return;
    const feeText = $("shippingInput").value.trim();
    const fee = feeText === "" ? null : Number(feeText);
    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) { flash("Enter a valid non-negative shipping charge, or leave it blank until confirmed.", ""); return; }
    const trackingText = $("trackingUrl").value.trim();
    let trackingUrl = null;
    if (trackingText) {
      try {
        const parsed = new URL(trackingText);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Tracking URL must start with http:// or https://.");
        trackingUrl = parsed.href;
      } catch (e) { flash(e.message || "Enter a valid tracking URL.", ""); return; }
    }
    const save = $("saveOrderBtn"); save.disabled = true; save.textContent = "Saving…";
    try {
      const payload = {
        status: $("statusSelect").value,
        payment_status: $("paymentSelect").value,
        shipping_charge: fee,
        grand_total: fee === null ? null : Number((Number(order.subtotal) + fee).toFixed(2)),
        courier_name: $("courierName").value.trim() || null,
        tracking_number: $("trackingNumber").value.trim() || null,
        tracking_url: trackingUrl,
        admin_note: $("adminNote").value.trim() || null,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await client.from("orders").update(payload).eq("id", order.id).select("*").single();
      if (error) throw error;
      order = data; renderOrder(); flash("Order updates saved successfully.", "ok");
    } catch (error) {
      console.error("Update order:", error);
      flash("Could not save updates: " + (error.message || "Please try again."), "");
    } finally { save.disabled = false; save.textContent = "Save order updates"; }
  });
  loadOrder();
})();
