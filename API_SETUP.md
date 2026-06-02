# 番茄日日 Toma API 設定

## OpenAI API Key 放置位置

請把 API Key 放在專案根目錄的 `.env`：

```env
OPENAI_API_KEY=你的OpenAI_API_Key
OPENAI_MODEL=gpt-4.1-mini
```

檔案位置：

```txt
C:\Users\krake\OneDrive\文件\自律茄子\.env
```

## 啟動方式

請用 Node 啟動番茄日日後端：

```powershell
node server.js
```

啟動後開這個網址：

```txt
http://localhost:8788/index.html
```

手機測試時，請改用電腦的區網 IP：

```txt
http://你的電腦IP:8788/index.html
```

## 注意事項

- 不要把 API Key 貼到 `index.html`、`app.js` 或任何前端檔案。
- `.env` 已加入 `.gitignore`，之後上 GitHub 不會送出 API Key。
- 前端會呼叫後端 `/api/analyze-meal`，後端再讀取 `.env` 裡的 `OPENAI_API_KEY`。
- AI 超過 10 秒沒完成時，App 會先顯示本機估算，避免使用者卡住。
