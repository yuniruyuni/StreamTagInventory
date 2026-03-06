export interface SlideConfig {
  src: string;
  durationSec: number;
  transition:
    | "cut"
    | "push"
    | "flash"
    | "zoom"
    | "whip"
    | "glitch"
    | "flip"
    | "glow"
    | "wipe";
}

export const slides: SlideConfig[] = [
  { src: "slides/slide-01.png", durationSec: 20, transition: "cut" },
  { src: "slides/slide-02.png", durationSec: 20, transition: "push" },
  { src: "slides/slide-03.png", durationSec: 30, transition: "flash" },
  { src: "slides/slide-04.png", durationSec: 25, transition: "zoom" },
  { src: "slides/slide-05.png", durationSec: 35, transition: "push" },
  { src: "slides/slide-06.png", durationSec: 25, transition: "whip" },
  { src: "slides/slide-07.png", durationSec: 25, transition: "zoom" },
  { src: "slides/slide-08.png", durationSec: 30, transition: "whip" },
  { src: "slides/slide-09.png", durationSec: 17, transition: "push" },
  { src: "slides/slide-10.png", durationSec: 17, transition: "glitch" },
  { src: "slides/slide-11.png", durationSec: 16, transition: "flip" },
  { src: "slides/slide-12.png", durationSec: 40, transition: "glow" },
];
