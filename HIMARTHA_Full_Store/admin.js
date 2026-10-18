(() => {
  const cfg = window.HIMARTHA_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR_PROJECT_ID") && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.includes("REPLACE_WITH");
  const client = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY) : null;
  const $ = id => document.getElementById(id);
  let user = null, products = [], existingImage = "", previewUrl = "";
  function message(text, type="ok", target="notice") { const el=$(target); if(!el)return;el.textContent=text;el.className="notice show "+type; }
  function clearMessage(target="notice"){const el=$(target);if(el){el.className="notice";el.textContent="";}}
  function escapeHTML(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function money(n){return "₹"+Number(n||0).toLocaleString("en-IN");}
  function showDashboard(){ $("loginPanel").classList.add("hidden");$("dashboard").classList.remove("hidden");$("inventoryPanel").classList.remove("hidden"); }
  function showLogin(){ $("loginPanel").classList.remove("hidden");$("dashboard").classList.add("hidden");$("inventoryPanel").classList.add("hidden"); }
  async function isAdmin(){if(!client||!user)return false;const {data,error}=await client.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle();return !error&&!!data;}
  async function loadInventory(){
    if(!client||!user)return;
    const {data,error}=await client.from("products").select("*").order("created_at",{ascending:false});
    if(error){message("Could not load products: "+error.message,"error");return;}
    products=data||[];renderInventory();
  }
  function renderInventory(){
    const root=$("inventory");if(!products.length){root.innerHTML='<p class="sub">No products yet. Use the form above to add your first clock.</p>';return;}
    root.innerHTML=products.map(p=>`<article class="item"><img src="${escapeHTML(p.image_url||"assets/clock-1.jpg")}" alt="${escapeHTML(p.name)}"><div class="body"><h3>${escapeHTML(p.name)}</h3><p><strong>${money(p.price)}</strong> · Stock: ${Number(p.stock)||0}</p><p>${escapeHTML(p.category||"Traditional")} · <span class="pill">${p.is_active?"Published":"Draft"}</span></p><p>${escapeHTML(p.description||"No description")}</p><div class="actions"><button class="btn secondary" data-edit="${escapeHTML(p.id)}">Edit</button><button class="btn danger" data-delete="${escapeHTML(p.id)}">Delete</button></div></div></article>`).join("");
  }
  function resetForm(){ $("productForm").reset();$("productId").value="";$("stock").value="10";$("active").value="true";$("saveBtn").textContent="Publish product";existingImage="";$("imageHelp").textContent="Choose a photo to upload.";if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl="";$("preview").classList.add("hidden");$("preview").removeAttribute("src");clearMessage();}
  function editProduct(id){const p=products.find(x=>String(x.id)===String(id));if(!p)return;$("productId").value=p.id;$("name").value=p.name;$("price").value=p.price;$("category").value=p.category||"Traditional";$("stock").value=p.stock??0;$("description").value=p.description||"";$("badge").value=p.badge||"";$("active").value=String(p.is_active);existingImage=p.image_url||"";$("imageHelp").textContent=existingImage?"Current image retained unless you choose a new one.":"No image currently set.";$("saveBtn").textContent="Save product changes";if(existingImage){$("preview").src=existingImage;$("preview").classList.remove("hidden");}else $("preview").classList.add("hidden");window.scrollTo({top:0,behavior:"smooth"});}
  async function uploadImage(file, productId){
    if(!file)return existingImage||null;
    if(file.size>5*1024*1024)throw new Error("Image is over 5 MB. Please choose a smaller file.");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Use JPG, PNG or WebP image format.");
    const ext=({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp"})[file.type];
    const path=`${productId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const {error}=await client.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type});
    if(error)throw error;
    const {data}=client.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  }
  async function init(){
    if(!client){message("Connect Supabase first: edit SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in config.js, then run the SQL in supabase-schema.sql.","error","loginError");$("loginBtn").disabled=true;return;}
    const {data}=await client.auth.getSession();user=data.session?.user||null;
    if(user){if(await isAdmin()){showDashboard();await loadInventory();}else{await client.auth.signOut();user=null;message("This account is not authorized as an owner. Add its UUID to admin_users in Supabase.","error","loginError");}}
  }
  $("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!client)return;clearMessage("loginError");$("loginBtn").disabled=true;$("loginBtn").textContent="Signing in…";const {data,error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});$("loginBtn").disabled=false;$("loginBtn").textContent="Sign in securely";if(error){message(error.message,"error","loginError");return;}user=data.user;if(!await isAdmin()){await client.auth.signOut();user=null;message("Login succeeded, but this user is not in admin_users. Add the user's UUID in Supabase SQL Editor.","error","loginError");return;}showDashboard();await loadInventory();});
  $("logoutBtn").addEventListener("click",async()=>{await client?.auth.signOut();user=null;showLogin();message("You have been signed out.","ok","loginError");});
  $("image").addEventListener("change",()=>{const file=$("image").files[0];if(!file)return;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(file);$("preview").src=previewUrl;$("preview").classList.remove("hidden");});
  $("productForm").addEventListener("submit",async e=>{
    e.preventDefault();if(!client||!user)return;clearMessage();const id=$("productId").value||crypto.randomUUID();const file=$("image").files[0];$("saveBtn").disabled=true;$("saveBtn").textContent="Saving…";
    try{
      const image_url=await uploadImage(file,id);
      const row={id,name:$("name").value.trim(),price:Number($("price").value),category:$("category").value,stock:Number($("stock").value),description:$("description").value.trim(),badge:$("badge").value||null,is_active:$("active").value==="true",image_url,updated_at:new Date().toISOString()};
      if(!row.name)throw new Error("Product name is required.");
      if(!Number.isFinite(row.price)||row.price<0)throw new Error("Enter a valid price.");
      const {error}=await client.from("products").upsert(row,{onConflict:"id"});
      if(error)throw error;
      message($("productId").value?"Product updated successfully.":"Product published successfully.","ok");
      resetForm();await loadInventory();
    }catch(err){message(err.message||"Could not save product.","error");}
    finally{$("saveBtn").disabled=false;$("saveBtn").textContent=$("productId").value?"Save product changes":"Publish product";}
  });
  $("inventory").addEventListener("click",async e=>{
    const edit=e.target.closest("[data-edit]"), del=e.target.closest("[data-delete]");
    if(edit){editProduct(edit.dataset.edit);return;}
    if(del){const p=products.find(x=>String(x.id)===String(del.dataset.delete));if(!p||!confirm(`Delete "${p.name}"? This cannot be undone.`))return;const {error}=await client.from("products").delete().eq("id",p.id);if(error)message(error.message,"error");else{message("Product deleted.","ok");await loadInventory();}}
  });
  $("resetBtn").addEventListener("click",resetForm);$("refreshBtn").addEventListener("click",loadInventory);
  init();
})();
