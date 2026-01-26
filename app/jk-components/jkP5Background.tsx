'use client'

import { useEffect, useRef, useState } from 'react';

export default function JkP5Background() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sketchRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || sketchRef.current || isLoaded) return;

    // Dynamically import p5 only on client side
    import('p5').then((p5Module) => {
      const p5 = p5Module.default;
      
      const sketch = (p: any) => {
      const particles: Array<{
        x: number;
        y: number;
        vx: number;
        vy: number;
        size: number;
        opacity: number;
      }> = [];
      
      const numParticles = 60;
      const connectionDistance = 180;

      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.noStroke();
        
        // Create particles
        for (let i = 0; i < numParticles; i++) {
          particles.push({
            x: p.random(p.width),
            y: p.random(p.height),
            vx: p.random(-0.3, 0.3),
            vy: p.random(-0.3, 0.3),
            size: p.random(1.5, 3),
            opacity: p.random(0.03, 0.06)
          });
        }
      };

      p.draw = () => {
        p.clear();
        
        // Update and draw particles
        for (let i = 0; i < particles.length; i++) {
          const particle = particles[i];
          
          // Update position
          particle.x += particle.vx;
          particle.y += particle.vy;
          
          // Wrap around edges
          if (particle.x < 0) particle.x = p.width;
          if (particle.x > p.width) particle.x = 0;
          if (particle.y < 0) particle.y = p.height;
          if (particle.y > p.height) particle.y = 0;
          
          // Draw particle
          p.fill(0, 0, 0, particle.opacity * 255);
          p.noStroke();
          p.circle(particle.x, particle.y, particle.size);
          
          // Draw connections
          for (let j = i + 1; j < particles.length; j++) {
            const other = particles[j];
            const distance = p.dist(particle.x, particle.y, other.x, other.y);
            
            if (distance < connectionDistance) {
              const opacity = p.map(distance, 0, connectionDistance, 0.12, 0);
              p.stroke(0, 0, 0, opacity * 255);
              p.strokeWeight(0.5);
              p.line(particle.x, particle.y, other.x, other.y);
            }
          }
        }
        p.noStroke();
      };

        p.windowResized = () => {
          p.resizeCanvas(p.windowWidth, p.windowHeight);
        };
      };

      sketchRef.current = new p5(sketch, containerRef.current);
      setIsLoaded(true);
    }).catch((err) => {
      console.error('Failed to load p5:', err);
    });

    return () => {
      if (sketchRef.current) {
        sketchRef.current.remove();
        sketchRef.current = null;
        setIsLoaded(false);
      }
    };
  }, [isLoaded]);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ opacity: 0.35 }}
    />
  );
}

