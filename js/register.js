/**
 * 店員用 POSレジ画面コントローラー (完全修正版)
 */

const STATES = {
  WAITING: "WAITING",
  LOCKED_UNPAID: "LOCKED_UNPAID",
  LOCKED_PAID: "LOCKED_PAID"
};

const RegisterApp = {
  state: STATES.WAITING,
  activeUserId: null,
  activeOrderData: null,
  isScanning: true,

  init() {
    this.initCamera();
    this.fetchOperatorInfo();
  },

  async fetchOperatorInfo() {
    try {
      const res = await ApiClient.request("initContext");
      document.getElementById("operator-badge").innerText = `レジ: ${ApiClient.getRegId()} (${res.userEmail})`;
    } catch (e) {
      document.getElementById("operator-badge").innerText = `レジ: ${ApiClient.getRegId()}`;
    }
  },

  initCamera() {
    const video = document.getElementById("preview-video");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("カメラ非対応環境です。");
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(stream => {
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();
        requestAnimationFrame(() => this.tickCamera());
      })
      .catch(err => console.warn("カメラ起動失敗:", err));
  },

  tickCamera() {
    const video = document.getElementById("preview-video");
    if (video.readyState === video.HAVE_ENOUGH_DATA && this.isScanning) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

      if (code && code.data) {
        this.isScanning = false;
        this.flashCamera();
        this.processScannedCode(code.data);
      }
    }
    requestAnimationFrame(() => this.tickCamera());
  },

  flashCamera() {
    const fb = document.getElementById("scan-feedback");
    fb.classList.add("scan-flash");
    setTimeout(() => fb.classList.remove("scan-flash"), 300);
  },

  processScannedCode(rawData) {
    const parts = rawData.split("_");
    const userId = parts[0];
    const signature = parts[1] || "";
    this.searchUserOrders(userId, signature);
  },

  async searchUserOrders(userId, signature) {
    this.hideCollisionAlert();
    showLoading("注文データを照会 ＆ ロック中...");

    try {
      const data = await ApiClient.request("searchOrdersByUserId", { userId, signature });
      this.activeUserId = data.userId;
      this.activeOrderData = data;

      if (data.hasUnpaid) {
        this.transitionTo(STATES.LOCKED_UNPAID);
      } else {
        this.transitionTo(STATES.LOCKED_PAID);
      }
    } catch (err) {
      // 🔒 【修正点】他レジ衝突（排他ロックエラー）の判定とバナー表示
      if (err.message && err.message.includes("処理中")) {
        this.showCollisionAlert(err.message);
      } else {
        alert("照会エラー: " + err.message);
      }
      this.resetToWaiting();
    } finally {
      hideLoading();
    }
  },

  showCollisionAlert(msg) {
    const alertBox = document.getElementById("collision-alert");
    const alertText = document.getElementById("collision-text");
    alertText.innerText = msg;
    alertBox.style.display = "flex";
  },

  hideCollisionAlert() {
    document.getElementById("collision-alert").style.display = "none";
  },

  transitionTo(newState) {
    this.state = newState;
    const card = document.getElementById("order-card");
    const placeholder = document.getElementById("placeholder-view");
    const mainBtn = document.getElementById("btn-main-action");
    const cancelBtn = document.getElementById("btn-cancel-action");
    const label = document.getElementById("main-action-label");
    const sub = document.getElementById("main-action-sub");

    if (newState === STATES.WAITING) {
      card.style.display = "none";
      placeholder.style.display = "flex";
      mainBtn.disabled = true;
      cancelBtn.disabled = true;
      this.isScanning = true;
      return;
    }

    placeholder.style.display = "none";
    card.style.display = "flex";
    cancelBtn.disabled = false;
    mainBtn.disabled = false;

    document.getElementById("card-user-id").innerText = this.activeOrderData.userId;
    document.getElementById("card-student-info").innerText = this.activeOrderData.studentInfo;
    document.getElementById("card-total-amount").innerText = `¥${this.activeOrderData.totalAmount.toLocaleString()}`;

    const tbody = document.getElementById("card-items-tbody");
    tbody.innerHTML = "";
    this.activeOrderData.aggregatedItems.forEach(item => {
      tbody.innerHTML += `
        <tr>
          <td>📦 ${item.name}</td>
          <td style="text-align: right; font-weight: bold; font-size: 18px;">${item.qty} 個</td>
        </tr>
      `;
    });

    if (newState === STATES.LOCKED_UNPAID) {
      document.getElementById("card-status-badge").innerText = "未払いあり";
      document.getElementById("card-status-badge").className = "badge-status badge-unpaid";
      mainBtn.className = "btn-giant btn-giant-confirm";
      label.innerText = "🟢 会計確定";
      sub.innerText = "現金の回収を必ず確認後にタップ";
    } else if (newState === STATES.LOCKED_PAID) {
      document.getElementById("card-status-badge").innerText = "支払い済 (引換待機)";
      document.getElementById("card-status-badge").className = "badge-status badge-paid";
      mainBtn.className = "btn-giant btn-giant-deliver";
      label.innerText = "🔵 引き渡し完了";
      sub.innerText = "商品を客へ渡したらタップ";
    }
  },

  async handleMainAction() {
    setButtonsDisabled(true);
    try {
      if (this.state === STATES.LOCKED_UNPAID) {
        showLoading("会計処理を実行中...");
        await ApiClient.request("confirmPayment", { userId: this.activeUserId });
        this.activeOrderData.hasUnpaid = false;
        this.transitionTo(STATES.LOCKED_PAID);
      } else if (this.state === STATES.LOCKED_PAID) {
        showLoading("引換完了処理を実行中...");
        await ApiClient.request("confirmDelivery", { userId: this.activeUserId });
        alert("✨ 商品の引き渡しが完了しました。");
        this.resetToWaiting();
      }
    } catch (err) {
      alert("処理エラー: " + err.message);
      setButtonsDisabled(false);
    } finally {
      hideLoading();
    }
  },

  async handleCancel() {
    if (this.activeUserId) {
      showLoading("ロック解除中...");
      try {
        await ApiClient.request("cancelOrderLock", { userId: this.activeUserId });
      } catch (e) {}
      hideLoading();
    }
    this.resetToWaiting();
  },

  resetToWaiting() {
    this.activeUserId = null;
    this.activeOrderData = null;
    Numpad.clear();
    this.transitionTo(STATES.WAITING);
  }
};

const Numpad = {
  buffer: "",
  press(key) {
    if (this.buffer.length < 20) {
      this.buffer += key;
      this.updateDisplay();
    }
  },
  backspace() {
    this.buffer = this.buffer.slice(0, -1);
    this.updateDisplay();
  },
  clear() {
    this.buffer = "";
    this.updateDisplay();
  },
  updateDisplay() {
    document.getElementById("manual-input").value = this.buffer;
  },
  submit() {
    if (!this.buffer.trim()) return;
    RegisterApp.isScanning = false;
    RegisterApp.searchUserOrders(this.buffer.trim(), "");
  }
};

function setButtonsDisabled(disabled) {
  document.getElementById("btn-main-action").disabled = disabled;
  document.getElementById("btn-cancel-action").disabled = disabled;
}

function showLoading(txt) {
  document.getElementById("loading-text").innerText = txt;
  document.getElementById("loading-overlay").style.display = "flex";
}
function hideLoading() {
  document.getElementById("loading-overlay").style.display = "none";
}

window.addEventListener("DOMContentLoaded", () => RegisterApp.init());
