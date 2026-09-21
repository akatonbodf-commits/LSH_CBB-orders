/**
 * 店員用 POSレジ画面ロジック (人単位合算・ワンボタン遷移)
 */
let activeUserId = null;
let activeOrders = [];
let isScanning = true;

window.addEventListener("DOMContentLoaded", () => {
  initCameraScanner();
  fetchApi("getStaffInfo", {}).then(res => {
    document.getElementById("operator-badge").innerText = `レジ: ${CONFIG.REG_ID} (${res.email})`;
  }).catch(() => {});
});

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
    .catch(err => console.warn("カメラ起動不可:", err));

  function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA && isScanning) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

      if (code && code.data) {
        const parts = code.data.split("_");
        isScanning = false;
        triggerFlash();
        searchOrdersByUserId(parts[0], parts[1] || "");
      }
    }
    requestAnimationFrame(tick);
  }
}

function triggerFlash() {
  const fb = document.getElementById("scan-feedback");
  fb.classList.add("flash");
  setTimeout(() => fb.classList.remove("flash"), 300);
}

function submitManualSearch() {
  const val = document.getElementById("manual-id-input").value.trim();
  if (!val) return;
  isScanning = false;
  searchOrdersByUserId(val, "");
}

async function searchOrdersByUserId(userId, signature) {
  try {
    const res = await fetchApi("searchOrdersByUserId", { userId, signature, regId: CONFIG.REG_ID });
    activeUserId = res.userId;
    activeOrders = res.orders;
    renderOrderCard(res);
  } catch (err) {
    alert("照会エラー: " + err.message);
    resetUI();
  }
}

function renderOrderCard(data) {
  document.getElementById("placeholder").style.display = "none";
  document.getElementById("order-card").style.display = "block";

  document.getElementById("card-user-id").innerText = data.userId;
  document.getElementById("card-student-info").innerText = data.studentInfo || "外部客";
  document.getElementById("card-total").innerText = `¥${data.totalAmount.toLocaleString()}`;

  const itemsDiv = document.getElementById("card-items");
  itemsDiv.innerHTML = "";

  // 全注文の合算商品をグループ描画
  for (const item of data.aggregatedItems) {
    itemsDiv.innerHTML += `
      <div class="card-item-row">
        <span><b>${item.name}</b></span>
        <span><b>× ${item.qty}個</b></span>
      </div>
    `;
  }

  // ボタン制御 (未払いがあれば「会計確定」有効、支払い済のみなら「引換完了」有効)
  document.getElementById("btn-pay").disabled = !data.hasUnpaid;
  document.getElementById("btn-deliver").disabled = false; // 会計と同時引換も可能なため常時有効化
  document.getElementById("btn-cancel").disabled = false;
}

async function handlePayment() {
  setButtonsDisabled(true);
  try {
    await fetchApi("confirmPayment", { userId: activeUserId, regId: CONFIG.REG_ID });
    alert("🟢 会計処理が正常に完了しました。");
    // 再照会して最新状態に更新
    searchOrdersByUserId(activeUserId, "");
  } catch (err) {
    alert("会計エラー: " + err.message);
    setButtonsDisabled(false);
  }
}

async function handleDelivery() {
  setButtonsDisabled(true);
  try {
    await fetchApi("confirmDelivery", { userId: activeUserId, regId: CONFIG.REG_ID });
    alert("🔵 商品の引き渡しが完了しました。");
    resetUI();
  } catch (err) {
    alert("引換エラー: " + err.message);
    setButtonsDisabled(false);
  }
}

async function handleCancelLock() {
  if (activeUserId) {
    await fetchApi("cancelOrderLock", { userId: activeUserId, regId: CONFIG.REG_ID });
  }
  resetUI();
}

function setButtonsDisabled(disabled) {
  document.getElementById("btn-pay").disabled = disabled;
  document.getElementById("btn-deliver").disabled = disabled;
  document.getElementById("btn-cancel").disabled = disabled;
}

function resetUI() {
  activeUserId = null;
  activeOrders = [];
  document.getElementById("manual-id-input").value = "";
  document.getElementById("placeholder").style.display = "block";
  document.getElementById("order-card").style.display = "none";
  setButtonsDisabled(true);
  isScanning = true;
}
