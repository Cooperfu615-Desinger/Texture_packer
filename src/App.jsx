import React, { useState, useRef, useCallback, useEffect, useMemo, createContext, useContext } from 'react';
import { Upload, Trash2, Download, Package, Settings, Image as ImageIcon, Layers, Loader2, AlertCircle, CheckCircle2, Info, Globe } from 'lucide-react';
import { translations } from './i18n.js';

// ============================================================================
// Language Context
// ============================================================================

const LangContext = createContext(null);

function useLang() {
  return useContext(LangContext);
}

// ============================================================================
// MaxRects Bin Packing Algorithm
// Based on Jukka Jylänki's MaxRects algorithm. Maintains a list of free
// rectangles and uses Best Short Side Fit heuristic for placement.
// ============================================================================

class MaxRectsPacker {
  constructor(width, height, allowRotation = true) {
    this.width = width;
    this.height = height;
    this.allowRotation = allowRotation;
    this.freeRects = [{ x: 0, y: 0, width, height }];
    this.usedRects = [];
  }

  insert(width, height) {
    let bestNode = null;
    let bestShortSideFit = Infinity;
    let bestLongSideFit = Infinity;

    for (const rect of this.freeRects) {
      // Try normal orientation
      if (rect.width >= width && rect.height >= height) {
        const leftoverHoriz = Math.abs(rect.width - width);
        const leftoverVert = Math.abs(rect.height - height);
        const shortSideFit = Math.min(leftoverHoriz, leftoverVert);
        const longSideFit = Math.max(leftoverHoriz, leftoverVert);

        if (shortSideFit < bestShortSideFit || (shortSideFit === bestShortSideFit && longSideFit < bestLongSideFit)) {
          bestNode = { x: rect.x, y: rect.y, width, height, rotated: false };
          bestShortSideFit = shortSideFit;
          bestLongSideFit = longSideFit;
        }
      }

      // Try rotated orientation
      if (this.allowRotation && rect.width >= height && rect.height >= width) {
        const leftoverHoriz = Math.abs(rect.width - height);
        const leftoverVert = Math.abs(rect.height - width);
        const shortSideFit = Math.min(leftoverHoriz, leftoverVert);
        const longSideFit = Math.max(leftoverHoriz, leftoverVert);

        if (shortSideFit < bestShortSideFit || (shortSideFit === bestShortSideFit && longSideFit < bestLongSideFit)) {
          bestNode = { x: rect.x, y: rect.y, width: height, height: width, rotated: true };
          bestShortSideFit = shortSideFit;
          bestLongSideFit = longSideFit;
        }
      }
    }

    if (!bestNode) return null;

    // Split free rects that intersect with the placed node
    const newFreeRects = [];
    for (const rect of this.freeRects) {
      if (this.intersects(rect, bestNode)) {
        this.splitFreeRect(rect, bestNode, newFreeRects);
      } else {
        newFreeRects.push(rect);
      }
    }
    this.freeRects = newFreeRects;
    this.pruneFreeRects();
    this.usedRects.push(bestNode);

    return bestNode;
  }

  intersects(a, b) {
    return !(a.x >= b.x + b.width || a.x + a.width <= b.x || a.y >= b.y + b.height || a.y + a.height <= b.y);
  }

  splitFreeRect(freeRect, usedNode, result) {
    // Left piece
    if (usedNode.x > freeRect.x && usedNode.x < freeRect.x + freeRect.width) {
      result.push({ x: freeRect.x, y: freeRect.y, width: usedNode.x - freeRect.x, height: freeRect.height });
    }
    // Right piece
    if (usedNode.x + usedNode.width < freeRect.x + freeRect.width) {
      result.push({
        x: usedNode.x + usedNode.width,
        y: freeRect.y,
        width: freeRect.x + freeRect.width - (usedNode.x + usedNode.width),
        height: freeRect.height,
      });
    }
    // Top piece
    if (usedNode.y > freeRect.y && usedNode.y < freeRect.y + freeRect.height) {
      result.push({ x: freeRect.x, y: freeRect.y, width: freeRect.width, height: usedNode.y - freeRect.y });
    }
    // Bottom piece
    if (usedNode.y + usedNode.height < freeRect.y + freeRect.height) {
      result.push({
        x: freeRect.x,
        y: usedNode.y + usedNode.height,
        width: freeRect.width,
        height: freeRect.y + freeRect.height - (usedNode.y + usedNode.height),
      });
    }
  }

  pruneFreeRects() {
    for (let i = 0; i < this.freeRects.length; i++) {
      for (let j = i + 1; j < this.freeRects.length; j++) {
        if (this.isContainedIn(this.freeRects[i], this.freeRects[j])) {
          this.freeRects.splice(i, 1);
          i--;
          break;
        }
        if (this.isContainedIn(this.freeRects[j], this.freeRects[i])) {
          this.freeRects.splice(j, 1);
          j--;
        }
      }
    }
  }

  isContainedIn(a, b) {
    return a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
  }
}

// ============================================================================
// Image Processing Utilities
// ============================================================================

// Load an image file and extract its pixel data
async function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      URL.revokeObjectURL(url);
      resolve({
        name: file.name,
        width: img.width,
        height: img.height,
        imageData,
        canvas,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load ${file.name}`));
    };
    img.src = url;
  });
}

// Find the bounding box of non-transparent pixels
function computeTrim(imageData) {
  const { width, height, data } = imageData;
  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Fully transparent image - keep 1x1 pixel
  if (maxX < 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

// Round up to next power of 2
function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// ============================================================================
// Packing Pipeline
// ============================================================================

async function packSprites(images, options) {
  const { maxSize, padding, extrude, trim, allowRotation, powerOfTwo } = options;

  // Prepare sprite data with trim info
  const sprites = images.map((img) => {
    const trimBox = trim ? computeTrim(img.imageData) : { x: 0, y: 0, width: img.width, height: img.height };
    return {
      name: img.name,
      originalWidth: img.width,
      originalHeight: img.height,
      trimBox,
      packedWidth: trimBox.width + padding * 2 + extrude * 2,
      packedHeight: trimBox.height + padding * 2 + extrude * 2,
      canvas: img.canvas,
      placed: false,
      sheet: -1,
      x: 0,
      y: 0,
      rotated: false,
    };
  });

  // Sort by max side descending - better packing heuristic
  const sorted = [...sprites].sort((a, b) => Math.max(b.packedWidth, b.packedHeight) - Math.max(a.packedWidth, a.packedHeight));

  // Validate: no single sprite exceeds max size
  for (const s of sorted) {
    if (s.packedWidth > maxSize || s.packedHeight > maxSize) {
      throw new Error(`Sprite "${s.name}" (${s.trimBox.width}×${s.trimBox.height}) exceeds max size ${maxSize}. Increase max size or remove.`);
    }
  }

  // Multi-pack loop
  const sheets = [];
  let remaining = sorted.filter((s) => !s.placed);
  let sheetIndex = 0;

  while (remaining.length > 0) {
    const packer = new MaxRectsPacker(maxSize, maxSize, allowRotation);
    const placed = [];
    const stillRemaining = [];

    for (const sprite of remaining) {
      const node = packer.insert(sprite.packedWidth, sprite.packedHeight);
      if (node) {
        sprite.placed = true;
        sprite.sheet = sheetIndex;
        sprite.x = node.x + padding + extrude;
        sprite.y = node.y + padding + extrude;
        sprite.rotated = node.rotated;
        placed.push(sprite);
      } else {
        stillRemaining.push(sprite);
      }
    }

    if (placed.length === 0) {
      throw new Error('Packing failed - unable to fit any remaining sprites.');
    }

    // Compute actual sheet size (shrink to content)
    let contentW = 0, contentH = 0;
    for (const s of placed) {
      const w = s.rotated ? s.packedHeight : s.packedWidth;
      const h = s.rotated ? s.packedWidth : s.packedHeight;
      const right = s.x - padding - extrude + w;
      const bottom = s.y - padding - extrude + h;
      if (right > contentW) contentW = right;
      if (bottom > contentH) contentH = bottom;
    }

    let sheetW = contentW;
    let sheetH = contentH;
    if (powerOfTwo) {
      sheetW = nextPowerOf2(sheetW);
      sheetH = nextPowerOf2(sheetH);
    }

    sheets.push({
      index: sheetIndex,
      width: sheetW,
      height: sheetH,
      sprites: placed,
    });

    sheetIndex++;
    remaining = stillRemaining;
  }

  return sheets;
}

// ============================================================================
// Render Sheet to Canvas
// ============================================================================

function renderSheet(sheet, extrude) {
  const canvas = document.createElement('canvas');
  canvas.width = sheet.width;
  canvas.height = sheet.height;
  const ctx = canvas.getContext('2d');

  for (const sprite of sheet.sprites) {
    const { canvas: src, trimBox, x, y, rotated } = sprite;

    // Create a trimmed source canvas
    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimBox.width;
    trimmedCanvas.height = trimBox.height;
    const trimmedCtx = trimmedCanvas.getContext('2d');
    trimmedCtx.drawImage(src, trimBox.x, trimBox.y, trimBox.width, trimBox.height, 0, 0, trimBox.width, trimBox.height);

    if (rotated) {
      ctx.save();
      // When rotated 90° clockwise, the sprite occupies (packedHeight × packedWidth) at the sheet
      // We want the sprite drawn rotated at position (x, y)
      ctx.translate(x + trimBox.height, y);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(trimmedCanvas, 0, 0);
      // Extrude edges if enabled
      if (extrude > 0) {
        drawExtrude(ctx, trimmedCanvas, 0, 0, extrude);
      }
      ctx.restore();
    } else {
      ctx.drawImage(trimmedCanvas, x, y);
      if (extrude > 0) {
        drawExtrude(ctx, trimmedCanvas, x, y, extrude);
      }
    }
  }

  return canvas;
}

// Extrude edges by repeating border pixels - prevents UV bleeding
function drawExtrude(ctx, src, dx, dy, extrude) {
  const w = src.width;
  const h = src.height;
  for (let i = 1; i <= extrude; i++) {
    // Top
    ctx.drawImage(src, 0, 0, w, 1, dx, dy - i, w, 1);
    // Bottom
    ctx.drawImage(src, 0, h - 1, w, 1, dx, dy + h + i - 1, w, 1);
    // Left
    ctx.drawImage(src, 0, 0, 1, h, dx - i, dy, 1, h);
    // Right
    ctx.drawImage(src, w - 1, 0, 1, h, dx + w + i - 1, dy, 1, h);
  }
}

// ============================================================================
// Cocos Creator Format Exporter (TexturePacker JSON Hash)
// ============================================================================

function exportCocosJSON(sheet, filename) {
  const frames = {};
  for (const sprite of sheet.sprites) {
    const w = sprite.rotated ? sprite.trimBox.height : sprite.trimBox.width;
    const h = sprite.rotated ? sprite.trimBox.width : sprite.trimBox.height;

    frames[sprite.name] = {
      frame: { x: sprite.x, y: sprite.y, w, h },
      rotated: sprite.rotated,
      trimmed: sprite.trimBox.width !== sprite.originalWidth || sprite.trimBox.height !== sprite.originalHeight,
      spriteSourceSize: {
        x: sprite.trimBox.x,
        y: sprite.trimBox.y,
        w: sprite.trimBox.width,
        h: sprite.trimBox.height,
      },
      sourceSize: { w: sprite.originalWidth, h: sprite.originalHeight },
      pivot: { x: 0.5, y: 0.5 },
    };
  }

  return {
    frames,
    meta: {
      app: 'TexturePacker Web (Cocos Creator)',
      version: '1.0',
      image: filename,
      format: 'RGBA8888',
      size: { w: sheet.width, h: sheet.height },
      scale: '1',
    },
  };
}

// ============================================================================
// JSZip-like minimal ZIP writer (no compression, store-only)
// Avoids external dependency. Uses CRC32 for integrity.
// ============================================================================

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32LE(arr, offset, value) {
  arr[offset] = value & 0xff;
  arr[offset + 1] = (value >>> 8) & 0xff;
  arr[offset + 2] = (value >>> 16) & 0xff;
  arr[offset + 3] = (value >>> 24) & 0xff;
}

function writeUint16LE(arr, offset, value) {
  arr[offset] = value & 0xff;
  arr[offset + 1] = (value >>> 8) & 0xff;
}

function createZip(files) {
  // files: [{ name: string, data: Uint8Array }]
  const encoder = new TextEncoder();
  const localHeaders = [];
  const centralEntries = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    // Local file header (30 bytes + name)
    const local = new Uint8Array(30 + nameBytes.length + size);
    writeUint32LE(local, 0, 0x04034b50); // signature
    writeUint16LE(local, 4, 20); // version
    writeUint16LE(local, 6, 0); // flags
    writeUint16LE(local, 8, 0); // compression (store)
    writeUint16LE(local, 10, 0); // mod time
    writeUint16LE(local, 12, 0); // mod date
    writeUint32LE(local, 14, crc);
    writeUint32LE(local, 18, size); // compressed size
    writeUint32LE(local, 22, size); // uncompressed size
    writeUint16LE(local, 26, nameBytes.length);
    writeUint16LE(local, 28, 0); // extra
    local.set(nameBytes, 30);
    local.set(file.data, 30 + nameBytes.length);

    localHeaders.push({ buf: local, offset });

    // Central directory entry (46 bytes + name)
    const central = new Uint8Array(46 + nameBytes.length);
    writeUint32LE(central, 0, 0x02014b50);
    writeUint16LE(central, 4, 20); // version made by
    writeUint16LE(central, 6, 20); // version needed
    writeUint16LE(central, 8, 0);
    writeUint16LE(central, 10, 0);
    writeUint16LE(central, 12, 0);
    writeUint16LE(central, 14, 0);
    writeUint32LE(central, 16, crc);
    writeUint32LE(central, 20, size);
    writeUint32LE(central, 24, size);
    writeUint16LE(central, 28, nameBytes.length);
    writeUint16LE(central, 30, 0);
    writeUint16LE(central, 32, 0);
    writeUint16LE(central, 34, 0);
    writeUint16LE(central, 36, 0);
    writeUint32LE(central, 38, 0);
    writeUint32LE(central, 42, offset);
    central.set(nameBytes, 46);

    centralEntries.push(central);
    offset += local.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of centralEntries) centralSize += c.length;

  // End of central directory (22 bytes)
  const eocd = new Uint8Array(22);
  writeUint32LE(eocd, 0, 0x06054b50);
  writeUint16LE(eocd, 4, 0);
  writeUint16LE(eocd, 6, 0);
  writeUint16LE(eocd, 8, centralEntries.length);
  writeUint16LE(eocd, 10, centralEntries.length);
  writeUint32LE(eocd, 12, centralSize);
  writeUint32LE(eocd, 16, centralStart);
  writeUint16LE(eocd, 20, 0);

  // Combine everything
  const totalSize = offset + centralSize + eocd.length;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const lh of localHeaders) {
    result.set(lh.buf, pos);
    pos += lh.buf.length;
  }
  for (const c of centralEntries) {
    result.set(c, pos);
    pos += c.length;
  }
  result.set(eocd, pos);
  return result;
}

async function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// ============================================================================
// React App
// ============================================================================

const DEFAULT_OPTIONS = {
  maxSize: 2048,
  padding: 2,
  extrude: 0,
  trim: true,
  allowRotation: true,
  powerOfTwo: false,
  atlasName: 'atlas',
};

export default function App() {
  const [lang, setLang] = useState('zh');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const t = translations[lang];

  const [images, setImages] = useState([]);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const langMenuRef = useRef(null);

  // Close language menu when clicking outside
  useEffect(() => {
    if (!langMenuOpen) return;
    const handler = (e) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [langMenuOpen]);

  // Handle file uploads - supports both direct files and directory drops
  const handleFiles = useCallback(async (fileList) => {
    setLoading(true);
    setStatus({ type: 'idle', message: '' });
    try {
      const files = Array.from(fileList).filter((f) => f.type === 'image/png' || f.name.toLowerCase().endsWith('.png'));
      if (files.length === 0) {
        setStatus({ type: 'error', message: t.noPngFound });
        setLoading(false);
        return;
      }
      const loaded = await Promise.all(files.map(loadImage));
      setImages((prev) => {
        // Dedupe by name
        const existing = new Set(prev.map((i) => i.name));
        const newOnes = loaded.filter((i) => !existing.has(i.name));
        return [...prev, ...newOnes];
      });
      setStatus({ type: 'success', message: t.loadedImages(loaded.length) });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
    setLoading(false);
  }, [t]);

  // Drag-and-drop support including directories
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    const items = e.dataTransfer.items;
    if (items && items[0] && items[0].webkitGetAsEntry) {
      const files = [];
      const promises = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) promises.push(traverseEntry(entry, files));
      }
      await Promise.all(promises);
      handleFiles(files);
    } else {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const removeImage = (name) => {
    setImages((prev) => prev.filter((i) => i.name !== name));
    setSheets([]);
  };

  const clearAll = () => {
    setImages([]);
    setSheets([]);
    setStatus({ type: 'idle', message: '' });
  };

  // Main pack action
  const pack = useCallback(async () => {
    if (images.length === 0) {
      setStatus({ type: 'error', message: t.addImagesFirst });
      return;
    }
    setLoading(true);
    setStatus({ type: 'idle', message: '' });
    try {
      // Yield to UI before heavy work
      await new Promise((r) => setTimeout(r, 10));
      const result = await packSprites(images, options);
      setSheets(result);
      setActiveSheet(0);
      const totalSprites = result.reduce((sum, s) => sum + s.sprites.length, 0);
      setStatus({
        type: 'success',
        message: t.packSuccess(totalSprites, result.length),
      });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
      setSheets([]);
    }
    setLoading(false);
  }, [images, options, t]);

  // Render active sheet to the preview canvas
  useEffect(() => {
    if (sheets.length === 0 || !previewCanvasRef.current) return;
    const sheet = sheets[activeSheet];
    if (!sheet) return;
    const rendered = renderSheet(sheet, options.extrude);
    const canvas = previewCanvasRef.current;
    canvas.width = rendered.width;
    canvas.height = rendered.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(rendered, 0, 0);
  }, [sheets, activeSheet, options.extrude]);

  // Download packed result as ZIP
  const downloadZip = async () => {
    if (sheets.length === 0) return;
    setLoading(true);
    try {
      const files = [];
      const baseName = options.atlasName || 'atlas';
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        const suffix = sheets.length > 1 ? `-${i}` : '';
        const pngName = `${baseName}${suffix}.png`;
        const jsonName = `${baseName}${suffix}.json`;

        const rendered = renderSheet(sheet, options.extrude);
        const blob = await canvasToBlob(rendered);
        const buf = new Uint8Array(await blob.arrayBuffer());
        files.push({ name: pngName, data: buf });

        const json = exportCocosJSON(sheet, pngName);
        const jsonStr = JSON.stringify(json, null, 2);
        files.push({ name: jsonName, data: new TextEncoder().encode(jsonStr) });
      }
      const zipBytes = createZip(files);
      const blob = new Blob([zipBytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: t.downloaded(`${baseName}.zip`) });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
    setLoading(false);
  };

  // Compute statistics
  const stats = useMemo(() => {
    if (sheets.length === 0) return null;
    let totalArea = 0;
    let usedArea = 0;
    let totalSprites = 0;
    for (const sheet of sheets) {
      totalArea += sheet.width * sheet.height;
      for (const s of sheet.sprites) {
        usedArea += s.trimBox.width * s.trimBox.height;
        totalSprites++;
      }
    }
    return {
      sheets: sheets.length,
      sprites: totalSprites,
      utilization: ((usedArea / totalArea) * 100).toFixed(1),
    };
  }, [sheets]);

  return (
    <LangContext.Provider value={t}>
    <div className="min-h-screen bg-[#0e1015] text-[#d4d8e0] font-mono">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Fraunces:wght@400;500;600;700;800&display=swap');
        body { font-family: 'JetBrains Mono', monospace; }
        .display-font { font-family: 'Fraunces', serif; font-feature-settings: "ss01"; }
        .checkerboard {
          background-image:
            linear-gradient(45deg, #1a1d24 25%, transparent 25%),
            linear-gradient(-45deg, #1a1d24 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #1a1d24 75%),
            linear-gradient(-45deg, transparent 75%, #1a1d24 75%);
          background-size: 16px 16px;
          background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
          background-color: #14161c;
        }
        .custom-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: #0e1015; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #2a2f3a; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #3a4050; }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>

      {/* Header */}
      <header className="border-b border-[#1f232d] bg-[#12151c] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-[#ff8c42] to-[#d64545] rounded flex items-center justify-center">
            <Package size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="display-font text-xl font-semibold text-white tracking-tight">Texture Packer</h1>
            <p className="text-[10px] text-[#6b7280] uppercase tracking-widest">{t.appSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-[#6b7280]">
            {images.length > 0 && <span>{t.imagesLoaded(images.length)}</span>}
          </div>
          {/* Language Switcher */}
          <div className="relative" ref={langMenuRef}>
            <button
              onClick={() => setLangMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[#6b7280] hover:text-[#d4d8e0] transition px-2 py-1 rounded hover:bg-[#1a1d24]"
              title={t.language}
            >
              <Globe size={14} />
              <span className="text-xs">{lang === 'zh' ? t.langZh : t.langEn}</span>
            </button>
            {langMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#1a1d24] border border-[#2a2f3a] rounded shadow-lg z-50 min-w-[100px] overflow-hidden">
                {[
                  { key: 'zh', label: translations.zh.langZh },
                  { key: 'en', label: translations.en.langEn },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setLang(key); setLangMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs transition ${
                      lang === key
                        ? 'text-[#ff8c42] bg-[#ff8c42]/10'
                        : 'text-[#9ca3af] hover:bg-[#22262f] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Images */}
        <aside className="w-72 border-r border-[#1f232d] bg-[#12151c] flex flex-col">
          <div className="px-4 py-3 border-b border-[#1f232d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon size={14} className="text-[#6b7280]" />
              <span className="text-xs uppercase tracking-wider text-[#9ca3af] font-semibold">{t.sprites}</span>
            </div>
            {images.length > 0 && (
              <button onClick={clearAll} className="text-[10px] text-[#6b7280] hover:text-[#d64545] uppercase tracking-wider transition">
                {t.clear}
              </button>
            )}
          </div>

          {/* Drop Zone */}
          <div
            className={`m-3 border-2 border-dashed rounded-lg px-4 py-8 text-center cursor-pointer transition ${
              dragOver ? 'border-[#ff8c42] bg-[#ff8c42]/5' : 'border-[#2a2f3a] hover:border-[#3a4050] hover:bg-[#1a1d24]'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload size={20} className="mx-auto mb-2 text-[#6b7280]" />
            <p className="text-xs text-[#9ca3af] mb-1">{t.dropZoneMain}</p>
            <p className="text-[10px] text-[#6b7280]">{t.dropZoneClick}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* Image List */}
          <div className="flex-1 overflow-y-auto custom-scroll px-3 pb-3">
            {images.length === 0 ? (
              <p className="text-[11px] text-[#4b5260] text-center mt-8 leading-relaxed whitespace-pre-line">
                {t.noSprites}
              </p>
            ) : (
              <ul className="space-y-1">
                {images.map((img) => (
                  <li key={img.name} className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#1a1d24] text-xs">
                    <div className="w-6 h-6 checkerboard rounded overflow-hidden flex-shrink-0 border border-[#2a2f3a]">
                      <img src={img.canvas.toDataURL()} alt="" className="w-full h-full object-contain" />
                    </div>
                    <span className="flex-1 truncate text-[#b4bac6]">{img.name}</span>
                    <span className="text-[10px] text-[#6b7280] flex-shrink-0">{img.width}×{img.height}</span>
                    <button
                      onClick={() => removeImage(img.name)}
                      className="opacity-0 group-hover:opacity-100 text-[#6b7280] hover:text-[#d64545] transition flex-shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Main Preview Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Preview Header / Tabs */}
          <div className="border-b border-[#1f232d] bg-[#12151c] px-4 py-2 flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-[#6b7280]" />
              <span className="text-xs uppercase tracking-wider text-[#9ca3af] font-semibold">{t.preview}</span>
            </div>
            <div className="flex-1 flex items-center gap-1 overflow-x-auto custom-scroll">
              {sheets.length > 0 && sheets.map((sheet, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSheet(i)}
                  className={`px-3 py-1 text-xs rounded transition whitespace-nowrap ${
                    activeSheet === i
                      ? 'bg-[#ff8c42] text-[#0e1015] font-semibold'
                      : 'bg-[#1a1d24] text-[#9ca3af] hover:bg-[#22262f]'
                  }`}
                >
                  {t.sheet} {i} · {sheet.width}×{sheet.height}
                </button>
              ))}
            </div>
            {stats && (
              <div className="text-[10px] text-[#6b7280] flex gap-4 flex-shrink-0">
                <span><span className="text-[#9ca3af]">{stats.sheets}</span> {t.sheets}</span>
                <span><span className="text-[#9ca3af]">{stats.sprites}</span> {t.spritesCount}</span>
                <span><span className="text-[#9ca3af]">{stats.utilization}%</span> {t.utilized}</span>
              </div>
            )}
          </div>

          {/* Preview Canvas */}
          <div className="flex-1 overflow-auto custom-scroll p-8 flex items-center justify-center bg-[#0a0c10]">
            {sheets.length === 0 ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded border-2 border-dashed border-[#2a2f3a] flex items-center justify-center">
                  <Package size={24} className="text-[#3a4050]" />
                </div>
                <p className="display-font text-lg text-[#6b7280] mb-2">{t.readyTitle}</p>
                <p className="text-xs text-[#4b5260]">{t.readyHint}</p>
              </div>
            ) : (
              <div className="checkerboard rounded border border-[#1f232d] shadow-2xl inline-block">
                <canvas ref={previewCanvasRef} className="block max-w-full" style={{ imageRendering: 'pixelated' }} />
              </div>
            )}
          </div>

          {/* Status Bar */}
          {status.message && (
            <div className={`border-t px-4 py-2 text-xs flex items-center gap-2 flex-shrink-0 ${
              status.type === 'error'
                ? 'bg-[#d64545]/10 border-[#d64545]/30 text-[#f87171]'
                : status.type === 'success'
                ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#34d399]'
                : 'bg-[#1a1d24] border-[#1f232d] text-[#9ca3af]'
            }`}>
              {status.type === 'error' ? <AlertCircle size={14} /> : status.type === 'success' ? <CheckCircle2 size={14} /> : <Info size={14} />}
              <span>{status.message}</span>
            </div>
          )}
        </main>

        {/* Right Sidebar - Options */}
        <aside className="w-80 border-l border-[#1f232d] bg-[#12151c] flex flex-col">
          <div className="px-4 py-3 border-b border-[#1f232d] flex items-center gap-2">
            <Settings size={14} className="text-[#6b7280]" />
            <span className="text-xs uppercase tracking-wider text-[#9ca3af] font-semibold">{t.settings}</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-5">
            {/* Atlas Name */}
            <OptionField label={t.atlasName}>
              <input
                type="text"
                value={options.atlasName}
                onChange={(e) => setOptions({ ...options, atlasName: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                className="w-full bg-[#0a0c10] border border-[#1f232d] rounded px-2 py-1.5 text-xs text-[#d4d8e0] focus:border-[#ff8c42] focus:outline-none"
                placeholder="atlas"
              />
            </OptionField>

            {/* Max Size */}
            <OptionField label={t.maxSheetSize} hint={t.maxSheetSizeHint}>
              <div className="grid grid-cols-4 gap-1">
                {[512, 1024, 2048, 4096].map((size) => (
                  <button
                    key={size}
                    onClick={() => setOptions({ ...options, maxSize: size })}
                    className={`text-[10px] py-1.5 rounded transition ${
                      options.maxSize === size
                        ? 'bg-[#ff8c42] text-[#0e1015] font-semibold'
                        : 'bg-[#0a0c10] text-[#9ca3af] hover:bg-[#1a1d24]'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={options.maxSize}
                min={32}
                max={16384}
                step={1}
                onChange={(e) => setOptions({ ...options, maxSize: Math.max(32, Math.min(16384, parseInt(e.target.value) || 32)) })}
                className="w-full mt-2 bg-[#0a0c10] border border-[#1f232d] rounded px-2 py-1.5 text-xs text-[#d4d8e0] focus:border-[#ff8c42] focus:outline-none"
              />
            </OptionField>

            {/* Padding */}
            <OptionField label={t.padding} hint={t.paddingHint}>
              <SliderInput value={options.padding} min={0} max={20} onChange={(v) => setOptions({ ...options, padding: v })} />
            </OptionField>

            {/* Extrude */}
            <OptionField label={t.extrude} hint={t.extrudeHint}>
              <SliderInput value={options.extrude} min={0} max={4} onChange={(v) => setOptions({ ...options, extrude: v })} />
            </OptionField>

            {/* Toggles */}
            <div className="space-y-2 pt-2 border-t border-[#1f232d]">
              <Toggle
                label={t.trimLabel}
                hint={t.trimHint}
                checked={options.trim}
                onChange={(v) => setOptions({ ...options, trim: v })}
              />
              <Toggle
                label={t.allowRotation}
                hint={t.allowRotationHint}
                checked={options.allowRotation}
                onChange={(v) => setOptions({ ...options, allowRotation: v })}
              />
              <Toggle
                label={t.powerOfTwo}
                hint={t.powerOfTwoHint}
                checked={options.powerOfTwo}
                onChange={(v) => setOptions({ ...options, powerOfTwo: v })}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-[#1f232d] p-3 space-y-2">
            <button
              onClick={pack}
              disabled={loading || images.length === 0}
              className="w-full bg-[#ff8c42] hover:bg-[#ff9a5a] disabled:bg-[#2a2f3a] disabled:text-[#6b7280] text-[#0e1015] font-semibold text-xs uppercase tracking-wider py-2.5 rounded transition flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
              {t.packSprites}
            </button>
            <button
              onClick={downloadZip}
              disabled={loading || sheets.length === 0}
              className="w-full border border-[#2a2f3a] hover:border-[#ff8c42] hover:text-[#ff8c42] disabled:border-[#1f232d] disabled:text-[#4b5260] disabled:hover:border-[#1f232d] disabled:hover:text-[#4b5260] text-[#9ca3af] text-xs uppercase tracking-wider py-2.5 rounded transition flex items-center justify-center gap-2"
            >
              <Download size={14} />
              {t.downloadZip}
            </button>
          </div>
        </aside>
      </div>
    </div>
    </LangContext.Provider>
  );
}

// Recursively walk a dropped directory entry
async function traverseEntry(entry, files) {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file) => {
        files.push(file);
        resolve();
      });
    });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    return new Promise((resolve) => {
      const readAll = () => {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve();
          } else {
            await Promise.all(entries.map((e) => traverseEntry(e, files)));
            readAll();
          }
        });
      };
      readAll();
    });
  }
}

// ============================================================================
// Small UI Components
// ============================================================================

function OptionField({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[11px] uppercase tracking-wider text-[#9ca3af] font-semibold">{label}</label>
      </div>
      {children}
      {hint && <p className="text-[10px] text-[#6b7280] mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}

function SliderInput({ value, min, max, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="flex-1 accent-[#ff8c42]"
      />
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
        className="w-14 bg-[#0a0c10] border border-[#1f232d] rounded px-2 py-1 text-xs text-[#d4d8e0] text-center focus:border-[#ff8c42] focus:outline-none"
      />
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div
        className={`mt-0.5 w-8 h-4 rounded-full relative transition flex-shrink-0 ${
          checked ? 'bg-[#ff8c42]' : 'bg-[#2a2f3a]'
        }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
            checked ? 'left-4' : 'left-0.5'
          }`}
        />
      </div>
      <div className="flex-1">
        <div className="text-xs text-[#d4d8e0] group-hover:text-white transition">{label}</div>
        {hint && <div className="text-[10px] text-[#6b7280] mt-0.5 leading-relaxed">{hint}</div>}
      </div>
    </label>
  );
}
