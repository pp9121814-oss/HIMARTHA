(() => {
  const cfg = window.HIMARTHA_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR_PROJECT_ID")
    && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.includes("REPLACE_WITH");
  const supabase = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY) : null;
  const WA = (cfg.WHATSAPP_NUMBER || "91XXXXXXXXXX").replace(/[^\d]/g, "");
  const productRoot = document.getElementById("products");
  const toast = document.getElementById("toast");
  const cartPanel = document.getElementById("cartPanel");
  let toastTimer, liveProducts = [], usingLiveData = false;
  let cart = {};
  try { cart = JSON.parse(localStorage.getItem("himartha-cart") || "{}"); } catch (_) { cart = {}; }
  let wishlist = new Set(JSON.parse(localStorage.getItem("himartha-wishlist") || "[]"));

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
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function persistCart() { localStorage.setItem("himartha-cart", JSON.stringify(cart)); }
  function persistWishlist() { localStorage.setItem("himartha-wishlist", JSON.stringify([...wishlist])); }
  function countCart() { return Object.values(cart).reduce((sum, qty) => sum + Number(qty || 0), 0); }
  function productById(id) { return liveProducts.find(p => String(p.id) === String(id)); }
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
    const entries = Object.entries(cart).filter(([id, qty]) => Number(qty) > 0 && productById(id));
    if (!entries.length) { box.innerHTML = "<p>Your cart is waiting for something beautiful.</p>"; totalEl.textContent = "₹0"; return; }
    let total = 0;
    box.innerHTML = entries.map(([id, qty]) => {
      const p = productById(id), amount = Number(p.price) * Number(qty); total += amount;
      return `<div class="cart-line"><span>${escapeHTML(p.name)}<br><small>${money(p.price)} each</small><br><button data-cart="minus" data-id="${escapeHTML(id)}" style="border:0;background:#ead3b6;border-radius:6px;padding:2px 8px;cursor:pointer">−</button> ${qty} <button data-cart="plus" data-id="${escapeHTML(id)}" style="border:0;background:#ead3b6;border-radius:6px;padding:2px 8px;cursor:pointer">+</button> <button data-cart="remove" data-id="${escapeHTML(id)}" style="border:0;background:transparent;color:#94120e;cursor:pointer">Remove</button></span><strong>${money(amount)}</strong></div>`;
    }).join("");
    totalEl.textContent = money(total);
  }
  function orderMessage() {
    const lines = ["Namaste! I would like to order these HIMARTHA Aipan Art Clocks:"];
    let total = 0;
    Object.entries(cart).forEach(([id, qty]) => {
      const p = productById(id); if (!p || Number(qty) < 1) return;
      const amount = Number(p.price) * Number(qty); total += amount;
      lines.push(`${p.name} × ${qty} — ${money(amount)}`);
    });
    lines.push(`Total: ${money(total)}`, "Please confirm availability, shipping charges and delivery details.");
    return lines.join("\n");
  }
  function openWhatsApp(message) {
    if (!WA || WA.includes("XXXXXXXXXX") || WA.length < 10) { notify("Demo mode: add your WhatsApp number in config.js first."); return; }
    window.open("https://wa.me/" + WA + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
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
  document.getElementById("checkout")?.addEventListener("click", () => {
    if (!countCart()) { notify("Add a clock to your cart first"); return; }
    openWhatsApp(orderMessage());
  });
  ["topWhatsApp","heroWhatsApp","footerWhatsApp"].forEach(id => document.getElementById(id)?.addEventListener("click", e => {
    e.preventDefault(); openWhatsApp(id === "heroWhatsApp" ? "Namaste! I am interested in your handcrafted Aipan Art Clocks." : "Namaste! I would like to know more about HIMARTHA Aipan Art Clocks.");
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
