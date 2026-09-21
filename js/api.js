/**
 * GAS Web API 通信クライアント (GitHub Pages ➔ GAS)
 */
// ★ご自身でデプロイしたGASの「ウェブアプリURL」に差し替えてください
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz2uE9jQwYnpHEgEGHiQnvLmOioNnUnUlTcyw9ixVytQu0t27IOnqughK9AVU8IBeUC/exec";

const ApiClient = {
  regIdKey: "LASALLE_POS_REG_ID",

  // レジ端末IDの取得・生成
  getRegId() {
    let regId = localStorage.getItem(this.regIdKey);
    if (!regId) {
      regId = "POS-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem(this.regIdKey, regId);
    }
    return regId;
  },

  // GASへPOSTリクエストを送信
  async request(action, payload = {}) {
    payload.regId = this.getRegId();

    const requestBody = {
      action: action,
      payload: payload
    };

    try {
      const response = await fetch(GAS_WEB_APP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8" // GASのdoPostで確実に受け取るためtext/plain指定
        },
        body: JSON.stringify(requestBody),
        redirect: "follow"
      });

      if (!response.ok) {
        throw new Error(`通信エラー: HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error ? result.error.message : "処理中にエラーが発生しました。");
      }
    } catch (err) {
      console.error("API Request Error:", err);
      throw err;
    }
  }
};
