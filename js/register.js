/**
 * 店員用 POSレジ画面ロジック
 */
let rawDigits = "";
let activeOrder = null;

// テンキーロジック: 1の位挿入 ＆ 0埋め補正 (例: 1234 -> ORD01234)
function pressKey(num) {
  if (rawDigits.length >= 5) return;
  rawDigits += num;
  updateTenKeyDisplay();
}

function clearKey() {
  rawDigits = "";
  updateTenKeyDisplay();
}

function updateTenKeyDisplay() {
  const padded = rawDigits.padStart(5, "0");
  document.getElementById("tenkey-val").innerText = padded;
}

function submitTenKey() {
  const padded = rawDigits.padStart(5, "0");
  searchOrder(`ORD${padded}`, "");
}

// 照会処理
async function searchOrder(orderId, signature) {
  try {
    const res = await fetchApi("searchOrder", { orderId, signature, regId: CONFIG.REG_ID });
    activeOrder = res.order;
    renderOrderCard();
  } catch (err) {
    alert("照会エラー: " + err.message);
    resetUI();
  }
}

function renderOrderCard() {
  document.getElementById("placeholder").style.display = "none";
  document.getElementById("order-card").style.display = "block";

  document.getElementById("card-email").innerText = activeOrder.email;
  document.getElementById("card-order-id").innerText = activeOrder.orderId;
  document.getElementById("card-status-badge").innerText = activeOrder.status;
  document.getElementById("card-total").innerText = `¥${activeOrder.totalAmount.toLocaleString()}`;

  const itemsDiv = document.getElementById("card-items");
  itemsDiv.innerHTML = "";
  for (const id in activeOrder.cart) {
    itemsDiv.innerHTML += `<div style="padding: 8px 0; border-bottom: 1px solid #F1F5F9;"><b>商品ID [${id}]</b> × ${activeOrder.cart[id]}個</div>`;
  }

  updateMainButton();
  document.getElementById("btn-cancel").disabled = false;
}

// ワンボタン・ステータス状態変化ロジック
function updateMainButton() {
  const mainBtn = document.getElementById("btn-main");
  const mainText = document.getElementById("btn-main-text");
  mainBtn.disabled = false;

  if (activeOrder.status === "未払い") {
    mainBtn.className = "btn-main btn-pay";
    mainText.innerText = "🟢 支払い確定";
  } else if (activeOrder.status === "支払い済") {
    mainBtn.className = "btn-main btn-deliver";
    mainText.innerText = "🔵 引換確定";
  } else {
    mainBtn.disabled = true;
  }
}

// 確定ボタン処理 (未払い ➔ 支払い済 ➔ 引換済)
async function handleMainAction() {
  document.getElementById("btn-main").disabled = true;

  try {
    if (activeOrder.status === "未払い") {
      await fetchApi("confirmPayment", { orderId: activeOrder.orderId, regId: CONFIG.REG_ID });
      activeOrder.status = "支払い済";
      renderOrderCard();
    } else if (activeOrder.status === "支払い済") {
      await fetchApi("confirmDelivery", { orderId: activeOrder.orderId, regId: CONFIG.REG_ID });
      alert("✨ 商品の引き渡しが完了しました。");
      resetUI();
    }
  } catch (err) {
    alert("処理エラー: " + err.message);
    document.getElementById("btn-main").disabled = false;
  }
}

async function cancelTransaction() {
  if (activeOrder) {
    await fetchApi("releaseLock", { orderId: activeOrder.orderId, regId: CONFIG.REG_ID });
  }
  resetUI();
}

function resetUI() {
  activeOrder = null;
  clearKey();
  document.getElementById("placeholder").style.display = "block";
  document.getElementById("order-card").style.display = "none";
  document.getElementById("btn-main").disabled = true;
  document.getElementById("btn-cancel").disabled = true;
}
