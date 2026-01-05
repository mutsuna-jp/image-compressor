<script>
  import { onMount } from "svelte";

  /**
   * Configuration for the background animation
   */
  const CONFIG = {
    ORB_COUNT: 6,
    SIZE: { MIN: 15, MAX: 35, UNIT: "vw" },
    DURATION: { MIN: 25, MAX: 45, UNIT: "s" },
    OPACITY: { MIN: 0.6, MAX: 0.9 },
    POSITION: { MIN: -20, MAX: 100 },
    MOVEMENT: {
      TX: { MIN: -50, MAX: 50 },
      TY: { MIN: -50, MAX: 50 },
      R: { MIN: -20, MAX: 20 },
      S: { MIN: 0.9, MAX: 1.1 },
    },
    COLORS: {
      HUE_RANGE: 360,
      SATURATION: "85%",
      LIGHTNESS: "60%",
      HUE_OFFSET: { MIN: 30, MAX: 90 },
    },
  };

  /**
   * Helper to generate random numbers
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  const rand = (min, max) => Math.random() * (max - min) + min;

  /**
   * Helper to generate random vibrant gradient
   * @returns {string}
   */
  const randomGradient = () => {
    const angle = rand(0, 360);
    const h1 = rand(0, CONFIG.COLORS.HUE_RANGE);
    const h2 =
      (h1 + rand(CONFIG.COLORS.HUE_OFFSET.MIN, CONFIG.COLORS.HUE_OFFSET.MAX)) %
      360; // Keep colors somewhat related but distinct
    return `linear-gradient(${angle}deg, hsl(${h1}, ${CONFIG.COLORS.SATURATION}, ${CONFIG.COLORS.LIGHTNESS}), hsl(${h2}, ${CONFIG.COLORS.SATURATION}, ${CONFIG.COLORS.LIGHTNESS}))`;
  };

  /**
   * Generates keyframe data for orb movement
   */
  const generateKeyframes = () => {
    // Generate 3 steps of random movement with increasing intensity
    const intensityMultipliers = [1, 2, 3];

    return intensityMultipliers.map((multiplier) => ({
      tx: rand(
        CONFIG.MOVEMENT.TX.MIN * multiplier,
        CONFIG.MOVEMENT.TX.MAX * multiplier,
      ),
      ty: rand(
        CONFIG.MOVEMENT.TY.MIN * multiplier,
        CONFIG.MOVEMENT.TY.MAX * multiplier,
      ),
      r: rand(
        CONFIG.MOVEMENT.R.MIN * multiplier,
        CONFIG.MOVEMENT.R.MAX * multiplier,
      ),
      s: rand(CONFIG.MOVEMENT.S.MIN, CONFIG.MOVEMENT.S.MAX), // Scale usually shouldn't scale up wildly
    }));
  };

  /**
   * @typedef {Object} Orb
   * @property {string} size
   * @property {string} gradient
   * @property {string} duration
   * @property {number} opacity
   * @property {string} style
   */

  /** @type {Orb[]} */
  let orbs = [];

  onMount(() => {
    orbs = Array.from({ length: CONFIG.ORB_COUNT }).map(() => {
      // Randomize appearance
      const size = rand(CONFIG.SIZE.MIN, CONFIG.SIZE.MAX) + CONFIG.SIZE.UNIT;
      const duration =
        rand(CONFIG.DURATION.MIN, CONFIG.DURATION.MAX) + CONFIG.DURATION.UNIT;
      const gradient = randomGradient();
      const opacity = rand(CONFIG.OPACITY.MIN, CONFIG.OPACITY.MAX);

      // Randomize initial position
      const top = rand(CONFIG.POSITION.MIN, CONFIG.POSITION.MAX);
      const left = rand(CONFIG.POSITION.MIN, CONFIG.POSITION.MAX);

      // Generate movement keyframes
      const [kf1, kf2, kf3] = generateKeyframes();

      const cssVars = `
        --tx1: ${kf1.tx}px; --ty1: ${kf1.ty}px; --r1: ${kf1.r}deg; --s1: ${kf1.s};
        --tx2: ${kf2.tx}px; --ty2: ${kf2.ty}px; --r2: ${kf2.r}deg; --s2: ${kf2.s};
        --tx3: ${kf3.tx}px; --ty3: ${kf3.ty}px; --r3: ${kf3.r}deg; --s3: ${kf3.s};
      `.replace(/\s+/g, " ");

      return {
        size,
        gradient,
        duration,
        opacity,
        style: `top: ${top}%; left: ${left}%; ${cssVars}`,
      };
    });
  });
</script>

<div class="background-wrapper" aria-hidden="true">
  <div class="gradient-bg"></div>

  <div class="orbs-container">
    {#each orbs as orb}
      <div
        class="orb"
        style="
          width: {orb.size};
          height: {orb.size};
          background: {orb.gradient};
          animation-duration: {orb.duration};
          opacity: {orb.opacity};
          {orb.style}
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
      <!-- Blur the input image -->
      <feGaussianBlur in="SourceGraphic" stdDeviation="25" result="blur" />
      <!-- Apply alpha thresholding to create the liquid edge -->
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
    background-color: #f0f4f8;
  }

  /* Subtle subtle gradient base */
  .gradient-bg {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at 50% 50%,
      rgba(255, 255, 255, 0.8),
      transparent
    );
    z-index: 0;
  }

  .orbs-container {
    position: absolute;
    inset: 0;
    filter: url(#fluid-goo);
    opacity: 0.8; /* Slight transparency for the whole fluid layer */
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    /* filter: blur(30px); Removed to keep edges sharp for glassmorphism */
    filter: blur(0px);
    opacity: 0.8;
    mix-blend-mode: normal; /* varied blend modes can be nice */
    animation-name: float-dynamic;
    animation-timing-function: cubic-bezier(0.45, 0.05, 0.55, 0.95);
    animation-iteration-count: infinite;
    animation-direction: alternate;
    will-change: transform;
  }

  /* 
   * Dynamic Keyframes 
   * Uses CSS variables injected via inline styles for each orb
   */
  @keyframes float-dynamic {
    0% {
      transform: translate(0, 0) rotate(0deg) scale(1);
    }
    33% {
      transform: translate(var(--tx1), var(--ty1)) rotate(var(--r1))
        scale(var(--s1));
    }
    66% {
      transform: translate(var(--tx2), var(--ty2)) rotate(var(--r2))
        scale(var(--s2));
    }
    100% {
      transform: translate(var(--tx3), var(--ty3)) rotate(var(--r3))
        scale(var(--s3));
    }
  }

  /* Optional grid overlay for a "techy" feel, very subtle */
  .grid-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(
        rgba(0, 122, 255, 0.03) 1px,
        transparent 1px
      ),
      linear-gradient(90deg, rgba(0, 122, 255, 0.03) 1px, transparent 1px);
    background-size: 50px 50px;
    z-index: 1;
    pointer-events: none;
  }
</style>
