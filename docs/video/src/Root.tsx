import { Composition } from "remotion";
import { IntroVideo } from "./IntroVideo";

const FPS = 30;
const DURATION_SECONDS = 84; // ~82.1s of scenes

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="IntroVideo"
      component={IntroVideo}
      durationInFrames={FPS * DURATION_SECONDS}
      fps={FPS}
      width={1280}
      height={720}
    />
  );
};
