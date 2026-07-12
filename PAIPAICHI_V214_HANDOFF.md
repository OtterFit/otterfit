# 拍拍吃 v214 交接文件

更新日期：2026-07-13  
專案位置：`C:\Users\krake\OneDrive\文件\自律茄子`  
正式網址：https://paipachi.vercel.app

## 本次任務目標

品牌更名：

- 原品牌：`OtterFit / 獺獺`
- 新品牌：`拍拍吃`
- 新副標：`你的照片營養師`
- PWA 顯示名稱：`拍拍吃`
- PWA short name：`PaiPaiChi`
- 內部 key / cache prefix：`otterfit` 改為 `paipachi`
- AI 角色名稱 `塔塔` 保留不動

## 已完成項目

1. 頁面品牌文字

- HTML title 已改為：`拍拍吃 | 你的照片營養師`
- 頁面頂部大標已改為：`拍拍吃`
- 頁面頂部小字已改為：`你的照片營養師`
- 登入頁品牌已改為：`PaiPaiChi Private Beta / 登入 拍拍吃`

2. PWA 設定

- `manifest.webmanifest`
  - `name`: `拍拍吃`
  - `short_name`: `PaiPaiChi`
  - `description`: `你的照片營養師...`
- `sw.js`
  - cache name 已改為：`paipachi-pwa-v214`
- `index.html`
  - `styles.css?v=214`
  - `app.js?v=214`

3. App 內部版本與 prefix

- `app.js`
  - `APP_VERSION = "paipachi-app-v214"`
  - localStorage prefix 已由 `otterfit:*` 改為 `paipachi:*`
  - 可見品牌字樣已由 `OtterFit` 改為 `拍拍吃`

4. Vercel 部署

- 已建立 Vercel 專案：`paipachi`
- 已成功部署 production
- 已成功 alias 到固定網址：

```text
https://paipachi.vercel.app
```

## 主要修改檔案

- `index.html`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `vercel.json`
- `package.json`
- `README.md`

另有 smoke script 檔名從舊品牌改為：

- `scripts/paipachi-smoke-test.js`
- `scripts/paipachi-ui-smoke-test.js`

## Vercel 設定重點

`vercel.json` 已加入 builds 設定，原因是 Vercel 會誤把根目錄的 `app.js` 當成可打包的 Serverless JS，導致重複 function 宣告被 bundler 擋下。

目前設定為：

- `api/*.js` 使用 `@vercel/node`
- 其他所有檔案使用 `@vercel/static`

這樣比較符合目前專案架構：前端是靜態 PWA，API 放在 `api/`。

## 已驗證項目

本機驗證：

```powershell
node -c .\app.js
node .\scripts\p4-static-smoke-test.js
Invoke-WebRequest -UseBasicParsing http://localhost:8788/
```

結果：

- `app.js` 語法通過
- P4 static smoke test 通過
- localhost 回 200

正式站驗證：

檢查過以下網址皆回 200：

```text
https://paipachi.vercel.app/
https://paipachi.vercel.app/manifest.webmanifest
https://paipachi.vercel.app/sw.js
https://paipachi.vercel.app/app.js?v=214
```

確認：

- 首頁含 `拍拍吃`
- manifest 含 `拍拍吃 / PaiPaiChi`
- service worker 含 `paipachi-pwa-v214`
- app.js 含 `paipachi-app-v214`

## 品牌驗收狀態

已掃描主要輸出檔：

- `index.html`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `README.md`
- `package.json`

未發現：

- `OtterFit`
- `獺獺`
- `塔塔陪你慢慢變強`
- `otterfit`

注意：部分歷史備份檔、舊測試檔或文件可能仍含舊品牌，例如 `OTTERFIT_V41_TEST_NOTES.md`、`index-Lynn.html`、舊備份 sw。這些不是正式輸出路徑，若 reviewer 要做全 repo 嚴格掃描，需要另開清理任務。

## 已知注意事項

1. UI smoke 腳本狀態

舊的 UI smoke test 內含歷史 mojibake 亂碼字串，腳本本身會有語法錯，因此這次沒有把 UI smoke 當主要驗收依據。

目前可靠驗收以：

- `node -c app.js`
- `scripts/p4-static-smoke-test.js`
- 正式站 fetch 檢查
- 實機開站檢查

為主。

2. `app.js` 來源

本機 `app.js` 曾因 PowerShell 預設編碼讀寫造成中文 mojibake 破壞。最後處理方式是：

- 從已驗收過的 Vercel v213 正式站抓回乾淨 `app.js`
- 用 Node UTF-8 讀寫套品牌替換
- 產生 v214 `app.js`

後續請避免用 PowerShell `Set-Content` 直接重寫大型中文 JS 檔。若要批次改檔，建議用 Node 或明確 UTF-8 編碼。

3. Vercel CLI

部署使用：

```powershell
$env:PATH='C:\Users\krake\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
C:\Users\krake\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd dlx vercel@latest --prod --yes --name paipachi
```

部署成功後 CLI 顯示：

```text
Aliased https://paipachi.vercel.app
```

## 建議 reviewer 檢查清單

1. 手機打開：

```text
https://paipachi.vercel.app
```

2. 確認畫面第一屏：

- 大標是 `拍拍吃`
- 副標是 `你的照片營養師`
- 沒有看到 `OtterFit` 或 `獺獺`
- `塔塔` 只出現在 AI 角色語境

3. PWA 安裝：

- 加到手機主畫面後名稱應顯示 `拍拍吃`

4. 拍照流程：

- 飯前照或相簿放入後，應立即出現估算結果
- 飯後照只應作為校正加分，不應卡住主流程

5. Vercel 固定網址：

- 應使用 `https://paipachi.vercel.app`
- 不再使用 trycloudflare 臨時 tunnel

## 下一步建議

- 若要做全 repo 品牌潔癖掃描，可另外清理歷史備份檔與舊測試筆記。
- 若要恢復完整 UI smoke test，需要先重建/修復 mojibake 測試腳本。
- 若要做下一版功能，建議從 `paipachi` 正式站目前狀態開始，不要再回退到舊 `otterfit` 專案。
