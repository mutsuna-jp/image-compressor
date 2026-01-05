<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { OrbSystem, DEFAULT_CONFIG } from "$lib/logic/orbPhysics";

  export let edgeMode = false;
  export let orbCount = 6;
  export let sizeMin = 200;
  export let sizeMax = 500;

  const orbSystem = new OrbSystem(DEFAULT_CONFIG);

  // Local state for template rendering
  let orbs = orbSystem.orbs;

  // DOM References
  let orbElementsContrast: (HTMLElement | null)[] = [];
  let orbElementsColor: (HTMLElement | null)[] = [];

  let animationFrameId: number;
  let width: number, height: number;

  // Reactivity for config changes
  $: {
    orbSystem.setConfig({
      ORB_COUNT: orbCount,
      SIZE: { MIN: sizeMin, MAX: sizeMax },
    });

    // Re-init if dimensions are available (handled by width/height update too)
    if (width && height) {
      orbSystem.resize(width, height);
      orbSystem.initOrbs();
      orbs = orbSystem.orbs; // Trigger Svelte update
    }
  }

  const updatePhysics = () => {
    orbSystem.update(orbElementsContrast, orbElementsColor, edgeMode);
    animationFrameId = requestAnimationFrame(updatePhysics);
  };

  onMount(() => {
    width = window.innerWidth;
    height = window.innerHeight;

    // Initial setup
    orbSystem.resize(width, height);
    orbSystem.initOrbs();
    orbs = orbSystem.orbs;

    animationFrameId = requestAnimationFrame(updatePhysics);

    let resizeTimeout: number;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        width = window.innerWidth;
        height = window.innerHeight;
        // The reactive block above will handle re-init because width/height changed
      }, 200) as unknown as number;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  });
</script>

<div class="background-wrapper" aria-hidden="true">
  <div class="gradient-bg"></div>

  <!-- Layer 1: The Text (Black) -->
  <div class="text-layer" in:fade={{ duration: 600 }}>
    <div class="header-content">
      <h1>Image Studio</h1>
      <p class="subtitle">リサイズ、トリミング、圧縮を自由自在に。</p>
    </div>
  </div>

  <!-- Layer 2: Contrast Orbs (Difference Mode) -->
  <!-- These will invert the black text to white, and the white bg to black -->
  <div class="orbs-container contrast-layer">
    {#each orbs as orb, i}
      <div
        class="orb"
        bind:this={orbElementsContrast[i]}
        style="
          width: {orb.size}px;
          height: {orb.size}px;
          background: #fff;
          opacity: 1; /* Strong mask */
          top: 0;
          left: 0;
        "
      ></div>
    {/each}
  </div>

  <!-- Layer 3: Color Orbs (Screen Mode) -->
  <!-- These will colorize the black result from Layer 2, and keep white text white -->
  <div class="orbs-container color-layer">
    {#each orbs as orb, i}
      <div
        class="orb"
        bind:this={orbElementsColor[i]}
        style="
          width: {orb.size}px;
          height: {orb.size}px;
          background: {orb.gradient};
          opacity: {orb.opacity};
          top: 0;
          left: 0;
        "
      ></div>
    {/each}
  </div>

  <div class="grid-overlay"></div>
</div>

<!-- SVG Filter for the Gooey/Fluid Effect -->
<svg
  style="position: absolute; width: 0; height: 0; pointer-events: none;"
  aria-hidden="true"
>
  <defs>
    <filter id="fluid-goo">
      <feGaussianBlur in="SourceGraphic" stdDeviation="25" result="blur" />
      <feColorMatrix
        in="blur"
        mode="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 100 -30"
        result="goo"
      />
    </filter>
  </defs>
</svg>

<style>
  .background-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: -1;
    overflow: hidden;
    background-color: oklch(0.97 0.01 240);
  }

  /* Subtle gradient base */
  .gradient-bg {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at 50% 50%,
      oklch(1 0 0 / 0.8),
      transparent
    );
    z-index: 0;
  }

  /* Text Layer Styles */
  .text-layer {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    justify-content: center;
    /* Move text up slightly to match original design's likely position */
    padding-top: 10vh;
    pointer-events: none;
  }

  .header-content {
    text-align: center;
  }

  .header-content h1 {
    font-size: 2.2rem;
    font-weight: 800;
    margin: 0 0 0.2rem 0;
    color: #171717; /* Dark black/grey */
    letter-spacing: -1px;
    font-family: inherit;
  }

  .subtitle {
    font-size: 1rem;
    color: #404040; /* Dark grey */
    font-weight: 500;
    font-family: inherit;
  }

  /* Shared Container Styles */
  .orbs-container {
    position: absolute;
    inset: 0;
    filter: url(#fluid-goo);
    pointer-events: none;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    will-change: transform;
  }

  /* Layer 2 Specifics */
  .contrast-layer {
    z-index: 2;
    mix-blend-mode: difference;
    opacity: 1;
  }

  /* Layer 3 Specifics */
  .color-layer {
    z-index: 3;
    mix-blend-mode: screen;
    /* Screen on top of Difference(White, BlackText) -> Screen(Color, White) -> White */
    /* Screen on top of Difference(White, WhiteBG) -> Screen(Color, Black) -> Color */
  }

  .grid-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(
        oklch(0.6 0.2 260 / 0.03) 1px,
        transparent 1px
      ),
      linear-gradient(90deg, oklch(0.6 0.2 260 / 0.03) 1px, transparent 1px);
    background-size: 50px 50px;
    z-index: 4;
    pointer-events: none;
  }
</style>
