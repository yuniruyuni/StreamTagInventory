import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { scenes } from "./scenes";
import { SceneRenderer } from "./SceneRenderer";
import { TRANSITION_FRAMES, transitionMap } from "./transitions";

const CROSSFADE_FRAMES = 10; // ~0.33s overlap for cross-fade transitions

// Collect sections from sectionTitle markers in scenes.
// Each section runs from its start scene until the next scene with sectionTitle.
const sectionDefs: { label: string; startIndex: number; endIndex: number }[] = [];
for (let i = 0; i < scenes.length; i++) {
  if (scenes[i].sectionTitle) {
    // Find end: next scene with sectionTitle, or end of scenes
    let endIndex = scenes.length;
    for (let j = i + 1; j < scenes.length; j++) {
      if (scenes[j].sectionTitle) {
        endIndex = j;
        break;
      }
    }
    sectionDefs.push({ label: scenes[i].sectionTitle!, startIndex: i, endIndex });
  }
}

const SceneWithTransition: React.FC<{
  scene: (typeof scenes)[number];
}> = ({ scene }) => {
  const frame = useCurrentFrame();
  const transition = scene.transition ?? "cut";

  // Cross-fade: simple opacity ramp over the overlap period
  if (transition === "crossfade") {
    const opacity = interpolate(frame, [0, CROSSFADE_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <AbsoluteFill style={{ opacity }}>
        <SceneRenderer scene={scene} />
      </AbsoluteFill>
    );
  }

  const isFirst = transition === "cut";
  const enterProgress = isFirst
    ? 1
    : interpolate(frame, [0, TRANSITION_FRAMES], [0, 1], {
        extrapolateRight: "clamp",
      });

  const content = (
    <AbsoluteFill>
      <SceneRenderer scene={scene} />
    </AbsoluteFill>
  );

  const TransitionComponent = transitionMap[transition];
  if (isFirst || !TransitionComponent) {
    return content;
  }

  return <TransitionComponent progress={enterProgress}>{content}</TransitionComponent>;
};

/**
 * Persistent section title: center text fades in/out, then small label fades in at top-left.
 *
 * Phase 1 (0–10f):   fade-in large text at center
 * Phase 2 (10–35f):  hold at center
 * Phase 3 (35–45f):  fade-out center text
 * Phase 4 (45–55f):  fade-in small label at top-left
 * Phase 5 (55f–):    small label stays
 */
const TITLE_FADE_IN_END = 10;
const TITLE_HOLD_END = 35;
const TITLE_FADE_OUT_END = 45;
const LABEL_FADE_IN_END = 55;

const PersistentSectionTitle: React.FC<{ label: string }> = ({ label }) => {
  const frame = useCurrentFrame();

  // Center text: fade in → hold → fade out
  const centerOpacity = frame < TITLE_HOLD_END
    ? interpolate(frame, [0, TITLE_FADE_IN_END], [0, 1], { extrapolateRight: "clamp" })
    : interpolate(frame, [TITLE_HOLD_END, TITLE_FADE_OUT_END], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Top-left label: fade in after center disappears
  const labelOpacity = interpolate(frame, [TITLE_FADE_OUT_END, LABEL_FADE_IN_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Underline animation: grows from center after text fades in
  const underlineWidth = interpolate(frame, [TITLE_FADE_IN_END, TITLE_FADE_IN_END + 10], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      {/* Large centered title with underline accent */}
      {centerOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 640,
            top: 330,
            transform: "translate(-50%, -50%)",
            opacity: centerOpacity,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "#1f2937",
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
              textShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            {label}
          </span>
          {/* Underline accent */}
          <div
            style={{
              marginTop: 8,
              height: 4,
              borderRadius: 2,
              background: "#1d4ed8",
              width: `${underlineWidth}%`,
            }}
          />
        </div>
      )}
      {/* Small top-left badge label */}
      {labelOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 20,
            top: 16,
            opacity: labelOpacity,
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              background: "#1d4ed8",
              padding: "4px 14px",
              borderRadius: 6,
            }}
          >
            {label}
          </span>
        </div>
      )}
    </>
  );
};

export const IntroVideo: React.FC = () => {
  const { fps } = useVideoConfig();

  // Build scene frame map; crossfade scenes start earlier to overlap
  const sceneFrames: { startFrame: number; durationFrames: number }[] = [];
  let currentFrame = 0;
  for (const scene of scenes) {
    const dur = Math.round(scene.durationSec * fps);
    const overlap = scene.transition === "crossfade" ? CROSSFADE_FRAMES : 0;
    sceneFrames.push({
      startFrame: currentFrame - overlap,
      durationFrames: dur + overlap,
    });
    currentFrame += dur;
  }

  const totalFrames = currentFrame;

  // Compute section overlay frame ranges
  const sectionOverlays = sectionDefs.map(({ label, startIndex, endIndex }) => {
    const startFrame = sceneFrames[startIndex].startFrame;
    const endFrame = endIndex < scenes.length
      ? sceneFrames[endIndex].startFrame
      : totalFrames;
    return { label, startFrame, duration: endFrame - startFrame };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {scenes.map((scene, i) => {
        const { startFrame, durationFrames } = sceneFrames[i];
        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationFrames}>
            <SceneWithTransition scene={scene} />
          </Sequence>
        );
      })}

      {/* Persistent section title overlays */}
      {sectionOverlays.map(({ label, startFrame, duration }) => (
        <Sequence key={label} from={startFrame} durationInFrames={duration}>
          <PersistentSectionTitle label={label} />
        </Sequence>
      ))}

    </AbsoluteFill>
  );
};
