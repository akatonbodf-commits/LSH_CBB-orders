/**
 * 客用 注文画面ロジック
 */
const state = {
  email: "user@example.com",
  products: [],
  pastPurchases: {},
  cart: {}
};

window.addEventListener("DOMContentLoaded", async () => {
  showLoading("初期データを安全に読み込み中...");
  try {
    const res = await fetchApi("initContext", { email: state.email });
    state.products = res.products;
    state.pastPurchases = res.pastPurchases || {};
    document.getElementById("user-badge").innerText = state.email;
    renderProducts();
  } catch (err) {
    alert("初期読込エラー: " + err.message);
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
    const isFew = prod.stock > 0 && prod.stock <= 5;
    const isMaxLimit = totalQty >= prod.maxLimit;

    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="img-wrapper">
        <img src="${prod.imageUrl || 'https://placehold.co/100'}" class="product-img ${isSoldOut ? 'sold-out' : ''}">
        ${isFew ? `<div class="badge-few">残り${prod.stock}個</div>` : ''}
        ${isSoldOut ? `<div class="sold-out-overlay">SOLD OUT</div>` : ''}
      </div>
      <div class="product-info">
        <div>
          <div class="product-name">${prod.name}</div>
          <div class="product-price">¥${prod.price.toLocaleString()}</div>
          <div class="product-limit">個人上限: ${prod.maxLimit}個 ${pastQty > 0 ? `(購入済:${pastQty})` : ''}</div>
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
      <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom:1px solid #EEE;">
        <div><b>${p.name}</b> × ${state.cart[id]}</div>
        <div>¥${subtotal.toLocaleString()}</div>
      </div>
    `;
  }
  document.getElementById("modal-total").innerText = `¥${total.toLocaleString()}`;
  document.getElementById("review-modal").style.display = "flex";
}

async function submitOrder() {
  document.getElementById("review-modal").style.display = "none";
  showLoading("在庫を安全に確保中...\n画面を閉じずにお待ちください。");

  try {
    const res = await fetchApi("submitOrder", { email: state.email, cart: state.cart });
    document.getElementById("res-order-id").innerText = res.orderId;
    document.getElementById("res-total").innerText = `¥${res.totalAmount.toLocaleString()}`;
    
    document.getElementById("qrcode-area").innerHTML = "";
    new QRCode(document.getElementById("qrcode-area"), {
      text: `${res.orderId}_${res.signature}`,
      width: 160, height: 160
    });

    document.getElementById("success-modal").style.display = "flex";
  } catch (err) {
    alert("注文処理エラー: " + err.message);
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
