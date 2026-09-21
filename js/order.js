/**
 * 客用 注文画面ロジック
 */
const state = {
  userEmail: "user@example.com",
  products: [],
  pastPurchases: {},
  cart: {}
};

window.addEventListener("DOMContentLoaded", async () => {
  showLoading("初期データを安全に読み込み中...");
  try {
    const res = await fetchApi("initContext", { email: state.userEmail });
    state.products = res.products;
    state.pastPurchases = res.pastPurchases || {};
    
    document.getElementById("user-badge").innerText = state.userEmail;
    if (res.isStaff) {
      document.getElementById("admin-link").style.display = "inline-block";
    }
    
    renderProducts();
  } catch (err) {
    alert("初期読み込みエラー: " + err.message);
  } finally {
    hideLoading();
  }
});

function renderProducts() {
  const container = document.getElementById("product-list");
  container.innerHTML = "";

  state.products.forEach(prod => {
    const pastQty = state.pastPurchases[prod.id] || 0;
    const currentQty = state.cart[prod.id] || 0;
    const totalQty = pastQty + currentQty;

    const isSoldOut = prod.stock <= 0;
    const isFew = prod.stock > 0 && prod.stock <= (prod.fewThreshold || 5);
    const isMaxLimit = totalQty >= prod.maxLimit;

    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="img-wrapper">
        <img src="${prod.imageUrl || 'https://placehold.co/100'}" class="product-img ${isSoldOut ? 'sold-out' : ''}">
        ${isFew ? `<div class="badge-few">残りわずか</div>` : ''}
        ${isSoldOut ? `<div class="sold-out-overlay">SOLD OUT</div>` : ''}
      </div>
      <div class="product-info">
        <div>
          <div class="product-name">${prod.name}</div>
          <div class="product-price">¥${prod.price.toLocaleString()}</div>
          ${pastQty > 0 ? `<div class="product-limit">過去に${pastQty}個購入済み (上限${prod.maxLimit}個)</div>` : `<div class="product-limit">上限: ${prod.maxLimit}個</div>`}
        </div>
        <div class="qty-controller">
          <button class="qty-btn" onclick="updateQty('${prod.id}', -1)" ${currentQty === 0 ? 'disabled' : ''}>-</button>
          <div class="qty-val">${currentQty}</div>
          <button class="qty-btn" onclick="updateQty('${prod.id}', 1)" ${(isSoldOut || isMaxLimit) ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
  updateCartBar();
}

function updateQty(id, delta) {
  const current = state.cart[id] || 0;
  const next = current + delta;
  if (next <= 0) delete state.cart[id];
  else state.cart[id] = next;
  renderProducts();
}

function updateCartBar() {
  let total = 0, count = 0;
  for (const id in state.cart) {
    const p = state.products.find(item => item.id === id);
    if (p) { total += p.price * state.cart[id]; count += state.cart[id]; }
  }
  document.getElementById("cart-bar").style.display = count > 0 ? "flex" : "none";
  document.getElementById("cart-total").innerText = `¥${total.toLocaleString()}`;
}

// 2ステップカート確認 (編集不可・確認のみ)
function openCartReview() {
  const itemsDiv = document.getElementById("review-items");
  itemsDiv.innerHTML = "";
  let total = 0;

  for (const id in state.cart) {
    const p = state.products.find(item => item.id === id);
    if (!p) continue;
    const subtotal = p.price * state.cart[id];
    total += subtotal;

    itemsDiv.innerHTML += `
      <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom:1px solid #EEE;">
        <div><b>${p.name}</b> × ${state.cart[id]}</div>
        <div>¥${subtotal.toLocaleString()}</div>
      </div>
    `;
  }
  document.getElementById("modal-total").innerText = `¥${total.toLocaleString()}`;
  document.getElementById("review-modal").style.display = "flex";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

async function submitFinalOrder() {
  closeModal("review-modal");
  showLoading("在庫を安全に確保中...\n画面を閉じずにお待ちください。");

  try {
    const res = await fetchApi("submitOrder", { email: state.userEmail, cart: state.cart });
    
    document.getElementById("res-order-id").innerText = res.orderId;
    document.getElementById("res-total").innerText = `¥${res.totalAmount.toLocaleString()}`;
    
    const detailsDiv = document.getElementById("res-items-detail");
    detailsDiv.innerHTML = "";
    for (const id in state.cart) {
      const p = state.products.find(item => item.id === id);
      if (p) {
        detailsDiv.innerHTML += `<div>・${p.name} × ${state.cart[id]}個</div>`;
      }
    }

    document.getElementById("qrcode-area").innerHTML = "";
    new QRCode(document.getElementById("qrcode-area"), {
      text: `${state.userEmail}_${res.signature}`, // ユーザーID + HMAC署名
      width: 160, height: 160
    });

    // カート状態をリセット
    state.cart = {};
    renderProducts();

    document.getElementById("success-modal").style.display = "flex";
  } catch (err) {
    alert("注文エラー: " + err.message);
  } finally {
    hideLoading();
  }
}

function showLoading(text) {
  document.getElementById("loading-text").innerText = text;
  document.getElementById("loading-overlay").style.display = "flex";
}
function hideLoading() {
  document.getElementById("loading-overlay").style.display = "none";
}
