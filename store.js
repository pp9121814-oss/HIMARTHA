(() => {
  "use strict";
  const cfg = window.STORE_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR_PROJECT_ID")
    && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.includes("REPLACE_WITH");
  const supabase = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY) : null;
  const WA = (cfg.WHATSAPP_NUMBER || "91XXXXXXXXXX").replace(/[^\d]/g, "");
  const productRoot = document.getElementById("products");
  const toast = document.getElementById("toast");
  const cartPanel = document.getElementById("cartPanel");
  const checkoutOverlay = document.getElementById("checkoutOverlay");
  const deliveryForm = document.getElementById("deliveryForm");
  let toastTimer, liveProducts = [], usingLiveData = false;
  let cart = {};
  try { cart = JSON.parse(localStorage.getItem("shailya-store-cart") || "{}"); } catch (_) { cart = {}; }
  let wishlist = new Set();
  try { wishlist = new Set(JSON.parse(localStorage.getItem("shailya-store-wishlist") || "[]")); } catch (_) { wishlist = new Set(); }

  const fallbackProducts = [
    {id:"demo-1",name:"Devbhoomi Elegance",category:"Classic",price:1299,description:"Aipan Art Wall Clock",image_url:"assets/clock-1.jpg",stock:10,is_active:true,badge:"Bestseller"},
    {id:"demo-2",name:"Floral Heritage",category:"Festive",price:1199,description:"Aipan Art Wall Clock",image_url:"assets/clock-2.jpg",stock:10,is_active:true,badge:"New"},
    {id:"demo-3",name:"Pahadi Peacock",category:"Classic",price:1399,description:"Aipan Art Wall Clock",image_url:"assets/clock-3.jpg",stock:10,is_active:true},
    {id:"demo-4",name:"Surya Mandala",category:"Minimal",price:1199,description:"Aipan Art Wall Clock",image_url:"assets/clock-4.jpg",stock:10,is_active:true,badge:"New"},
    {id:"demo-5",name:"Nature’s Harmony",category:"Traditional",price:1499,description:"Aipan Art Wall Clock",image_url:"assets/clock-5.jpg",stock:10,is_active:true}
  ];
  const money = n => "₹" + Number(n || 0).toLocaleString("en-IN");
  function notify(message) {
    if (!toast) return;
    toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function persistCart() { localStorage.setItem("shailya-store-cart", JSON.stringify(cart)); }
  function persistWishlist() { localStorage.setItem("shailya-store-wishlist", JSON.stringify([...wishlist])); }
  function countCart() { return Object.values(cart).reduce((sum, qty) => sum + Number(qty || 0), 0); }
  function productById(id) { return liveProducts.find(p => String(p.id) === String(id)); }
  function cartEntries() { return Object.entries(cart).filter(([id, qty]) => Number(qty) > 0 && productById(id)); }
  function cartSubtotal() { return cartEntries().reduce((sum, [id, qty]) => sum + Number(productById(id).price) * Number(qty), 0); }

  function renderProducts(filter = "All", query = "") {
    if (!productRoot) return;
    const q = query.trim().toLowerCase();
    const shown = liveProducts.filter(p => {
      const category = String(p.category || "Traditional");
      const filterOK = filter === "All" || category.toLowerCase() === filter.toLowerCase();
      const searchOK = !q || `${p.name} ${p.category} ${p.description || ""}`.toLowerCase().includes(q);
      return filterOK && searchOK && p.is_active !== false;
    });
    productRoot.innerHTML = shown.length ? shown.map(p => {
      const id = escapeHTML(p.id), name = escapeHTML(p.name), category = escapeHTML(p.category || "Traditional");
      const image = escapeHTML(p.image_url || "assets/clock-1.jpg");
      const desc = escapeHTML(p.description || "Handcrafted Aipan Art Clock");
      const badge = p.badge ? `<span class="tag ${p.badge.toLowerCase()==="new"?"new":""}">${escapeHTML(p.badge)}</span>` : "";
      return `<article class="product" data-id="${id}" data-name="${name}" data-category="${category}" data-price="${Number(p.price)||0}">
        <div class="product-image"><img src="${image}" alt="${name}" loading="lazy" onerror="this.src='assets/clock-1.jpg'">${badge}
        <button class="heart ${wishlist.has(String(p.id))?"active":""}" data-action="wishlist" aria-label="Toggle ${name} wishlist">${wishlist.has(String(p.id))?"♥":"♡"}</button></div>
        <div class="product-info"><h3>${name}</h3><p>${desc}</p><div class="product-bottom"><span class="price">${money(p.price)}</span><button class="add-cart" data-action="add" aria-label="Add ${name} to cart" ${Number(p.stock)===0?'disabled title="Out of stock"':""}>${Number(p.stock)===0?"Sold out":"🛒"}</button></div></div></article>`;
    }).join("") : `<p style="grid-column:1/-1;text-align:center;padding:32px 12px;color:#76533c">${q ? "No clocks found. Try another search." : "No products are listed right now. Please check back soon."}</p>`;
    updateCart();
  }
  function updateCart() {
    const count = document.getElementById("cartCount");
    if (count) count.textContent = countCart();
    const box = document.getElementById("cartItems"), totalEl = document.getElementById("cartTotal");
    if (!box || !totalEl) return;
    const entries = cartEntries();
    if (!entries.length) { box.innerHTML = "<p>Your cart is waiting for something beautiful.</p>"; totalEl.textContent = "₹0"; return; }
    let total = 0;
    box.innerHTML = entries.map(([id, qty]) => {
      const p = productById(id), amount = Number(p.price) * Number(qty); total += amount;
      return `<div class="cart-line"><span>${escapeHTML(p.name)}<br><small>${money(p.price)} each</small><br><button data-cart="minus" data-id="${escapeHTML(id)}" style="border:0;background:#ead3b6;border-radius:6px;padding:2px 8px;cursor:pointer">−</button> ${qty} <button data-cart="plus" data-id="${escapeHTML(id)}" style="border:0;background:#ead3b6;border-radius:6px;padding:2px 8px;cursor:pointer">+</button> <button data-cart="remove" data-id="${escapeHTML(id)}" style="border:0;background:transparent;color:#94120e;cursor:pointer">Remove</button></span><strong>${money(amount)}</strong></div>`;
    }).join("");
    totalEl.textContent = money(total);
  }
  function openCheckout() {
    if (!countCart()) { notify("Add a clock to your cart first"); return; }
    const idLabel = document.getElementById("checkoutOrderId");
    if (idLabel) idLabel.textContent = "Assigned when order is placed";
    const lat = document.getElementById("customerLatitude"), lon = document.getElementById("customerLongitude");
    if (lat) lat.value = ""; if (lon) lon.value = "";
    const status = document.getElementById("locationStatus");
    if (status) status.textContent = "No GPS location added yet. Your written address and PIN code will still be included.";
    const locationBtn = document.getElementById("getLocation");
    if (locationBtn) { locationBtn.disabled = false; locationBtn.textContent = "◎ Use my current location"; }
    if (checkoutOverlay) {
      checkoutOverlay.classList.add("open");
      checkoutOverlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      cartPanel?.classList.remove("open");
      setTimeout(() => document.getElementById("customerName")?.focus(), 80);
    }
  }
  function closeCheckout() {
    checkoutOverlay?.classList.remove("open");
    checkoutOverlay?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }
  function showOrderSuccess(orderNumber, itemCount) {
    const overlay = document.getElementById("orderSuccessOverlay");
    const orderLabel = document.getElementById("successOrderNumber");
    const summary = document.getElementById("successItemSummary");
    if (orderLabel) orderLabel.textContent = orderNumber;
    if (summary) summary.textContent = `Your ${itemCount} item${itemCount === 1 ? "" : "s"} ${itemCount === 1 ? "has" : "have"} been saved successfully.`;
    if (overlay) { overlay.classList.add("open"); overlay.setAttribute("aria-hidden", "false"); document.body.classList.add("modal-open"); }
  }
  function closeOrderSuccess() {
    const overlay = document.getElementById("orderSuccessOverlay");
    if (overlay) { overlay.classList.remove("open"); overlay.setAttribute("aria-hidden", "true"); }
    document.body.classList.remove("modal-open");
  }
  function formValue(id) { return (document.getElementById(id)?.value || "").trim(); }
  async function placeOrder() {
    if (!supabase) {
      notify("Online orders are not connected yet. Please try again later.");
      return;
    }
    if (!usingLiveData) {
      notify("Live products are unavailable. Please try again after the store connection is restored.");
      return;
    }
    const entries = cartEntries();
    if (!entries.length) {
      closeCheckout();
      notify("Your cart is empty. Add a clock before checkout.");
      return;
    }
    const customer = {
      name: formValue("customerName"),
      phone: formValue("customerPhone"),
      address: formValue("customerAddress"),
      area: formValue("customerArea"),
      postOffice: formValue("customerPostOffice"),
      landmark: formValue("customerLandmark"),
      city: formValue("customerCity"),
      district: formValue("customerDistrict"),
      state: formValue("customerState"),
      pincode: formValue("customerPincode"),
      notes: formValue("deliveryNotes"),
      latitude: formValue("customerLatitude") || null,
      longitude: formValue("customerLongitude") || null,
      consent: document.getElementById("shareConsent")?.checked === true
    };
    const items = entries.map(([id, quantity]) => ({ product_id: String(id), quantity: Number(quantity) }));
    const submitButton = deliveryForm.querySelector('button[type="submit"]');
    const originalText = submitButton ? submitButton.textContent : "Place order";
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = "Placing order…"; }
    try {
      const { data, error } = await supabase.rpc("create_public_order", {
        p_customer: customer,
        p_items: items
      });
      if (error) throw new Error(error.message || "The order could not be saved.");
      const created = Array.isArray(data) ? data[0] : data;
      if (!created || !created.order_id || !created.order_number) {
        throw new Error("The order was not confirmed by the server. Please contact the store before retrying.");
      }
      const orderedItemCount = entries.reduce((sum, [, quantity]) => sum + Number(quantity || 0), 0);
      cart = {};
      persistCart();
      updateCart();
      closeCheckout();
      deliveryForm.reset();
      const status = document.getElementById("locationStatus");
      if (status) status.textContent = "No GPS location added yet. Your written address and PIN code will still be included.";
      const locationBtn = document.getElementById("getLocation");
      if (locationBtn) { locationBtn.disabled = false; locationBtn.textContent = "◎ Use my current location"; }
      showOrderSuccess(created.order_number, orderedItemCount);
    } catch (err) {
      console.error("Order placement:", err);
      notify("Order wasn't placed: " + (err.message || "Please try again."));
    } finally {
      if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalText; }
    }
  }
  function whatsappIsConfigured() { return WA.length >= 10 && !WA.includes("XXXXXXXXXX") && /^\d+$/.test(WA); }
  function openWhatsApp(message) {
    if (!whatsappIsConfigured()) { notify("Please add the real WhatsApp number in config.js first."); return false; }
    const url = "https://wa.me/" + WA + "?text=" + encodeURIComponent(message);
    const win = window.open(url, "_blank");
    if (win) { try { win.opener = null; } catch (_) {} }
    else { window.location.href = url; }
    return true;
  }
  function showCurrentLocation() {
    const status = document.getElementById("locationStatus"), button = document.getElementById("getLocation");
    if (!navigator.geolocation) {
      if (status) status.textContent = "This browser does not support GPS location. Enter the full address and PIN code instead.";
      return;
    }
    if (status) status.textContent = "Requesting GPS permission…";
    if (button) { button.disabled = true; button.textContent = "Finding location…"; }
    navigator.geolocation.getCurrentPosition(position => {
      const latitude = Number(position.coords.latitude.toFixed(6));
      const longitude = Number(position.coords.longitude.toFixed(6));
      const lat = document.getElementById("customerLatitude"), lon = document.getElementById("customerLongitude");
      if (lat) lat.value = latitude; if (lon) lon.value = longitude;
      if (status) status.textContent = `Location added: ${latitude}, ${longitude}. A Google Maps link will be saved with your order for the owner.`;
      if (button) button.textContent = "✓ Location added";
      notify("GPS location added to your order");
    }, error => {
      const message = error.code === 1 ? "Location permission was denied. You can continue using your written address and PIN code." : error.code === 2 ? "Location could not be determined. Check device location and try again." : "Location request timed out. Try again or continue with your written address.";
      if (status) status.textContent = message;
      if (button) { button.disabled = false; button.textContent = "Try location again"; }
    }, {enableHighAccuracy:true, timeout:18000, maximumAge:0});
  }

  async function loadProducts() {
    if (!supabase) {
      liveProducts = fallbackProducts;
      renderProducts();
      notify("Preview mode: connect Supabase in config.js to load live products.");
      return;
    }
    const { data, error } = await supabase.from("products").select("id,name,description,category,price,image_url,stock,is_active,badge,created_at").eq("is_active", true).order("created_at", {ascending:false});
    if (error) {
      console.error("Supabase products:", error.message);
      liveProducts = fallbackProducts; renderProducts();
      notify("Could not load live products. Check Supabase setup.");
      return;
    }
    usingLiveData = true; liveProducts = data || []; renderProducts();
  }

  document.addEventListener("click", e => {
    const actionButton = e.target.closest("[data-action]");
    if (actionButton) {
      const card = actionButton.closest(".product"), id = card?.dataset.id;
      if (!id) return;
      if (actionButton.dataset.action === "add") {
        const p = productById(id); if (!p) return;
        if (Number(p.stock) <= 0) { notify("This clock is currently out of stock."); return; }
        cart[id] = Math.min(Number(cart[id] || 0) + 1, Number(p.stock) || 99);
        persistCart(); updateCart(); notify(p.name + " added to your cart");
      } else if (actionButton.dataset.action === "wishlist") {
        if (wishlist.has(id)) wishlist.delete(id); else wishlist.add(id);
        persistWishlist(); actionButton.classList.toggle("active", wishlist.has(id)); actionButton.textContent = wishlist.has(id) ? "♥" : "♡";
        notify(wishlist.has(id) ? "Saved to wishlist" : "Removed from wishlist");
      }
    }
    const cartButton = e.target.closest("[data-cart]");
    if (cartButton) {
      const id = cartButton.dataset.id, action = cartButton.dataset.cart, p = productById(id);
      if (action === "remove" || (action === "minus" && Number(cart[id]) <= 1)) delete cart[id];
      else if (action === "minus") cart[id] = Number(cart[id]) - 1;
      else if (action === "plus" && p) cart[id] = Math.min(Number(cart[id]) + 1, Number(p.stock) || 99);
      persistCart(); updateCart();
    }
  });
  document.getElementById("cartToggle")?.addEventListener("click", () => cartPanel?.classList.toggle("open"));
  document.getElementById("clearCart")?.addEventListener("click", () => { cart = {}; persistCart(); updateCart(); notify("Cart cleared"); });
  document.getElementById("checkout")?.addEventListener("click", openCheckout);
  document.getElementById("closeCheckout")?.addEventListener("click", closeCheckout);
  document.getElementById("cancelCheckout")?.addEventListener("click", closeCheckout);
  document.getElementById("getLocation")?.addEventListener("click", showCurrentLocation);
  document.getElementById("closeOrderSuccess")?.addEventListener("click", closeOrderSuccess);
  document.getElementById("orderSuccessOverlay")?.addEventListener("click", e => { if (e.target.id === "orderSuccessOverlay") closeOrderSuccess(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeOrderSuccess(); });
  checkoutOverlay?.addEventListener("click", e => { if (e.target === checkoutOverlay) closeCheckout(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && checkoutOverlay?.classList.contains("open")) closeCheckout(); });
  deliveryForm?.addEventListener("submit", async e => {
    e.preventDefault();
    if (!deliveryForm.reportValidity()) return;
    if (!countCart()) { closeCheckout(); notify("Your cart is empty. Add a clock before checkout."); return; }
    await placeOrder();
  });
  ["topWhatsApp","heroWhatsApp","footerWhatsApp"].forEach(id => document.getElementById(id)?.addEventListener("click", e => {
    e.preventDefault(); openWhatsApp(id === "heroWhatsApp" ? `Namaste! I am interested in ${cfg.BRAND_NAME || "SHAILYA"} handcrafted Aipan Art Clocks.` : `Namaste! I would like to know more about ${cfg.BRAND_NAME || "SHAILYA"} Aipan Art Clocks.`);
  }));
  document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(x => x.classList.toggle("active", x === btn));
    renderProducts(btn.dataset.filter || "All", document.getElementById("searchInput")?.value || "");
  }));
  document.getElementById("searchForm")?.addEventListener("submit", e => {
    e.preventDefault(); const q = document.getElementById("searchInput")?.value || "";
    document.querySelectorAll(".filter").forEach(x => x.classList.toggle("active", x.dataset.filter === "All"));
    renderProducts("All", q); document.getElementById("collection")?.scrollIntoView({behavior:"smooth"});
  });
  document.getElementById("scrollLeft")?.addEventListener("click", () => productRoot?.scrollBy({left:-320,behavior:"smooth"}));
  document.getElementById("scrollRight")?.addEventListener("click", () => productRoot?.scrollBy({left:320,behavior:"smooth"}));
  document.getElementById("menuToggle")?.addEventListener("click", () => document.getElementById("navlinks")?.classList.toggle("open"));
  document.querySelectorAll(".navlinks a").forEach(a => a.addEventListener("click", () => document.getElementById("navlinks")?.classList.remove("open")));
  document.getElementById("wishlistToggle")?.addEventListener("click", () => notify(wishlist.size ? "Wishlist: " + [...wishlist].map(id => productById(id)?.name).filter(Boolean).join(", ") : "Tap a heart on any clock to save it"));
  document.getElementById("year") && (document.getElementById("year").textContent = new Date().getFullYear());
  loadProducts();
})();
