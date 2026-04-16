# Texture Packer · Cocos Creator

一個純前端的 Sprite Sheet 打包工具，專為 Cocos Creator 專案設計。
所有圖片處理都在瀏覽器內完成，不會上傳到任何伺服器。

![Status](https://img.shields.io/badge/status-MVP-orange)
![License](https://img.shields.io/badge/license-internal-blue)

---

## ✨ 功能

- **MaxRects bin-packing** 演算法，高效率的空間利用
- **Trim 透明像素**：自動裁切圖片周圍的透明區域
- **旋轉優化**：允許旋轉 90° 以獲得更緊密的打包
- **Multi-pack**：塞不下時自動拆分多張 sheet
- **可調參數**：最大尺寸、Padding、Extrude、Power of 2
- **Cocos Creator JSON 格式**（TexturePacker JSON Hash）
- **ZIP 下載**：PNG + JSON 一次打包

---

## 🚀 首次部署（給 repo 擁有者）

### 1. 本機準備

```bash
# 解壓縮本 ZIP 後，進入目錄
cd Texture_packer

# 安裝依賴
npm install

# 本機測試（開啟 http://localhost:5173/Texture_packer/）
npm run dev
```

### 2. 推送到 GitHub

在 GitHub 建立一個**名稱為 `Texture_packer` 的 repo**（大小寫必須一致，否則 base path 會錯）。

```bash
git init
git branch -M main
git add .
git commit -m "Initial commit: Texture Packer for Cocos Creator"
git remote add origin https://github.com/<你的帳號>/Texture_packer.git
git push -u origin main
```

### 3. 啟用 GitHub Pages

1. 到 GitHub repo 的 **Settings** → **Pages**
2. **Source** 選擇 **GitHub Actions**
3. 回到 **Actions** 頁面，等待第一次部署跑完（約 1-2 分鐘）
4. 部署成功後，網址是：
   ```
   https://<你的帳號>.github.io/Texture_packer/
   ```

以後任何修改只要 `git push` 就會自動重新部署。

### 4. 分享給團隊

把上面的網址貼到團隊聊天室、Notion、或內部 wiki。
建議也把本 README 的「團隊使用說明」段落複製給他們。

---

## 📖 團隊使用說明

### 基本流程

1. **上傳圖片**：把 PNG 檔或整個資料夾拖到左側的虛線區塊
2. **調整設定**（右側面板）：
   - **Atlas Name**：輸出檔案的名稱
   - **Max Sheet Size**：單張 sheet 的最大尺寸（預設 2048）
   - **Padding**：圖片之間的間距（預設 2px）
   - **Extrude**：邊緣像素向外延伸，避免 UV 接縫（預設 0）
3. **按 Pack Sprites**：查看即時預覽
4. **按 Download ZIP**：下載 PNG + JSON

### 在 Cocos Creator 中使用

1. 解壓縮下載的 ZIP
2. 把 `.png` 和 `.json` 放到 Cocos Creator 專案的 `assets/` 底下
3. Cocos Creator 會自動識別為 SpriteAtlas（使用 TexturePacker JSON Hash 格式）
4. 拖曳 atlas 中的 sprite 到場景即可

### 參數說明

| 參數 | 說明 | 建議值 |
|---|---|---|
| **Max Sheet Size** | 單張圖最大尺寸 | 2048（手遊）/ 4096（PC） |
| **Padding** | 圖片間距，避免採樣時互相干擾 | 2 |
| **Extrude** | 邊緣像素擴展，避免紋理接縫 | 1-2（有接縫問題時調高） |
| **Trim** | 裁掉透明邊緣，省空間 | 開啟 |
| **Allow rotation** | 允許旋轉 90° | 開啟（除非你的 shader 不支援） |
| **Power of 2** | 尺寸強制 2 的次方 | 關閉（Cocos 現代版本不需要） |

### 常見問題

**Q: 為什麼某些圖打不進去？**
A: 單張圖的尺寸（加上 padding）不能超過 Max Sheet Size。調大上限或檢查那張圖。

**Q: 打包後出現很多張 sheet？**
A: 表示一張裝不下，系統自動分頁。如果想減少張數，把 Max Sheet Size 調大。

**Q: JSON 丟進 Cocos 沒反應？**
A: 確認 PNG 和 JSON 在同一個資料夾，且檔名相同（只有副檔名不同）。

**Q: 遊戲中 sprite 邊緣出現奇怪的線？**
A: 開啟 Extrude 設為 1 或 2，可以消除 UV 採樣導致的邊緣問題。

---

## 🛠 開發

### 本機開發

```bash
npm install
npm run dev
```

### 建置

```bash
npm run build
# 輸出到 dist/
```

### 專案結構

```
Texture_packer/
├── src/
│   ├── App.jsx          # 主要應用（UI + 打包邏輯）
│   ├── main.jsx         # React 進入點
│   └── index.css        # Tailwind
├── public/
│   └── favicon.svg
├── .github/workflows/
│   └── deploy.yml       # GitHub Actions 自動部署
├── index.html
├── vite.config.js       # Vite 設定（含 base path）
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## 🎯 Roadmap（後續可能新增）

等團隊實際使用後再決定要做哪些：

- [ ] 支援 `.plist` XML 格式輸出
- [ ] Polygon trimming（非矩形裁切）
- [ ] PNG 壓縮優化（pngquant / zopfli）
- [ ] 相同圖片偵測與去重
- [ ] 動畫預覽（支援命名規則如 `character_run_01.png`）
- [ ] 批次處理多個資料夾
- [ ] 儲存 / 讀取設定檔

---

## 📝 Credits

- Bin packing: MaxRects with Best Short Side Fit heuristic
- 靈感來源：[TexturePacker](https://www.codeandweb.com/texturepacker)
- 輸出格式相容：TexturePacker JSON Hash（Cocos Creator 原生支援）
