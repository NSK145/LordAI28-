import { useEffect, useState } from "react";

/**
 * ParticleField - Animated background particle effect
 */
export function ParticleField() {
  const [particles, setParticles] = useState<
    Array<{ id: number; x: number; y: number; vx: number; vy: number }>
  >([]);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    const count = reduced ? 0 : coarse ? 6 : 12;
    // Initialize particles
    const initialParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
    }));
    setParticles(initialParticles);

    // Animation loop
    if (reduced) return;
    const interval = setInterval(() => {
      setParticles((prev) =>
        prev.map((p) => ({
          ...p,
          x: (p.x + p.vx + 100) % 100,
          y: (p.y + p.vy + 100) % 100,
        })),
      );
    }, 80);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <svg className="w-full h-full">
        {particles.map((p) => (
          <circle
            key={p.id}
            cx={`${p.x}%`}
            cy={`${p.y}%`}
            r="0.5"
            fill="var(--hud)"
            opacity="0.055"
          />
        ))}
      </svg>
    </div>
  );
}
