import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { Scene } from "./scenes";

/** Animated red underline span. Width grows from 0% to 100%. */
const EmphasisSpan: React.FC<{ children: React.ReactNode; delay: number }> = ({ children, delay }) => {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [delay, delay + 10], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <span style={{ position: "relative", display: "inline" }}>
      {children}
      <span
        style={{
          position: "absolute",
          left: 0,
          bottom: -2,
          height: 4,
          borderRadius: 2,
          background: "#ef4444",
          width: `${width}%`,
        }}
      />
    </span>
  );
};

/** Render text with optional emphasis (animated red underline on matching substrings). */
const renderTextWithEmphasis = (text: string, emphasis?: string | string[]): React.ReactNode => {
  if (!emphasis) return text;
  const words = Array.isArray(emphasis) ? emphasis : [emphasis];

  // Build segments: split text by emphasis words, preserving order
  const segments: { text: string; emphasisIndex: number }[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let earliest = -1;
    let earliestPos = remaining.length;
    for (let i = 0; i < words.length; i++) {
      const pos = remaining.indexOf(words[i]);
      if (pos !== -1 && pos < earliestPos) {
        earliestPos = pos;
        earliest = i;
      }
    }
    if (earliest === -1) {
      segments.push({ text: remaining, emphasisIndex: -1 });
      break;
    }
    if (earliestPos > 0) {
      segments.push({ text: remaining.slice(0, earliestPos), emphasisIndex: -1 });
    }
    segments.push({ text: words[earliest], emphasisIndex: earliest });
    remaining = remaining.slice(earliestPos + words[earliest].length);
  }

  return (
    <>
      {segments.map((seg, i) =>
        seg.emphasisIndex >= 0 ? (
          <EmphasisSpan key={i} delay={6 + seg.emphasisIndex * 8}>
            {seg.text}
          </EmphasisSpan>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        ),
      )}
    </>
  );
};

const bgColors: Record<Scene["bg"], string> = {
  dark: "#1a1a2e",
  white: "#ffffff",
  gray: "#f3f4f6",
  blue: "#1d4ed8",
  purple: "#7c3aed",
  green: "#16a34a",
};

const textColors: Record<Scene["bg"], string> = {
  dark: "#ffffff",
  white: "#1f2937",
  gray: "#1f2937",
  blue: "#ffffff",
  purple: "#ffffff",
  green: "#ffffff",
};

const textSizes: Record<NonNullable<Scene["textSize"]>, number> = {
  xl: 72,
  lg: 56,
  md: 44,
  sm: 36,
};

// Sparkle star shapes for the click animation
const SPARKLES = [
  { dx: -18, dy: -22, delay: 0, size: 14 },
  { dx: 22, dy: -18, delay: 2, size: 10 },
  { dx: -25, dy: 10, delay: 4, size: 12 },
  { dx: 18, dy: 20, delay: 1, size: 11 },
  { dx: 0, dy: -28, delay: 3, size: 13 },
  { dx: 28, dy: 5, delay: 5, size: 9 },
  { dx: -10, dy: 25, delay: 2, size: 10 },
  { dx: 30, dy: -8, delay: 4, size: 8 },
];

const Star: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 0l3 9h9l-7.5 5.5L19.5 24 12 18l-7.5 6 3-9.5L0 9h9z" />
  </svg>
);

const HighlightOverlay: React.FC<{
  h: { x: number; y: number; w: number; h: number };
  style: "redBorder" | "sparkleClick";
  opacity: number;
  frame: number;
  contentDelay: number;
}> = ({ h, style, opacity, frame, contentDelay }) => {
  if (style === "sparkleClick") {
    // Click animation timing (relative to content appearance)
    const clickFrame = contentDelay + 12; // click happens shortly after content appears
    const clickProgress = interpolate(frame, [clickFrame, clickFrame + 6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // Cursor position: moves to center of highlight area
    const cursorTargetX = h.x + h.w / 2;
    const cursorTargetY = h.y + h.h / 2;
    const cursorStartX = h.x + h.w / 2 + 15;
    const cursorStartY = h.y - 15;
    const cursorX = interpolate(frame, [contentDelay + 4, clickFrame], [cursorStartX, cursorTargetX], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const cursorY = interpolate(frame, [contentDelay + 4, clickFrame], [cursorStartY, cursorTargetY], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const cursorOpacity = interpolate(frame, [contentDelay + 2, contentDelay + 6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // Click press scale
    const cursorScale = frame >= clickFrame && frame < clickFrame + 3
      ? interpolate(frame, [clickFrame, clickFrame + 3], [1, 0.85], { extrapolateRight: "clamp" })
      : frame >= clickFrame + 3 && frame < clickFrame + 6
        ? interpolate(frame, [clickFrame + 3, clickFrame + 6], [0.85, 1], { extrapolateRight: "clamp" })
        : 1;

    // Glow pulse after click
    const glowOpacity = interpolate(frame, [clickFrame + 3, clickFrame + 8, clickFrame + 20], [0, 0.8, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const glowScale = interpolate(frame, [clickFrame + 3, clickFrame + 15], [0.8, 1.6], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // Ripple after click
    const rippleOpacity = interpolate(frame, [clickFrame + 4, clickFrame + 18], [0.6, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const rippleScale = interpolate(frame, [clickFrame + 4, clickFrame + 18], [0.5, 2.5], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return (
      <>
        {/* Glow behind button */}
        <div
          style={{
            position: "absolute",
            top: `${h.y + h.h / 2}%`,
            left: `${h.x + h.w / 2}%`,
            width: `${h.w * 1.5}%`,
            height: `${h.h * 2}%`,
            transform: `translate(-50%, -50%) scale(${glowScale})`,
            background: "radial-gradient(ellipse, rgba(250,204,21,0.7) 0%, rgba(250,204,21,0) 70%)",
            opacity: glowOpacity,
            pointerEvents: "none",
          }}
        />

        {/* Ripple ring */}
        <div
          style={{
            position: "absolute",
            top: `${cursorTargetY}%`,
            left: `${cursorTargetX}%`,
            width: 40,
            height: 40,
            transform: `translate(-50%, -50%) scale(${rippleScale})`,
            border: "2px solid rgba(250,204,21,0.8)",
            borderRadius: "50%",
            opacity: rippleOpacity,
            pointerEvents: "none",
          }}
        />

        {/* Sparkle particles */}
        {SPARKLES.map((s, i) => {
          const sparkleStart = clickFrame + 4 + s.delay;
          const sparkleOpacity = interpolate(frame, [sparkleStart, sparkleStart + 4, sparkleStart + 14], [0, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const sparkleScale = interpolate(frame, [sparkleStart, sparkleStart + 6, sparkleStart + 14], [0.3, 1.2, 0.5], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const sparkleY = interpolate(frame, [sparkleStart, sparkleStart + 14], [0, s.dy * 0.5], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const sparkleRotation = interpolate(frame, [sparkleStart, sparkleStart + 14], [0, 45 + i * 20], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: `${cursorTargetY}%`,
                left: `${cursorTargetX}%`,
                transform: `translate(calc(-50% + ${s.dx}px), calc(-50% + ${s.dy + sparkleY}px)) scale(${sparkleScale}) rotate(${sparkleRotation}deg)`,
                opacity: sparkleOpacity,
                pointerEvents: "none",
              }}
            >
              <Star size={s.size} color="#facc15" />
            </div>
          );
        })}

        {/* Cursor pointer */}
        <div
          style={{
            position: "absolute",
            top: `${cursorY}%`,
            left: `${cursorX}%`,
            transform: `translate(-4px, -2px) scale(${cursorScale})`,
            opacity: cursorOpacity,
            pointerEvents: "none",
            fontSize: 28,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
          }}
        >
          👆
        </div>
      </>
    );
  }

  // Default: red border highlight
  return (
    <>
      {/* Semi-transparent overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.35)",
          borderRadius: 8,
          clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${h.y}%, ${h.x}% ${h.y}%, ${h.x}% ${h.y + h.h}%, ${h.x + h.w}% ${h.y + h.h}%, ${h.x + h.w}% ${h.y}%, 0% ${h.y}%)`,
          opacity,
        }}
      />
      {/* Red border */}
      <div
        style={{
          position: "absolute",
          top: `${h.y}%`,
          left: `${h.x}%`,
          width: `${h.w}%`,
          height: `${h.h}%`,
          border: "3px solid #ef4444",
          borderRadius: 6,
          boxShadow: "0 0 12px rgba(239,68,68,0.5)",
          opacity,
        }}
      />
    </>
  );
};

export const SceneRenderer: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const fontSize = textSizes[scene.textSize ?? "md"];
  const bg = bgColors[scene.bg];
  const color = textColors[scene.bg];

  const isDelayedFadeIn = scene.enterAnimation === "delayedFadeIn";
  const contentStart = isDelayedFadeIn ? 45 : 0;
  const popIn = interpolate(frame, [contentStart, contentStart + 4], [0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeIn = interpolate(frame, [contentStart, contentStart + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  if (scene.layout === "splitHighlight" && scene.image && scene.highlight) {
    const h = scene.highlight;
    const hasShrinkAnim = scene.enterAnimation === "shrinkFromFull";
    const hasDelayedEntry = scene.enterAnimation === "delayedFadeIn";

    // Animation phases (at 30fps):
    // Phase 1: fade-in + hold (0–45 frames / 0–1.5s) — simultaneous with section title slide
    // Phase 2: shrink transition (45–75 frames / 1.5–2.5s)
    // Phase 3: normal splitHighlight (75+ frames)
    const shrinkStart = hasShrinkAnim ? 45 : 0;
    const shrinkEnd = hasShrinkAnim ? 75 : 0;

    // Image positions (1280x720 viewport, 16:9 source)
    // Full-screen: 1152x648, centered at (640, 360)
    // Split left pane: ~694x390, centered at (~371, 360)
    const fullW = 1152, fullH = 648;
    const fullX = (1280 - fullW) / 2; // 64
    const fullY = (720 - fullH) / 2;  // 36
    const splitW = 694, splitH = 390;
    const splitPaneW = 1280 * 0.58; // 742.4
    const splitX = (splitPaneW - splitW) / 2; // ~24
    const splitY = (720 - splitH) / 2;        // 165

    const shrinkProgress = hasShrinkAnim
      ? interpolate(frame, [shrinkStart, shrinkEnd], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

    const isAnimating = hasShrinkAnim && frame < shrinkEnd;

    // Interpolate image rect during shrink
    const imgW = interpolate(shrinkProgress, [0, 1], [fullW, splitW]);
    const imgH = interpolate(shrinkProgress, [0, 1], [fullH, splitH]);
    const imgX = interpolate(shrinkProgress, [0, 1], [fullX, splitX]);
    const imgY = interpolate(shrinkProgress, [0, 1], [fullY, splitY]);
    const imgRadius = interpolate(shrinkProgress, [0, 1], [12, 8]);

    // Right panel + highlight fade in after shrink or delayed entry
    const contentDelay = hasShrinkAnim ? shrinkEnd : hasDelayedEntry ? 45 : 0;
    const contentFade = interpolate(frame, [contentDelay, contentDelay + 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    // Highlight appears slightly after the panel
    const highlightFade = interpolate(frame, [contentDelay + 4, contentDelay + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // Full-screen image fade-in
    const entryFade = hasShrinkAnim
      ? interpolate(frame, [18, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : hasDelayedEntry
        ? interpolate(frame, [45, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        : fadeIn;

    if (isAnimating) {
      // During animation: render image at interpolated absolute position
      return (
        <AbsoluteFill style={{ backgroundColor: bg }}>
          <Img
            src={staticFile(scene.image)}
            style={{
              position: "absolute",
              left: imgX,
              top: imgY,
              width: imgW,
              height: imgH,
              objectFit: "contain",
              borderRadius: imgRadius,
              boxShadow: frame < shrinkStart
                ? "0 8px 32px rgba(0,0,0,0.2)"
                : `0 ${interpolate(shrinkProgress, [0, 1], [8, 4])}px ${interpolate(shrinkProgress, [0, 1], [32, 20])}px rgba(0,0,0,${interpolate(shrinkProgress, [0, 1], [0.2, 0.12])})`,
              opacity: entryFade,
            }}
          />
        </AbsoluteFill>
      );
    }

    // Phase 3: normal splitHighlight layout
    const layoutFade = hasDelayedEntry ? contentFade : 1;
    return (
      <AbsoluteFill style={{ backgroundColor: bg, display: "flex", flexDirection: "row" }}>
        {/* Left: screenshot with highlight */}
        <div
          style={{
            width: "58%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
            opacity: layoutFade,
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
            }}
          >
            <Img
              src={staticFile(scene.image)}
              style={{
                maxWidth: "100%",
                maxHeight: 672,
                objectFit: "contain",
                borderRadius: 8,
                boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              }}
            />
            {/* Highlight overlay */}
            <HighlightOverlay h={h} style={scene.highlightStyle ?? "redBorder"} opacity={highlightFade} frame={frame} contentDelay={contentDelay} />
          </div>
        </div>
        {/* Right: description */}
        <div
          style={{
            width: "42%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "40px 40px 40px 0",
            opacity: contentFade,
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color,
              lineHeight: 1.3,
              marginBottom: 16,
            }}
          >
            {scene.text}
          </div>
          {scene.sub && (
            <div
              style={{
                fontSize: 28,
                fontWeight: 500,
                color,
                opacity: 0.7,
                lineHeight: 1.5,
              }}
            >
              {scene.sub}
            </div>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  if (scene.layout === "titleReveal" && scene.image) {
    const { fps } = useVideoConfig();
    const slideStart = fps * 1;
    const slideEnd = fps * 1.5;
    const imgStart = fps * 1.2;
    const imgEnd = fps * 2;

    const textY = interpolate(frame, [slideStart, slideEnd], [310, 40], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    const textScale = interpolate(frame, [slideStart, slideEnd], [1, 0.6], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    const imgOpacity = interpolate(frame, [imgStart, imgEnd], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    const imgScale = interpolate(frame, [imgStart, imgEnd], [0.95, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return (
      <AbsoluteFill style={{ backgroundColor: bg }}>
        <div
          style={{
            position: "absolute",
            top: textY,
            width: "100%",
            textAlign: "center",
            transform: `scale(${textScale})`,
            opacity: fadeIn,
          }}
        >
          <div
            style={{
              fontSize,
              fontWeight: 800,
              color,
              letterSpacing: "-0.02em",
            }}
          >
            {scene.text}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            top: 120,
            left: 40,
            right: 40,
            bottom: 40,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            opacity: imgOpacity,
            transform: `scale(${imgScale})`,
          }}
        >
          <Img
            src={staticFile(scene.image)}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            }}
          />
        </div>
      </AbsoluteFill>
    );
  }

  if (scene.layout === "splitPane") {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: bg,
          justifyContent: "center",
          alignItems: "center",
          padding: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 64,
            transform: `scale(${popIn})`,
            opacity: fadeIn,
          }}
        >
          {/* Left pane */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            {scene.icon && <div style={{ fontSize: 80, lineHeight: 1 }}>{scene.icon}</div>}
            <div
              style={{
                fontSize: fontSize * 0.8,
                fontWeight: 700,
                color,
                textAlign: "center",
                lineHeight: 1.4,
                whiteSpace: "pre-line",
              }}
            >
              {scene.text}
            </div>
          </div>
          {/* Divider */}
          <div style={{ width: 2, backgroundColor: color, opacity: 0.2, borderRadius: 1 }} />
          {/* Right pane */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            {scene.icon2 && <div style={{ fontSize: 80, lineHeight: 1 }}>{scene.icon2}</div>}
            <div
              style={{
                fontSize: fontSize * 0.8,
                fontWeight: 700,
                color,
                textAlign: "center",
                lineHeight: 1.4,
                whiteSpace: "pre-line",
              }}
            >
              {scene.sub}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (scene.video) {
    const { fps } = useVideoConfig();
    const videoStartFromFrames = Math.round((scene.videoStartFrom ?? 0) * fps);

    return (
      <AbsoluteFill style={{ backgroundColor: bg }}>
        {/* Left: video */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "58%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <OffthreadVideo
            src={staticFile(scene.video)}
            startFrom={videoStartFromFrames}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              opacity: fadeIn,
            }}
          />
        </div>
        {/* Right: text */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "42%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "40px 40px 40px 0",
            opacity: fadeIn,
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color,
              lineHeight: 1.3,
              whiteSpace: "pre-line",
            }}
          >
            {scene.text}
          </div>
          {scene.sub && (
            <div
              style={{
                fontSize: 28,
                fontWeight: 500,
                color,
                opacity: 0.7,
                lineHeight: 1.5,
                marginTop: 16,
              }}
            >
              {scene.sub}
            </div>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  if (scene.image && scene.icon == null) {
    const isAvatar = scene.text && !scene.image.startsWith("screenshots/");
    if (isAvatar) {
      return (
        <AbsoluteFill
          style={{
            backgroundColor: bg,
            justifyContent: "center",
            alignItems: "center",
            padding: 80,
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
              transform: `scale(${popIn})`,
              opacity: fadeIn,
            }}
          >
            {/* Callout positioned relative to content — above-left */}
            {scene.callout && (() => {
              const calloutDelay = 12;
              const calloutScale = interpolate(frame, [calloutDelay, calloutDelay + 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const calloutOpacity = interpolate(frame, [calloutDelay, calloutDelay + 4], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const calloutBounce = interpolate(frame, [calloutDelay + 6, calloutDelay + 10], [1, 1.05], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }) * interpolate(frame, [calloutDelay + 10, calloutDelay + 14], [1, 1 / 1.05], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    transform: `translate(-35%, -80%) rotate(-12deg) scale(${calloutScale * calloutBounce})`,
                    transformOrigin: "center center",
                    opacity: calloutOpacity,
                    fontSize: 32,
                    fontWeight: 800,
                    color: "#fbbf24",
                    textShadow: "0 2px 8px rgba(0,0,0,0.4), 0 0 20px rgba(251,191,36,0.3)",
                    whiteSpace: "nowrap",
                    letterSpacing: "0.05em",
                    pointerEvents: "none",
                  }}
                >
                  {scene.callout}
                </div>
              );
            })()}
            <div
              style={{
                fontSize: fontSize * 0.6,
                fontWeight: 500,
                color,
                opacity: 0.8,
                textAlign: "center",
              }}
            >
              {scene.text}
            </div>
            <Img
              src={staticFile(scene.image)}
              style={{
                width: 160,
                height: 160,
                borderRadius: "50%",
                objectFit: "cover",
                boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
              }}
            />
            {scene.sub && (
              <div
                style={{
                  textAlign: "center",
                  whiteSpace: "pre-line",
                  lineHeight: 1.5,
                  color,
                }}
              >
                {scene.sub.split("\n").map((line, i, arr) => (
                  <div
                    key={i}
                    style={{
                      fontSize: i === arr.length - 1 ? fontSize : fontSize * 0.5,
                      fontWeight: i === arr.length - 1 ? 800 : 500,
                      opacity: i === arr.length - 1 ? 1 : 0.7,
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}
            {scene.footnote && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: fontSize * 0.35,
                  fontWeight: 400,
                  color,
                  opacity: 0.5,
                  textAlign: "center",
                }}
              >
                {scene.footnote}
              </div>
            )}
          </div>
        </AbsoluteFill>
      );
    }

    return (
      <AbsoluteFill style={{ backgroundColor: bg, justifyContent: "center", alignItems: "center" }}>
        <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Img
            src={staticFile(scene.image)}
            style={{
              maxWidth: "90vw",
              maxHeight: scene.sub || scene.text ? "75vh" : "90vh",
              objectFit: "contain",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              transform: `scale(${popIn})`,
              opacity: fadeIn,
            }}
          />
          {scene.highlight && (
            <HighlightOverlay
              h={scene.highlight}
              style={scene.highlightStyle ?? "redBorder"}
              opacity={fadeIn}
              frame={frame}
              contentDelay={0}
            />
          )}
        </div>
        {(scene.text || scene.sub) && (
          <div
            style={{
              position: "absolute",
              bottom: 40,
              width: "100%",
              textAlign: "center",
              color,
              opacity: fadeIn,
            }}
          >
            {scene.text && (
              <div style={{ fontSize: 36, fontWeight: 700, textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                {scene.text}
              </div>
            )}
            {scene.sub && (
              <div style={{ fontSize: 24, marginTop: 8, opacity: 0.8 }}>
                {scene.sub}
              </div>
            )}
          </div>
        )}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          transform: `scale(${popIn})`,
          opacity: fadeIn,
        }}
      >
        {scene.icon && (
          <div style={{ fontSize: 80, lineHeight: 1 }}>{scene.icon}</div>
        )}
        <div
          style={{
            fontSize,
            fontWeight: 800,
            color,
            textAlign: "center",
            lineHeight: 1.3,
            whiteSpace: "pre-line",
            letterSpacing: "-0.02em",
          }}
        >
          {renderTextWithEmphasis(scene.text, scene.emphasis)}
        </div>
        {scene.sub && (
          <div
            style={{
              fontSize: fontSize * 0.5,
              fontWeight: 500,
              color,
              opacity: 0.7,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            {scene.sub}
          </div>
        )}
      </div>

      {/* Diagonal callout (manga-style) — positioned above-left of center content */}
      {scene.callout && (() => {
        const calloutDelay = 12;
        const calloutScale = interpolate(frame, [calloutDelay, calloutDelay + 6], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const calloutOpacity = interpolate(frame, [calloutDelay, calloutDelay + 4], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const calloutBounce = interpolate(frame, [calloutDelay + 6, calloutDelay + 10], [1, 1.05], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }) * interpolate(frame, [calloutDelay + 10, calloutDelay + 14], [1, 1 / 1.05], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            style={{
              position: "absolute",
              top: "22%",
              left: "18%",
              transform: `rotate(-12deg) scale(${calloutScale * calloutBounce})`,
              transformOrigin: "center center",
              opacity: calloutOpacity,
              fontSize: 36,
              fontWeight: 800,
              color: "#fbbf24",
              textShadow: "0 2px 8px rgba(0,0,0,0.4), 0 0 20px rgba(251,191,36,0.3)",
              whiteSpace: "nowrap",
              letterSpacing: "0.05em",
              pointerEvents: "none",
            }}
          >
            {scene.callout}
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};
