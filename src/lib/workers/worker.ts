import compression from 'browser-image-compression';
import { expose } from 'comlink';

const api = {
  // 標準的な圧縮処理（指定サイズにリサイズ & WebP変換）
  compress: async (file: File, maxWidthOrHeight: number) => {
    return await compression(file, {
      maxSizeMB: 1,           // 目標ファイルサイズ (MB)
      maxWidthOrHeight,       // 最大幅/高さ
      useWebWorker: true,     // ライブラリ側のWorkerも有効化
      fileType: 'image/webp', // WebP形式に変換
      initialQuality: 0.8     // 画質 (0〜1)
    });
  },

  // 正方形クロップ＆圧縮（アイコン/サムネイル用）
  compressSquare: async (file: File, size: number) => {
    // 1. ImageBitmapを作成 (EXIF回転情報を自動反映)
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = bitmap;

    // 2. 中央クロップ座標計算
    const minDim = Math.min(width, height);
    const sx = (width - minDim) / 2;
    const sy = (height - minDim) / 2;

    // 3. OffscreenCanvas で描画 (Worker内でのCanvas操作)
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context error');

    // ソースの中心部分を切り抜いてリサイズ描画
    ctx.drawImage(bitmap, sx, sy, minDim, minDim, 0, 0, size, size);

    // 4. Blob変換
    return await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
  },

  // 自由編集用（クロップ、リサイズ、品質指定）
  processCustom: async (
    file: File,
    options: {
      crop?: { x: number; y: number; width: number; height: number };
      resize?: { width: number; height: number };
      fileType?: string;
      quality?: number;
    }
  ) => {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width: srcW, height: srcH } = bitmap;

    // クロップ範囲（指定がなければ全体）
    const cx = options.crop?.x ?? 0;
    const cy = options.crop?.y ?? 0;
    const cw = options.crop?.width ?? srcW;
    const ch = options.crop?.height ?? srcH;

    // 出力サイズ（指定がなければクロップサイズ）
    const ow = options.resize?.width ?? cw;
    const oh = options.resize?.height ?? ch;

    // OffscreenCanvas
    const canvas = new OffscreenCanvas(ow, oh);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context error');

    // クロップ＆リサイズ描画
    // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
    ctx.drawImage(bitmap, cx, cy, cw, ch, 0, 0, ow, oh);

    // Blob変換
    return await canvas.convertToBlob({
      type: options.fileType || 'image/webp',
      quality: options.quality || 0.8
    });
  }
};

// Comlinkを使ってメインスレッドに公開
expose(api);

// 型定義をエクスポート（利用側で使用）
export type WorkerApi = typeof api;