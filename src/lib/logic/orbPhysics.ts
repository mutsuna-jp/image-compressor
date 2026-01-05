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
        REPULSION_STRENGTH: number;
        REPULSION_RADIUS_FACTOR: number;
        GRAVITY_STRENGTH: number;
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
        ACCELERATION: 0.015, // SLIGHT BOOST
        MAX_VELOCITY: 0.8,
        BOUNDARY_FORCE: 0.03,
        WANDER_JITTER: 0.08, // DOUBLED FROM 0.01 -> 0.08 (Chaotic)
        REPULSION_STRENGTH: 0.5,
        REPULSION_RADIUS_FACTOR: 0.5,
        GRAVITY_STRENGTH: 1.5, // Star-like gravity (Increased for visibility)
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
    time: number = 0;

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

        this.time += 0.002; // Time step for ambient noise

        // Fluid Physics Constants (tuned for "floating/viscous" feel)
        const TANGENTIAL_FORCE = 0.08; 
        
        // Gravity Constants
        // G_CONST scales the force. We need it to be subtle but effective.
        // Form: F = G * (m1 * m2) / distSq
        const GRAVITY_STRENGTH = this.config.PHYSICS.GRAVITY_STRENGTH || 0.05;

        // 0. Ambient Drift (Global Flow)
        // Instead of a global flow, we use independent noise for each orb to prevent them from moving together.
        // We create a "spatial" noise effect by using the orb's index as a large offset.
        for (let i = 0; i < this.states.length; i++) {
            const s = this.states[i];
            
            // Unique phase for each orb (large offset prevents correlation)
            const t = this.time;
            const seed = i * 1000; 

            // Pseudo-Perlin approximation: Sum of 2 sine waves with different frequencies
            // Increased amplitude for more "alive" feel
            const noiseX = 
                Math.sin(t * 0.5 + seed) * 0.04 + 
                Math.sin(t * 1.3 + seed * 2) * 0.02;
                
            const noiseY = 
                Math.cos(t * 0.6 + seed) * 0.04 + 
                Math.cos(t * 1.4 + seed * 3) * 0.02;

            s.vx += noiseX;
            s.vy += noiseY;
        }

        // 1. Fluid Interactions (Repulsion + Vortex)
        for (let i = 0; i < this.states.length; i++) {
            for (let j = i + 1; j < this.states.length; j++) {
                const s1 = this.states[i];
                const s2 = this.states[j];

                const c1x = s1.x + s1.size / 2;
                const c1y = s1.y + s1.size / 2;
                const c2x = s2.x + s2.size / 2;
                const c2y = s2.y + s2.size / 2;

                const dx = c1x - c2x;
                const dy = c1y - c2y;
                const distSq = dx * dx + dy * dy;

                if (distSq === 0) continue;

                const dist = Math.sqrt(distSq);
                
                // Effective radius for interaction
                const r1 = s1.size / 2;
                const r2 = s2.size / 2;
                
                // Masses
                const m1 = s1.size;
                const m2 = s2.size;

                // CRITICAL FIX: Use full radius for interaction range logic
                // The config factor (0.5) was allowing deep overlap before ANY physics applied.
                // We now interact whenever they physically touch (factor 1.0) and even slightly before for fluid effect.
                // 1.3x radius to act as "Surface Tension" zone (Suction before touch)
                const interactDist = (r1 + r2) * 1.3; 

                // 1.5. GRAVITY (Universal Attraction)
                // "Star-like": interacting at infinite distance
                // Apply gravity BEFORE repulsion overwrite to ensure it's additive, 
                // OR integrate it into the net force.
                // Here we apply it always.
                
                // Avoid division by zero or extreme forces at close range (softening parameter)
                // We use a "softened" gravity to prevent singularities: 1 / (d^2 + epsilon^2)
                const softeningSq = 5000; // ~70px effective smoothing radius
                const gravityDistSq = distSq + softeningSq;
                
                // F = G * m1 * m2 / r^2
                // We normalize by mass later (a = F/m), so acceleration = G * m_other / r^2
                // This means massive objects attract others more strongly.
                
                // m1 attracts m2 (force points to 1) 
                // m2 attracts m1 (force points to 2) 
                // We calculated dx as (c1 - c2), pointing 2 -> 1
                
                // Force Magnitude
                // Scaling: We want reasonable pixels/frame^2. 
                // Masses are ~300. 300*300 = 90000. 
                // DistSq can be 2000*2000 = 4,000,000.
                // 90000 / 4000000 ~ 0.02. 
                // GRAVITY_STRENGTH should be around 0.1 - 1.0 depending on desired pull.
                
                const forceG = (GRAVITY_STRENGTH * m1 * m2) / gravityDistSq;
                
                // Decompose gravity vector (Unit vector * Magnitude)
                // (dx/dist) * forceG
                // We can optimize: (dx / dist) * forceG  ---> if we use dist in denom of Force?
                // Let's stick to standard: vector = (dx, dy) normalized * force magnitude
                
                const nxG = dx / dist;
                const nyG = dy / dist;
                
                // Apple Gravity to Velocity
                // v += F / m
                
                // Object 1 is pulled towards Object 2 (-dir)
                // Object 2 is pulled towards Object 1 (+dir) -> Wait. dx is (x1-x2).
                // If x1 > x2, dx is positive. 1 is to the right.
                // 1 should move LEFT (-dx). 2 should move RIGHT (+dx).
                
                s1.vx -= (nxG * forceG) / m1;
                s1.vy -= (nyG * forceG) / m1;
                s2.vx += (nxG * forceG) / m2;
                s2.vy += (nyG * forceG) / m2;

                if (dist < interactDist) {
                    const nx = dx / dist; // Normal X
                    const ny = dy / dist; // Normal Y
                    
                    // Tangential Vector (Perpendicular to Normal)
                    const tx = -ny; 
                    const ty = nx;

                    // Relative velocity dot Tangential = how much they are sliding past each other
                    // We want to induce a "spin" or "curl"
                    
                    // 1. Repulsion & Surface Tension
                    // We define a boundary at r1+r2 (physical touch).
                    // dist < r1+r2: REPULSION (Positive force)
                    // dist > r1+r2: ATTRACTION / TENSION (Negative force)
                    
                    const touchDist = r1 + r2;
                    const repulsionStrength = this.config.PHYSICS.REPULSION_STRENGTH || 0.5;
                    
                    let force = 0;
                    
                    if (dist < touchDist) {
                        // INSIDE (Overlapping) -> Repel
                        // Normalized overlap (0 to 1, where 1 is center-on-center)
                        const overlap = touchDist - dist;
                        const t = overlap / touchDist; 
                        
                        // Exponential repulsion
                        force = repulsionStrength * (Math.exp(t * 4)); 
                    } else {
                        // OUTSIDE (Surface Tension Zone) -> Attract
                        // This is the "Suction" zone.
                        // Normalized distance in the zone (0 at touch, 1 at max interactDist)
                        const zoneWidth = interactDist - touchDist;
                        const distInZone = dist - touchDist;
                        const t = distInZone / zoneWidth;
                        
                        // Sinusoidal suction curve:
                        // Starts at 0 force at touch (equilibrium? no, we want it sticky at touch usually)
                        // Actually, let's make it continuous.
                        // At t=0 (touch), we want strong suction? No, if we want equilibrium at touch, force should be 0.
                        // But user wants "sticky", so maybe equilibrium is slightly overlapping?
                        // Let's target equilibrium at exactly touchDist.
                        // t goes 0 -> 1.
                        // We want force to go 0 -> -Max -> 0/Merge with Gravity
                        
                        // Strong suction peak near the surface
                        const suctionStrength = 0.8; // Stronger than global gravity
                        force = -suctionStrength * Math.sin(t * Math.PI); 
                    }

                    // 2. Tangential Force (Vortex/Slide)
                    const chirality = (i + j) % 2 === 0 ? 1 : -1;
                    const slide = chirality * TANGENTIAL_FORCE * (1 - dist / interactDist);

                    // Apply Contact Forces
                    // Repulsion / Suction
                    s1.vx += (nx * force) / m1;
                    s1.vy += (ny * force) / m1;
                    s2.vx -= (nx * force) / m2;
                    s2.vy -= (ny * force) / m2;

                    // Tangential (Slide)
                    s1.vx += (tx * slide) / m1;
                    s1.vy += (ty * slide) / m1;
                    s2.vx -= (tx * slide) / m2;
                    s2.vy -= (ty * slide) / m2;
                }
            }
        }

        this.states.forEach((state, i) => {
            // 2. Wander Behaviour (Steering)
            // Gently steer the velocity vector, don't just overwrite it.
            state.wanderTheta += (Math.random() - 0.5) * this.config.PHYSICS.WANDER_JITTER;
            
            // Align wanderTheta slightly with current velocity to prevent "fighting" movement
            // This makes the movement smoother and more logical
            const currentAngle = Math.atan2(state.vy, state.vx);
            // Shortest angle difference
            let diff = currentAngle - state.wanderTheta;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            state.wanderTheta += diff * 0.02; // Small factor to slowly align

            // Apply force in the current wander direction
            state.vx += Math.cos(state.wanderTheta) * this.config.PHYSICS.ACCELERATION * 0.5;
            state.vy += Math.sin(state.wanderTheta) * this.config.PHYSICS.ACCELERATION * 0.5;

            // 3. Apply Friction (Viscosity)
            state.vx *= this.config.PHYSICS.FRICTION;
            state.vy *= this.config.PHYSICS.FRICTION;

            // Limit Velocity (Soft limit)
            const v = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
            if (v > this.config.PHYSICS.MAX_VELOCITY) {
                state.vx = (state.vx / v) * this.config.PHYSICS.MAX_VELOCITY;
                state.vy = (state.vy / v) * this.config.PHYSICS.MAX_VELOCITY;
            }

            // 4. Update Position
            state.x += state.vx;
            state.y += state.vy;

            // 5. Flow Field Boundary (Steering, not bouncing)
            // Instead of a hard wall or spring force, we simply gently steer the "wander" direction
            // towards the center when the orb gets too far away.
            const margin = -100; // Trigger return BEFORE they fully leave the screen
            
            // defined boundaries where we start steering back
            const minX = margin;
            const maxX = this.width - margin - state.size; 
            const minY = margin;
            const maxY = this.height - margin - state.size;

            let distOut = 0; // Usage: how far "deep" into the void are we?
            let targetAngle = state.wanderTheta;
            let needsCorrection = false;
            
            // Calculate distance outside boundaries for smooth ramping
            if (state.x < minX) {
                distOut = Math.max(distOut, minX - state.x);
                needsCorrection = true;
            } else if (state.x > maxX) {
                distOut = Math.max(distOut, state.x - maxX);
                needsCorrection = true;
            }

            if (state.y < minY) {
                distOut = Math.max(distOut, minY - state.y);
                needsCorrection = true;
            } else if (state.y > maxY) {
                distOut = Math.max(distOut, state.y - maxY);
                needsCorrection = true;
            }

            if (needsCorrection) {
                const centerX = this.width / 2;
                const centerY = this.height / 2;
                targetAngle = Math.atan2(centerY - (state.y + state.size/2), centerX - (state.x + state.size/2));

                // Ramping Function:
                // Smoothly increase strength as orb goes further out.
                // 0px out -> 0 strength (No jitter at edge)
                // 200px out -> 1.0 strength (Full return mode)
                const ramp = Math.min(distOut / 200, 1.0);

                // Smoothly steer towards center
                let diff = targetAngle - state.wanderTheta;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;

                // Turn rate scales with depth
                const turnRate = 0.02 + (ramp * 0.1); 
                state.wanderTheta += diff * turnRate;

                // ACCELERATION BOOST scales with depth
                // No boost right at the edge, only when deep out
                const boost = ramp * 0.05;
                state.vx += Math.cos(state.wanderTheta) * boost;
                state.vy += Math.sin(state.wanderTheta) * boost;
            }

            // 6. Apply to DOM (Both layers)
            const baseTransform = `translate3d(${state.x}px, ${state.y}px, 0)`;

            let scale = 1.0;
            if (!edgeMode) {
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
