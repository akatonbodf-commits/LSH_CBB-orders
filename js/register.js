/**
 * 店員用 POSレジ画面ロジック
 */
let rawDigits = "";
let activeOrder = null;
let isScanning = true;

window.addEventListener("DOMContentLoaded", () => {
  initCameraScanner();
});

// 1. リアルタイムカメラ解析ループ (canvas + jsQR)
function initCameraScanner() {
  const video = document.getElementById("video-preview");
  const canvas = document.getElementById("camera-canvas");
  const ctx = canvas.getContext("2d");

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => {
      video.srcObject = stream;
      video.setAttribute("playsinline", true);
      video.play();
      requestAnimationFrame(tick);
    })
    .catch(err => console.warn("カメラ起動不可 (手入力のみ使用可):", err));

  function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA && isScanning) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        const parts = code.data.split("_");
        if (parts.length === 2 && parts[0].startsWith("ORD")) {
          isScanning = false; // スキャン一次停止
          searchOrder(parts[0], parts[1]);
        }
      }
    }
    requestAnimationFrame(tick);
  }
}

// 2. 電卓風テンキー入力
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
  isScanning = false;
  searchOrder(`ORD${padded}`, "");
}

// 3. 照会・カード描画
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

// 4. ワンボタンステータス切替
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

async function handleMainAction() {
  document.getElementById("btn-main").disabled = true;

  try {
    if (activeOrder.status === "未払い") {
      await fetchApi("confirmPayment", { orderId: activeOrder.orderId, regId: CONFIG.REG_ID });
      activeOrder.status = "支払い済";
      renderOrderCard();
    } else if (activeOrder.status === "支払い済") {
      await fetchApi("confirmDelivery", { orderId: activeOrder.orderId, regId: CONFIG.REG_ID });
      alert("✨ 商品の引き渡しが正常に完了しました。");
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
  isScanning = true; // スキャン再開
}
