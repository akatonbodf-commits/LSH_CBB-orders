/**
 * GAS API Fetch 通信モジュール
 */
async function fetchApi(action, payload = {}) {
  try {
    const response = await fetch(CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action, ...payload })
    });
    
    if (!response.ok) throw new Error("ネットワーク接続エラーが発生しました。");
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message || "APIエラーが発生しました。");
    
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}
