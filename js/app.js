const ClientApp = {
  products: [],
  pastPurchases: {},
  cart: {},
  userEmail: "",

  init() {
    const savedEmail = localStorage.getItem("LASALLE_USER_EMAIL");
    if (savedEmail) {
      document.getElementById("input-user-email").value = savedEmail;
      this.setUserEmail();
    }
  },

  async setUserEmail() {
    const emailInput = document.getElementById("input-user-email").value.trim();
    if (!emailInput || !emailInput.includes("@")) {
      alert("有効なメールアドレスを入力してください。");
      return;
    }

    this.userEmail = emailInput;
    localStorage.setItem("LASALLE_USER_EMAIL", this.userEmail);
    document.getElementById("user-email-badge").innerText = this.userEmail;
    document.getElementById("email-setup-box").style.display = "none";
    document.getElementById("shop-section").style.display = "block";

    this.loadCatalog();
  },

  async loadCatalog() {
    showLoading("商品情報を取得中...");
    try {
      const ctx = await ApiClient.request("initContext", { email: this.userEmail });
      this.products = ctx.products || [];
      this.pastPurchases = ctx.pastPurchases || {};
      this.renderProducts();
    } catch (err) {
      alert("取得エラー: " + err.message);
    } finally {
      hideLoading();
    }
  },

  renderProducts() {
    const grid = document.getElementById("product-grid");
    grid.innerHTML = "";

    this.products.forEach(p => {
      const pastQty = this.pastPurchases[p.id] || 0;
      const currentCartQty = this.cart[p.id] || 0;
      const remainingLimit = Math.max(0, p.maxLimitPerUser - pastQty);
      const isSoldOut = p.stockLimit <= 0;

      const card = document.createElement("div");
      card.className = `trading-card ${isSoldOut ? "sold-out" : ""}`;

      card.innerHTML = `
        <div class="card-image-wrap">
          <img src="${p.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image'}" alt="${p.name}" class="card-img">
          ${isSoldOut ? '<div class="sold-out-badge">売り切れ</div>' : ''}
        </div>
        <div class="card-content">
          <h3 class="card-title">${p.name}</h3>
          <div class="card-price">¥${p.price.toLocaleString()}</div>
          <div class="limit-info">
            <span>上限: 個人${p.maxLimitPerUser}個まで</span>
            <span class="past-qty-tag">注文済: ${pastQty}個</span>
          </div>
          <div class="card-actions">
            <button class="btn-qty" onclick="ClientApp.updateQty('${p.id}', -1)" ${currentCartQty <= 0 ? 'disabled' : ''}>-</button>
            <span class="qty-display">${currentCartQty}</span>
            <button class="btn-qty" onclick="ClientApp.updateQty('${p.id}', 1)" ${currentCartQty >= remainingLimit || isSoldOut ? 'disabled' : ''}>+</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });

    this.updateBottomBar();
  },

  updateQty(productId, delta) {
    const prod = this.products.find(p => p.id === productId);
    if (!prod) return;

    const currentQty = this.cart[productId] || 0;
    const newQty = currentQty + delta;
    const pastQty = this.pastPurchases[productId] || 0;

    if (newQty < 0) return;
    if (newQty + pastQty > prod.maxLimitPerUser) {
      alert(`「${prod.name}」はお一人様最大${prod.maxLimitPerUser}個までです。`);
      return;
    }

    if (newQty === 0) {
      delete this.cart[productId];
    } else {
      this.cart[productId] = newQty;
    }

    this.renderProducts();
  },

  updateBottomBar() {
    let totalCount = 0;
    let totalPrice = 0;

    for (const pId in this.cart) {
      const qty = this.cart[pId];
      const prod = this.products.find(p => p.id === pId);
      if (prod) {
        totalCount += qty;
        totalPrice += prod.price * qty;
      }
    }

    const bar = document.getElementById("bottom-bar");
    if (totalCount > 0) {
      bar.style.display = "flex";
      document.getElementById("cart-total-count").innerText = `${totalCount}点`;
      document.getElementById("cart-total-price").innerText = `¥${totalPrice.toLocaleString()}`;
    } else {
      bar.style.display = "none";
    }
  },

  openConfirmModal() {
    const listEl = document.getElementById("modal-item-list");
    listEl.innerHTML = "";
    let totalPrice = 0;

    for (const pId in this.cart) {
      const qty = this.cart[pId];
      const prod = this.products.find(p => p.id === pId);
      if (prod) {
        const subtotal = prod.price * qty;
        totalPrice += subtotal;
        listEl.innerHTML += `
          <li class="modal-item-row">
            <span>${prod.name} × ${qty}</span>
            <strong>¥${subtotal.toLocaleString()}</strong>
          </li>
        `;
      }
    }

    document.getElementById("modal-total-amount").innerText = `¥${totalPrice.toLocaleString()}`;
    document.getElementById("chk-agree").checked = false;
    document.getElementById("btn-submit-order").disabled = true;
    document.getElementById("confirm-modal").style.display = "flex";
  },

  closeConfirmModal() {
    document.getElementById("confirm-modal").style.display = "none";
  },

  toggleSubmitButton() {
    const isChecked = document.getElementById("chk-agree").checked;
    document.getElementById("btn-submit-order").disabled = !isChecked;
  },

  async submitOrder() {
    this.closeConfirmModal();
    showLoading("注文を確定中...");

    try {
      const result = await ApiClient.request("submitOrder", {
        email: this.userEmail,
        cart: this.cart
      });

      const qrPayload = `${result.orderId}_${result.signature}`;
      document.getElementById("qrcode").innerHTML = "";
      new QRCode(document.getElementById("qrcode"), {
        text: qrPayload,
        width: 200,
        height: 200,
        colorDark: "#0F172A",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.H
      });

      document.getElementById("qr-order-id").innerText = `注文ID: ${result.orderId}`;
      document.getElementById("success-modal").style.display = "flex";

      this.cart = {};
      this.updateBottomBar();
    } catch (err) {
      alert("注文エラー: " + err.message);
    } finally {
      hideLoading();
    }
  }
};

function showLoading(txt) {
  document.getElementById("loading-text").innerText = txt;
  document.getElementById("loading-overlay").style.display = "flex";
}
function hideLoading() {
  document.getElementById("loading-overlay").style.display = "none";
}

window.addEventListener("DOMContentLoaded", () => ClientApp.init());
