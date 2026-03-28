import type React from "react";
import { AbsoluteFill, interpolate } from "remotion";

const TRANSITION_FRAMES = 6; // ~0.2s at 30fps — snappy

interface TransitionProps {
  children: React.ReactNode;
  progress: number; // 0 to 1
}

const PushTransition: React.FC<TransitionProps> = ({ children, progress }) => (
  <AbsoluteFill style={{ transform: `translateX(${(1 - progress) * 100}%)` }}>
    {children}
  </AbsoluteFill>
);

const FlashTransition: React.FC<TransitionProps> = ({ children, progress }) => (
  <>
    <AbsoluteFill style={{ opacity: progress }}>{children}</AbsoluteFill>
    <AbsoluteFill
      style={{
        backgroundColor: "white",
        opacity: progress < 0.5 ? 1 - progress * 2 : 0,
        pointerEvents: "none",
      }}
    />
  </>
);

const ZoomTransition: React.FC<TransitionProps> = ({ children, progress }) => (
  <AbsoluteFill
    style={{
      transform: `scale(${interpolate(progress, [0, 1], [1.3, 1])})`,
      opacity: progress,
    }}
  >
    {children}
  </AbsoluteFill>
);

const WhipTransition: React.FC<TransitionProps> = ({ children, progress }) => (
  <AbsoluteFill
    style={{
      transform: `translateX(${(1 - progress) * -120}%) skewX(${(1 - progress) * -15}deg)`,
      opacity: progress,
    }}
  >
    {children}
  </AbsoluteFill>
);

const GlitchTransition: React.FC<TransitionProps> = ({
  children,
  progress,
}) => (
  <>
    <AbsoluteFill
      style={{
        transform:
          progress < 0.5
            ? `translateX(${Math.sin(progress * 40) * 20}px)`
            : "none",
        opacity: progress,
      }}
    >
      {children}
    </AbsoluteFill>
    {progress < 0.5 && (
      <AbsoluteFill
        style={{
          backgroundColor: "#1d4ed8",
          opacity: 0.3 * (1 - progress * 2),
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
    )}
  </>
);

const FlipTransition: React.FC<TransitionProps> = ({ children, progress }) => (
  <AbsoluteFill
    style={{
      transform: `perspective(1200px) rotateY(${(1 - progress) * 90}deg)`,
      opacity: progress,
    }}
  >
    {children}
  </AbsoluteFill>
);

const GlowTransition: React.FC<TransitionProps> = ({ children, progress }) => (
  <>
    <AbsoluteFill style={{ opacity: progress }}>{children}</AbsoluteFill>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle, rgba(157,71,255,0.6) 0%, transparent 70%)",
        opacity: progress < 0.5 ? progress * 2 : (1 - progress) * 2,
        pointerEvents: "none",
      }}
    />
  </>
);

const WipeTransition: React.FC<TransitionProps> = ({ children, progress }) => (
  <AbsoluteFill style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}>
    {children}
  </AbsoluteFill>
);

const transitionMap: Record<string, React.FC<TransitionProps>> = {
  push: PushTransition,
  flash: FlashTransition,
  zoom: ZoomTransition,
  whip: WhipTransition,
  glitch: GlitchTransition,
  flip: FlipTransition,
  glow: GlowTransition,
  wipe: WipeTransition,
};

export type { TransitionProps };
export { TRANSITION_FRAMES, transitionMap };
