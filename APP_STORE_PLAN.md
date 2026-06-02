# 番茄日日 Toma App Store 上架計畫

## 目前狀態

- 已完成可用的 PWA 版：AI 熱量估算、飲食紀錄、體重紀錄、減重目標、7/30 日趨勢。
- 資料目前存在使用者裝置瀏覽器 localStorage。
- AI 測熱量目前是本機規則估算，尚未串接真正圖片辨識 API。

## 要正式上架 App Store，還需要

1. Apple Developer Program 帳號。
2. App 名稱：番茄日日 Toma。
3. Bundle ID，例如 `com.lynn.selfdisciplineeggplant`。
4. App icon PNG：1024 x 1024。
5. App Store 截圖：iPhone 6.7 吋、6.5 吋、5.5 吋，必要時加 iPad。
6. 隱私權政策公開網址。
7. 服務條款公開網址。
8. App 隱私問卷。
9. 年齡分級：健康與健身，含健康/保健主題。
10. 若要收費：App 內購買方案與訂閱說明。

## 建議上架路線

### 第一階段：今天可用

- 用本機網址或部署到 Vercel/Netlify。
- 手機用 Safari 開啟後加入主畫面，先當 App 使用。

### 第二階段：TestFlight

- 用 Capacitor 把目前 PWA 包成 iOS App。
- 加入 App icon、splash screen、隱私頁。
- 用你的 Apple Developer 帳號上傳 TestFlight。

### 第三階段：正式 App Store

- 串接真正 AI 圖片辨識 API。
- 補上付費牆：免費每日 3 次估算，Pro 無限 AI 測熱量。
- 上架審核。

## 建議付費方案

- Free：手動紀錄、每日 3 次 AI 估算、7 日趨勢。
- Pro 月費：NT$90 到 NT$150。
- Pro 年費：NT$790 到 NT$990。
- Lifetime：NT$1,490 到 NT$1,990。

## 審核風險

- 不可宣稱治療、醫療診斷或保證減重。
- 熱量與營養素必須標示為估算值。
- 隱私權政策需說明健康資料、照片、體重資料如何使用。
- 若上傳照片給 AI API，需要明確揭露資料傳輸目的。
