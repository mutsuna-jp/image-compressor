export interface OrbConfig {
    ORB_COUNT: number;
    SIZE: { MIN: number; MAX: number };
    OPACITY: { MIN: number; MAX: number };
    COLORS: {
        HUE_RANGE: number;
        CHROMA: number;
        LIGHTNESS: number;
        HUE_OFFSET: { MIN: number; MAX: number };
    };
    PHYSICS: {
        FRICTION: number;
        ACCELERATION: number;
        MAX_VELOCITY: number;
        BOUNDARY_FORCE: number;
        WANDER_JITTER: number;
    };
}

export const DEFAULT_CONFIG: OrbConfig = {
    ORB_COUNT: 6,
    SIZE: { MIN: 200, MAX: 500 },
    OPACITY: { MIN: 0.6, MAX: 0.9 },
    COLORS: {
        HUE_RANGE: 360,
        CHROMA: 0.18,
        LIGHTNESS: 0.75,
        HUE_OFFSET: { MIN: 30, MAX: 90 },
    },
    PHYSICS: {
        FRICTION: 0.98,
        ACCELERATION: 0.01,
        MAX_VELOCITY: 0.8,
        BOUNDARY_FORCE: 0.03,
        WANDER_JITTER: 0.01,
    },
};

export interface OrbState {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    wanderTheta: number;
}

export interface OrbVisual {
    size: number;
    gradient: string;
    opacity: number;
}

export class OrbSystem {
    width: number = 0;
    height: number = 0;
    states: OrbState[] = [];
    orbs: OrbVisual[] = [];
    config: OrbConfig;

    constructor(config: OrbConfig = DEFAULT_CONFIG) {
        this.config = config;
    }

    setConfig(newConfig: Partial<OrbConfig>) {
        this.config = { ...this.config, ...newConfig };
    }

    resize(w: number, h: number) {
        this.width = w;
        this.height = h;
    }

    private rand(min: number, max: number) {
        return Math.random() * (max - min) + min;
    }

    private randomGradient() {
        const angle = this.rand(0, 360);
        const h1 = this.rand(0, this.config.COLORS.HUE_RANGE);
        const h2 =
            (h1 + this.rand(this.config.COLORS.HUE_OFFSET.MIN, this.config.COLORS.HUE_OFFSET.MAX)) %
            360;
        return `linear-gradient(${angle}deg, oklch(${this.config.COLORS.LIGHTNESS} ${this.config.COLORS.CHROMA} ${h1}), oklch(${this.config.COLORS.LIGHTNESS} ${this.config.COLORS.CHROMA} ${h2}))`;
    }

    initOrbs() {
        // Must have dimensions to init properly
        if (!this.width || !this.height) return;

        this.states = [];
        this.orbs = [];

        for (let i = 0; i < this.config.ORB_COUNT; i++) {
            const size = this.rand(this.config.SIZE.MIN, this.config.SIZE.MAX);

            const x = this.rand(-50, this.width - size + 50);
            const y = this.rand(-50, this.height - size + 50);

            this.states.push({
                x,
                y,
                vx: this.rand(-1, 1),
                vy: this.rand(-1, 1),
                size,
                wanderTheta: this.rand(0, Math.PI * 2),
            });

            this.orbs.push({
                size,
                gradient: this.randomGradient(),
                opacity: this.rand(this.config.OPACITY.MIN, this.config.OPACITY.MAX),
            });
        }
    }

    /**
     * Updates physics and applies transforms directly to DOM elements for performance
     */
    update(
        orbElementsContrast: (HTMLElement | undefined | null)[],
        orbElementsColor: (HTMLElement | undefined | null)[],
        edgeMode: boolean
    ) {
        if (!this.width || !this.height) return;

        this.states.forEach((state, i) => {
            // 1. Wander Behaviour (Steering)
            state.wanderTheta += (Math.random() - 0.5) * this.config.PHYSICS.WANDER_JITTER;

            // Apply force in the current wander direction
            state.vx += Math.cos(state.wanderTheta) * this.config.PHYSICS.ACCELERATION;
            state.vy += Math.sin(state.wanderTheta) * this.config.PHYSICS.ACCELERATION;

            // 2. Apply Friction
            state.vx *= this.config.PHYSICS.FRICTION;
            state.vy *= this.config.PHYSICS.FRICTION;

            // Limit Velocity
            const v = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
            if (v > this.config.PHYSICS.MAX_VELOCITY) {
                state.vx = (state.vx / v) * this.config.PHYSICS.MAX_VELOCITY;
                state.vy = (state.vy / v) * this.config.PHYSICS.MAX_VELOCITY;
            }

            // 3. Update Position
            state.x += state.vx;
            state.y += state.vy;

            // 4. Boundary Logic (Soft Bounce)
            const margin = -100;

            if (state.x < margin) {
                state.vx += this.config.PHYSICS.BOUNDARY_FORCE;
                if (Math.cos(state.wanderTheta) < 0)
                    state.wanderTheta = Math.PI - state.wanderTheta;
            }
            if (state.x > this.width - state.size - margin) {
                state.vx -= this.config.PHYSICS.BOUNDARY_FORCE;
                if (Math.cos(state.wanderTheta) > 0)
                    state.wanderTheta = Math.PI - state.wanderTheta;
            }
            if (state.y < margin) {
                state.vy += this.config.PHYSICS.BOUNDARY_FORCE;
                if (Math.sin(state.wanderTheta) < 0)
                    state.wanderTheta = -state.wanderTheta;
            }
            if (state.y > this.height - state.size - margin) {
                state.vy -= this.config.PHYSICS.BOUNDARY_FORCE;
                if (Math.sin(state.wanderTheta) > 0)
                    state.wanderTheta = -state.wanderTheta;
            }

            // 5. Apply to DOM (Both layers)
            const baseTransform = `translate3d(${state.x}px, ${state.y}px, 0)`;

            let scale = 1.0;
            if (!edgeMode) {
                // Adjust scale based on opacity to ensure contrast layer stays inside color layer
                // Lower opacity -> smaller effective blur radius -> needs smaller contrast orb
                const opacity = this.orbs[i]?.opacity ?? this.config.OPACITY.MIN;
                const minScale = 0.8;
                const maxScale = 0.92;
                const ratio =
                    (opacity - this.config.OPACITY.MIN) /
                    (this.config.OPACITY.MAX - this.config.OPACITY.MIN || 1);
                scale = minScale + ratio * (maxScale - minScale);
            }

            if (orbElementsContrast[i]) {
                orbElementsContrast[i]!.style.transform = `${baseTransform} scale(${scale})`;
            }
            if (orbElementsColor[i]) {
                orbElementsColor[i]!.style.transform = baseTransform;
            }
        });
    }
}
