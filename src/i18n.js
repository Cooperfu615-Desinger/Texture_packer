export const translations = {
  zh: {
    // Header
    appSubtitle: 'Cocos Creator · 網頁工具',
    imagesLoaded: (n) => `已載入 ${n} 張圖片`,

    // Left Sidebar
    sprites: '精靈圖',
    clear: '清除',
    dropZoneMain: '拖曳 PNG 或資料夾到此',
    dropZoneClick: '或點擊瀏覽',
    noSprites: '尚無精靈圖。\n拖曳資料夾以開始。',

    // Preview
    preview: '預覽',
    readyTitle: '準備打包。',
    readyHint: '在右側設定選項，然後點擊「打包精靈圖」。',
    sheets: '張圖集',
    spritesCount: '個精靈',
    utilized: '利用率',
    sheet: '圖集',

    // Status messages
    noPngFound: '找不到 PNG 檔案。',
    loadedImages: (n) => `已載入 ${n} 張圖片。`,
    packSuccess: (sprites, sheets) => `已將 ${sprites} 個精靈圖打包至 ${sheets} 張圖集。`,
    addImagesFirst: '請先新增圖片。',
    packingFailed: '打包失敗 — 無法容納剩餘精靈圖。',
    downloaded: (name) => `已下載 ${name}`,

    // Settings
    settings: '設定',
    atlasName: '圖集名稱',
    maxSheetSize: '最大圖集尺寸',
    maxSheetSizeHint: '單張圖集的最大寬/高',
    padding: '間距',
    paddingHint: '精靈圖之間的空間（像素）',
    extrude: '邊緣擴展',
    extrudeHint: '重複邊緣像素以防止 UV 出血',
    trimLabel: '裁切透明像素',
    trimHint: '移除精靈圖周圍的空白區域',
    allowRotation: '允許旋轉',
    allowRotationHint: '旋轉 90° 以達到更緊密的打包',
    powerOfTwo: '2 的冪次',
    powerOfTwoHint: '強制圖集尺寸為 2^n（256、512、1024…）',

    // Buttons
    packSprites: '打包精靈圖',
    downloadZip: '下載 ZIP',

    // Language switcher
    language: '語言',
    langZh: '繁中',
    langEn: 'English',
  },

  en: {
    // Header
    appSubtitle: 'Cocos Creator · Web Tool',
    imagesLoaded: (n) => `${n} image${n > 1 ? 's' : ''} loaded`,

    // Left Sidebar
    sprites: 'Sprites',
    clear: 'Clear',
    dropZoneMain: 'Drop PNGs or folders here',
    dropZoneClick: 'or click to browse',
    noSprites: 'No sprites yet.\nDrag in a folder to begin.',

    // Preview
    preview: 'Preview',
    readyTitle: 'Ready to pack.',
    readyHint: 'Configure options on the right, then hit Pack.',
    sheets: 'sheets',
    spritesCount: 'sprites',
    utilized: 'utilized',
    sheet: 'Sheet',

    // Status messages
    noPngFound: 'No PNG files found.',
    loadedImages: (n) => `Loaded ${n} image${n > 1 ? 's' : ''}.`,
    packSuccess: (sprites, sheets) => `Packed ${sprites} sprite${sprites > 1 ? 's' : ''} into ${sheets} sheet${sheets > 1 ? 's' : ''}.`,
    addImagesFirst: 'Add some images first.',
    packingFailed: 'Packing failed - unable to fit any remaining sprites.',
    downloaded: (name) => `Downloaded ${name}`,

    // Settings
    settings: 'Settings',
    atlasName: 'Atlas Name',
    maxSheetSize: 'Max Sheet Size',
    maxSheetSizeHint: 'Maximum width/height of a single sheet',
    padding: 'Padding',
    paddingHint: 'Space between sprites (px)',
    extrude: 'Extrude',
    extrudeHint: 'Repeat edge pixels to prevent UV bleeding',
    trimLabel: 'Trim transparent pixels',
    trimHint: 'Remove empty space around sprites',
    allowRotation: 'Allow rotation',
    allowRotationHint: 'Rotate 90° for tighter packing',
    powerOfTwo: 'Power of 2',
    powerOfTwoHint: 'Force sheet size to 2^n (256, 512, 1024…)',

    // Buttons
    packSprites: 'Pack Sprites',
    downloadZip: 'Download ZIP',

    // Language switcher
    language: 'Language',
    langZh: '繁中',
    langEn: 'English',
  },
};
