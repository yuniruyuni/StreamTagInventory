import { AbsoluteFill, Img, staticFile } from "remotion";
import type { SlideConfig } from "./slides";

export const Slide: React.FC<{ slide: SlideConfig }> = ({ slide }) => {
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(slide.src.replace("../slides/", "slides/"))}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
};
