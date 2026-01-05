<script lang="ts">
  import { wrap } from "comlink";
  import type { WorkerApi } from "$lib/workers/worker";
  import Background from "$lib/components/Background.svelte";
  import { fade, fly } from "svelte/transition";
  import { onMount } from "svelte";
  import "cropperjs/dist/cropper.css";
  import {
    Upload,
    Image as ImageIcon,
    Settings,
    ShieldCheck,
    Zap,
    Palette,
    Lock,
    Unlock,
    Download,
    X,
  } from "lucide-svelte";

  let selectedFile = $state<File | null>(null);
  let previewUrl = $state<string>("");
  let isProcessing = $state(false);
  let isDragging = $state(false);
  let results = $state<Array<{ label: string; url: string; size: number }>>([]);

  // Editor State
  let imageElement = $state<HTMLImageElement | null>(null);
  let showCustomEditor = $state(false);
  let CropperClass = $state<any>(null); // Class definition
  let cropper = $state<any>(null); // Instance
  let targetWidth = $state<number>(0);
  let targetHeight = $state<number>(0);
  let lockAspectRatio = $state(true);
  let outputQuality = $state(0.8);
  let outputFormat = $state<"image/webp" | "image/jpeg" | "image/png">(
    "image/webp",
  );

  onMount(async () => {
    const module = await import("cropperjs");
    CropperClass = module.default;
  });

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (srcUrl) URL.revokeObjectURL(srcUrl);
    selectedFile = file;
    previewUrl = URL.createObjectURL(file);
    results = [];

    // Reset inputs
    targetWidth = 0;
    targetHeight = 0;
    showCustomEditor = false;

    // Auto-generate standard set
    generateStandard();
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragging = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragging = false;

    const dt = e.dataTransfer;
    const file = dt?.files?.[0];

    if (file && file.type.startsWith("image/")) {
      if (srcUrl) URL.revokeObjectURL(srcUrl);
      selectedFile = file;
      previewUrl = URL.createObjectURL(file);
      results = [];

      // Reset inputs
      targetWidth = 0;
      targetHeight = 0;
      showCustomEditor = false;

      // Auto-generate standard set
      generateStandard();
    }
  }

  let srcUrl = $derived(previewUrl);

  let syncOutputSize = $state(true);

  // We can use an effect or just the crop event
  function onCrop(event: any) {
    if (syncOutputSize) {
      targetWidth = Math.round(event.detail.width);
      targetHeight = Math.round(event.detail.height);
    }
  }

  function setupCropper() {
    if (!imageElement || !CropperClass) return;
    if (cropper) cropper.destroy();

    cropper = new CropperClass(imageElement, {
      viewMode: 1,
      autoCropArea: 1,
      responsive: true,
      crop: onCrop,
    });
  }

  function handleInputWidth() {
    // If user types, we turn off sync? Or just let them type.
    // If they drag crop later, it will overwrite if sync is on.
    // So if user types, we should probably turn off sync.
    syncOutputSize = false;

    if (lockAspectRatio && cropper) {
      const data = cropper.getData();
      const ratio = data.width / data.height;
      targetHeight = Math.round(targetWidth / ratio);
    }
  }

  function handleInputHeight() {
    syncOutputSize = false;
    if (lockAspectRatio && cropper) {
      const data = cropper.getData();
      const ratio = data.width / data.height;
      targetWidth = Math.round(targetHeight * ratio);
    }
  }

  async function generateCustom() {
    if (!selectedFile || !cropper) return;

    try {
      isProcessing = true;
      const worker = new Worker(
        new URL("$lib/workers/worker.ts", import.meta.url),
        { type: "module" },
      );
      const imageWorker = wrap<WorkerApi>(worker);

      const cropData = cropper.getData();

      const blob = await imageWorker.processCustom(selectedFile, {
        crop: {
          x: cropData.x,
          y: cropData.y,
          width: cropData.width,
          height: cropData.height,
        },
        resize: {
          width: targetWidth || cropData.width,
          height: targetHeight || cropData.height,
        },
        fileType: outputFormat,
        quality: outputQuality,
      });

      const label = `Custom (${targetWidth}x${targetHeight})`;
      results = [
        { label, url: URL.createObjectURL(blob), size: blob.size },
        ...results,
      ];

      worker.terminate();
    } catch (err) {
      console.error(err);
      alert("処理に失敗しました");
    } finally {
      isProcessing = false;
    }
  }

  async function generateStandard() {
    if (!selectedFile) return;
    try {
      isProcessing = true;
      const worker = new Worker(
        new URL("$lib/workers/worker.ts", import.meta.url),
        { type: "module" },
      );
      const imageWorker = wrap<WorkerApi>(worker);

      const [largeBlob, mediumBlob, squareBlob] = await Promise.all([
        imageWorker.compress(selectedFile, 1600),
        imageWorker.compress(selectedFile, 800),
        imageWorker.compressSquare(selectedFile, 400),
      ]);

      const standardResults = [
        {
          label: "Large (1600px)",
          url: URL.createObjectURL(largeBlob),
          size: largeBlob.size,
        },
        {
          label: "Medium (800px)",
          url: URL.createObjectURL(mediumBlob),
          size: mediumBlob.size,
        },
        {
          label: "Square (400px)",
          url: URL.createObjectURL(squareBlob),
          size: squareBlob.size,
        },
      ];

      results = [...results, ...standardResults];
      worker.terminate();
    } catch (err) {
      console.error(err);
      alert("処理に失敗しました");
    } finally {
      isProcessing = false;
    }
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
</script>

<div class="page-container">
  <!-- Dynamic Background Component -->
  <Background />

  <div class="content-wrapper">
    <header class="header" in:fade={{ duration: 600 }}>
      <h1>Image Studio</h1>
      <p class="subtitle">リサイズ、トリミング、圧縮を自由自在に。</p>
    </header>

    {#if !selectedFile}
      <div class="upload-section" in:fade={{ duration: 600, delay: 200 }}>
        <div
          class="file-input-wrapper"
          role="region"
          aria-label="File Upload"
          ondragenter={handleDragEnter}
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
        >
          <input
            type="file"
            accept="image/*"
            onchange={handleFileSelect}
            id="file-upload"
            class="file-input-hidden"
          />
          <label
            for="file-upload"
            class="file-label"
            class:dragging={isDragging}
          >
            <div class="icon-wrapper">
              <Upload size={48} strokeWidth={1.5} />
            </div>
            <span class="label-main">画像を選択</span>
            <span class="label-sub">またはドラッグ＆ドロップ</span>
          </label>
        </div>
      </div>

      <div class="tech-appeal" in:fade={{ duration: 600, delay: 400 }}>
        <h2>Technical Highlights</h2>
        <div class="tech-grid">
          <div class="tech-item">
            <span class="tech-icon"><ShieldCheck size={32} /></span>
            <h3>Secure & Private</h3>
            <p>
              サーバーへのアップロード不要。すべての処理はブラウザ内で完結するため、プライバシーは完全に保護されます。
            </p>
          </div>
          <div class="tech-item">
            <span class="tech-icon"><Zap size={32} /></span>
            <h3>High Performance</h3>
            <p>
              Web
              WorkersとOffscreenCanvasを活用し、UIスレッドをブロックすることなく高速な画像処理を実現しています。
            </p>
          </div>
          <div class="tech-item">
            <span class="tech-icon"><Palette size={32} /></span>
            <h3>Modern Architecture</h3>
            <p>
              Svelte
              5のRunesを使用した最新のステート管理と、Glassmorphismを取り入れた美しいデザインシステム。
            </p>
          </div>
        </div>
      </div>
    {:else if showCustomEditor}
      <div class="editor-section" in:fade>
        <div class="editor-main">
          <div class="image-container">
            <!-- svelte-ignore a11y_img_redundant_alt -->
            <img
              bind:this={imageElement}
              src={previewUrl}
              alt="Source Image"
              onload={setupCropper}
            />
          </div>

          <div class="controls-panel">
            <div class="control-group">
              <div class="label-row">
                <span class="label-text">出力サイズ (px)</span>
                <label class="checkbox-label">
                  <input type="checkbox" bind:checked={syncOutputSize} />
                  連動
                </label>
              </div>
              <div class="input-row">
                <input
                  type="number"
                  bind:value={targetWidth}
                  oninput={handleInputWidth}
                  placeholder="幅"
                />
                <span>x</span>
                <input
                  type="number"
                  bind:value={targetHeight}
                  oninput={handleInputHeight}
                  placeholder="高さ"
                />
                <button
                  class="icon-btn"
                  onclick={() => (lockAspectRatio = !lockAspectRatio)}
                  title="アスペクト比を固定"
                >
                  {#if lockAspectRatio}
                    <Lock size={18} />
                  {:else}
                    <Unlock size={18} />
                  {/if}
                </button>
              </div>
            </div>

            <div class="control-group">
              <span class="label-text">出力設定</span>
              <div class="input-row">
                <select bind:value={outputFormat}>
                  <option value="image/webp">WebP</option>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/png">PNG</option>
                </select>
                <div class="quality-slider">
                  <span>画質: {Math.round(outputQuality * 100)}%</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    bind:value={outputQuality}
                  />
                </div>
              </div>
            </div>

            <div class="action-buttons">
              <button
                class="btn btn-primary"
                onclick={generateCustom}
                disabled={isProcessing}
              >
                {#if isProcessing}処理中...{:else}カスタム生成{/if}
              </button>
              <div class="button-group-row">
                <button
                  class="btn btn-secondary"
                  onclick={generateStandard}
                  disabled={isProcessing}
                >
                  標準セット再生成
                </button>
                <button
                  class="btn btn-secondary"
                  onclick={() => (showCustomEditor = false)}
                >
                  閉じる
                </button>
              </div>
              <!-- Remove main close button from here since we added a specific close for editor -->
            </div>
          </div>
        </div>
      </div>
    {:else}
      <div class="simple-actions" in:fade>
        <div class="simple-actions-content">
          <button
            class="btn btn-primary toggle-custom-btn"
            onclick={() => (showCustomEditor = true)}
          >
            カスタム生成機能を表示
          </button>
          <button class="btn btn-danger" onclick={() => (selectedFile = null)}>
            ファイルを閉じる
          </button>
        </div>
      </div>
    {/if}

    {#if results.length > 0}
      <div class="results-grid">
        {#each results as res, i}
          <div class="card" in:fly={{ y: 20, duration: 500, delay: i * 100 }}>
            <div class="card-header">
              <h3>{res.label}</h3>
              <span class="size-badge">{formatSize(res.size)}</span>
            </div>
            <div class="preview-box">
              <img src={res.url} alt={res.label} class="preview-image" />
            </div>
            <a
              href={res.url}
              download={res.label +
                (outputFormat === "image/jpeg"
                  ? ".jpg"
                  : outputFormat === "image/png"
                    ? ".png"
                    : ".webp")}
              class="download-btn"
            >
              <Download size={18} />
              ダウンロード
            </a>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Global Variables & Glass Theme */
  :global(:root) {
    --primary: #007aff; /* iOS Blue */
    --primary-gradient: linear-gradient(135deg, #007aff, #00c6ff);
    --text-primary: #1c1c1e;
    --text-secondary: #3a3a3c;
    --glass-bg: rgba(255, 255, 255, 0.65);
    --glass-border: rgba(255, 255, 255, 0.4);
    --glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
    --radius-lg: 24px; /* iOS-like large radius */
    --radius-md: 16px;
    --radius-sm: 10px;
  }

  :global(body) {
    margin: 0;
    overflow-x: hidden;
    background-color: #f0f4f8; /* Match page container bg */
  }

  /* Animated Background Styles Removed - Moved to Background.svelte */

  .page-container {
    box-sizing: border-box; /* Include padding in height calculation */
    min-height: 100vh;
    color: var(--text-primary);
    padding: 0.5rem; /* Reduced from 1rem */
    display: flex;
    justify-content: center;
    align-items: center; /* Center vertically */
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      Helvetica,
      Arial,
      sans-serif;
    position: relative;
    /* overflow-x: hidden; Removed to prevent double scrollbar */
    /* background-color: #f0f4f8; Moved to body to prevent white corners if overscrolled */
  }

  .content-wrapper {
    width: 100%;
    max-width: 1000px; /* Reduced max-width to keep things tighter */
    position: relative;
    z-index: 1;
    display: flex; /* Added for better vertical distribution if needed */
    flex-direction: column;
    justify-content: center; /* Center content vertically if space allows */
  }

  .header {
    text-align: center;
    margin-bottom: 1.5rem; /* Reduced from 2rem */
  }

  .header h1 {
    font-size: 2.2rem; /* Reduced from 3rem */
    font-weight: 800;
    margin: 0 0 0.2rem 0;
    color: #fff;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    letter-spacing: -1px;
  }

  .subtitle {
    font-size: 1rem; /* Reduced from 1.1rem */
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
  }

  /* Upload Section */
  .upload-section {
    max-width: 500px; /* Narrower upload section */
    margin: 0 auto;
    width: 100%;
  }

  .file-input-wrapper {
    position: relative;
    width: 100%;
  }

  .file-input-hidden {
    position: absolute;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    z-index: 10;
  }

  .file-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.5rem 1rem; /* Drastically reduced vertical padding */

    /* Glass Style */
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 2px dashed rgba(255, 255, 255, 0.6);
    border-radius: 24px; /* Slightly smaller radius */
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);

    transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  }

  .file-input-wrapper:hover .file-label,
  .file-label.dragging {
    background: rgba(255, 255, 255, 0.8);
    transform: scale(1.02);
    border-color: var(--primary);
    box-shadow: 0 12px 40px 0 rgba(0, 122, 255, 0.2);
  }

  .icon-wrapper {
    color: #fff;
    margin-bottom: 0.8rem; /* Reduced */
    padding: 0.8rem; /* Reduced */
    background: linear-gradient(135deg, #007aff, #5ac8fa);
    border-radius: 50%;
    box-shadow: 0 4px 15px rgba(0, 122, 255, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .label-main {
    font-size: 1.2rem; /* Reduced */
    font-weight: 700;
    color: #333; /* Darker for contrast on glass */
    margin-bottom: 0.3rem;
  }

  .label-sub {
    color: #666;
    font-size: 0.9rem;
  }

  /* Editor Section */
  .editor-section {
    /* Glass Style */
    background: var(--glass-bg);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--glass-border);
    box-shadow: var(--glass-shadow);
    border-radius: var(--radius-lg);
    overflow: hidden;
    margin-bottom: 2rem; /* Reduced from 3rem */
  }

  .editor-main {
    display: grid;
    grid-template-columns: 2fr 1.2fr;
    gap: 0;
  }

  @media (max-width: 850px) {
    .editor-main {
      grid-template-columns: 1fr;
    }
  }

  .image-container {
    background: rgba(0, 0, 0, 0.6); /* Semi-transparent dark */
    min-height: 400px;
    height: 500px; /* Reduced from 600px */
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid rgba(255, 255, 255, 0.2);
  }

  .image-container img {
    max-width: 100%;
    max-height: 100%;
    display: block;
  }

  .controls-panel {
    padding: 1.5rem; /* Reduced from 2.5rem */
    display: flex;
    flex-direction: column;
    gap: 1.5rem; /* Reduced from 2.5rem */
    background: rgba(
      255,
      255,
      255,
      0.3
    ); /* Slightly separate from main glass */
  }

  .control-group label,
  .control-group .label-text {
    display: block;
    font-weight: 700;
    margin-bottom: 0.5rem; /* Reduced from 0.8rem */
    font-size: 0.85rem;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.8;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem; /* Reduced from 0.8rem */
  }

  .checkbox-label {
    font-weight: 500 !important;
    font-size: 0.8rem !important;
    text-transform: none !important;
    opacity: 1 !important;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.4);
    padding: 2px 8px;
    border-radius: 20px;
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  /* iOS Style Inputs */
  input[type="number"],
  select {
    background: rgba(255, 255, 255, 0.5);
    border: none;
    padding: 0.6rem 0.8rem; /* Reduced padding */
    border-radius: 10px;
    font-size: 0.9rem;
    color: var(--text-primary);
    font-weight: 600;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
    transition: all 0.2s;
    min-width: 60px;
  }

  input[type="number"]:focus,
  select:focus {
    background: rgba(255, 255, 255, 0.9);
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.5);
  }

  .quality-slider {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    flex: 1;
    min-width: 120px;
    background: rgba(255, 255, 255, 0.5);
    padding: 0.6rem; /* Reduced padding */
    border-radius: 12px;
  }

  .quality-slider span {
    font-size: 0.7rem;
    color: var(--text-primary);
    font-weight: 700;
  }

  .quality-slider input[type="range"] {
    width: 100%;
    accent-color: var(--primary);
  }

  .icon-btn {
    background: rgba(255, 255, 255, 0.5);
    border: none;
    width: 36px; /* Reduced from 44px */
    height: 36px; /* Reduced from 44px */
    border-radius: 10px;
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.8);
    transform: scale(1.05);
  }

  /* iOS Style Buttons */
  .action-buttons {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .btn {
    padding: 0.7rem; /* Reduced from 1rem */
    border-radius: 40px; /* Pill shape */
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
    border: none;
    transition: all 0.3s;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .btn:active {
    transform: scale(0.98);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--primary-gradient);
    color: white;
    box-shadow: 0 10px 20px rgba(0, 122, 255, 0.3);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  .btn-primary:hover:not(:disabled) {
    box-shadow: 0 15px 30px rgba(0, 122, 255, 0.4);
    transform: translateY(-2px);
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.5);
    color: var(--text-primary);
    backdrop-filter: blur(5px);
  }
  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.8);
  }

  .btn-danger {
    background: rgba(255, 59, 48, 0.1);
    color: #ff3b30;
  }
  .btn-danger:hover {
    background: rgba(255, 59, 48, 0.2);
  }

  /* Results */
  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    padding-bottom: 2rem;
  }

  .card {
    /* Glass Style */
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: 20px;
    padding: 1.2rem;
    box-shadow: var(--glass-shadow);

    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
  }

  .card:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    background: rgba(255, 255, 255, 0.75);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .card-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #000;
  }

  .size-badge {
    background: rgba(0, 0, 0, 0.05);
    padding: 4px 10px;
    border-radius: 16px;
    font-size: 0.8rem;
    font-family: "SF Mono", "Menlo", monospace;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .preview-box {
    background: rgba(255, 255, 255, 0.5);
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 1.2rem;
    aspect-ratio: 16/10;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.5);
  }

  .preview-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .download-btn {
    text-align: center;
    background: #1c1c1e;
    color: white;
    padding: 0.8rem;
    border-radius: 40px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9rem;
    margin-top: auto;
    transition: all 0.3s;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .download-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
    background: #000;
  }

  .simple-actions {
    display: flex;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .simple-actions-content {
    display: flex;
    gap: 1.2rem;
    padding: 0.8rem;
    background: rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    border-radius: 50px;
    border: 1px solid rgba(255, 255, 255, 0.4);
  }

  .toggle-custom-btn {
    min-width: 200px;
  }

  /* Technical Appeal Section */
  .tech-appeal {
    margin-top: 2rem; /* Reduce top margin sharply */
    text-align: center;
    color: var(--text-primary);
  }

  .tech-appeal h2 {
    font-size: 1.3rem; /* Reduce font size */
    margin-bottom: 1rem; /* Reduce bottom margin */
    color: var(--text-primary);
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
  }

  .tech-grid {
    display: grid;
    /* Force 3 columns earlier to save vertical space */
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem; /* Compact gap */
    max-width: 1000px;
    margin: 0 auto;
  }

  .tech-item {
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: 1rem; /* Very compact padding */
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
    transition:
      transform 0.3s,
      background 0.3s;
    text-align: left;
  }

  .tech-item:hover {
    transform: translateY(-3px);
    background: rgba(255, 255, 255, 0.6);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  }

  .tech-icon {
    color: var(--primary);
    display: inline-flex;
    margin-bottom: 0.5rem;
    padding: 8px; /* Smaller icon padding */
    background: rgba(0, 122, 255, 0.1);
    border-radius: 10px;
  }

  .tech-item h3 {
    font-size: 1rem;
    margin: 0 0 0.4rem 0;
    font-weight: 700;
  }

  .tech-item p {
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--text-secondary);
    margin: 0;
  }
</style>
