import hl from "./highlights.json";

export interface Scene {
  id?: string; // optional identifier for programmatic lookup
  text: string;
  sub?: string;
  bg: "dark" | "white" | "gray" | "blue" | "purple" | "green";
  durationSec: number;
  image?: string; // staticFile path
  video?: string; // staticFile path for video
  videoStartFrom?: number; // seconds to skip from video start
  icon?: string; // emoji or symbol
  icon2?: string; // second icon for splitPane layout
  callout?: string; // diagonal callout text (e.g. "＼ 無料です ／")
  footnote?: string; // small text displayed below content (e.g. URL)
  transition?: "cut" | "push" | "flash" | "zoom" | "whip" | "glitch" | "flip" | "glow" | "crossfade";
  textSize?: "xl" | "lg" | "md" | "sm";
  layout?: "titleReveal" | "splitHighlight" | "splitPane";
  highlight?: { x: number; y: number; w: number; h: number }; // percent-based rect for splitHighlight
  highlightStyle?: "redBorder" | "sparkleClick"; // default: redBorder
  enterAnimation?: "shrinkFromFull" | "delayedFadeIn"; // content entrance style
  emphasis?: string | string[]; // text(s) to highlight with animated red underline
  sectionTitle?: string; // starts a persistent section title overlay (continues until next sectionTitle)
}

export const scenes: Scene[] = [
  // === Section 0: Opening Hook ===
  { text: "配信前のよくある作業…", bg: "dark", durationSec: 1.5, textSize: "xl", transition: "cut" },
  { text: "毎回こんなこと\nしていませんか？", bg: "dark", durationSec: 1.5, textSize: "lg", transition: "push" },
  { text: "タイトルを毎回手入力…", bg: "dark", durationSec: 1.2, icon: "⌨️", transition: "whip" },
  { text: "カテゴリを検索して設定…", bg: "dark", durationSec: 1.2, icon: "🔍", transition: "whip" },
  { text: "タグを一つずつ追加…", bg: "dark", durationSec: 1.2, icon: "🏷️", transition: "whip" },
  { text: "毎回 3〜5分", bg: "dark", durationSec: 1, textSize: "xl", transition: "flash" },
  { text: "× ゲームの数", bg: "dark", durationSec: 1, textSize: "xl", transition: "push" },
  { text: "= 膨大な時間の無駄\nと設定ミスの発生", bg: "dark", durationSec: 1.5, textSize: "lg", transition: "flash", emphasis: ["時間の無駄", "設定ミス"] },
  { text: "この作業、\nもっとラクにしませんか？", bg: "dark", durationSec: 2, textSize: "lg", transition: "glow" },

  // === Section 1: Tool Intro ===
  { text: "Stream Tag Inventory", bg: "white", durationSec: 4, textSize: "xl", transition: "flash", layout: "titleReveal", image: "screenshots/main.png" },
  { text: "配信設定を\nテンプレート化", bg: "white", durationSec: 1.5, textSize: "lg", transition: "push" },
  { text: "ワンクリックで\nTwitchに適用", sub: "タイトル・カテゴリ・タグを\nTwitch側に一括送信", bg: "blue", durationSec: 2.5, textSize: "lg", transition: "zoom", layout: "splitHighlight", image: "screenshots/card.png", highlight: hl["card:apply"], highlightStyle: "sparkleClick" },
  { text: "適用完了！", bg: "green", durationSec: 1.5, textSize: "xl", icon: "✅", transition: "flash" },
  { text: "毎回の手入力が不要に", bg: "green", durationSec: 1.5, textSize: "lg", transition: "push" },
  { text: "設定作業が数秒で完了！", bg: "blue", durationSec: 1.5, textSize: "lg", transition: "glow" },

  // === Section 3: Main Screen ===
  { id: "feature-intro", text: "① 配信情報パネル", sub: "今Twitchに登録されている設定を表示\nワンボタンでテンプレートに取り込めます", bg: "white", durationSec: 5, transition: "flash", layout: "splitHighlight", image: "screenshots/main.png", highlight: hl["main:info-panel"], enterAnimation: "shrinkFromFull", sectionTitle: "機能紹介" },
  { text: "② テンプレート一覧", sub: "保存した設定がカードで並ぶ", bg: "white", durationSec: 2, transition: "crossfade", layout: "splitHighlight", image: "screenshots/main.png", highlight: hl["main:templates"] },
  { text: "③ 新規追加ボタン", sub: "テンプレートを作成", bg: "white", durationSec: 2, transition: "crossfade", layout: "splitHighlight", image: "screenshots/empty.png", highlight: hl["empty:add-button"] },

  // === Section 4: Template Creation ===
  { id: "template-creation", text: "① タイトルを入力", sub: "配信のタイトルを設定", bg: "white", durationSec: 3.5, transition: "flash", layout: "splitHighlight", image: "screenshots/card.png", highlight: hl["card:title"], enterAnimation: "delayedFadeIn", sectionTitle: "テンプレートの作り方" },
  { text: "② カテゴリを検索・選択", sub: "Twitch APIでリアルタイム検索", bg: "white", durationSec: 2, transition: "crossfade", layout: "splitHighlight", image: "screenshots/category.png", highlight: hl["category:dropdown"] },
  { text: "③ タグを追加", sub: "配信に付けるタグを設定", bg: "white", durationSec: 2, transition: "crossfade", layout: "splitHighlight", image: "screenshots/card.png", highlight: hl["card:tags"] },
  { text: "④ アクションボタン", sub: "複製・削除・適用", bg: "white", durationSec: 2, transition: "crossfade", layout: "splitHighlight", image: "screenshots/card.png", highlight: hl["card:actions"] },

  // === Section 5: Extra Features ===
  { id: "extra-features", text: "現在の配信を取り込む", sub: "今の配信情報をテンプレート化", bg: "gray", durationSec: 3.5, transition: "flash", layout: "splitHighlight", image: "screenshots/main.png", highlight: hl["main:import-button"], enterAnimation: "delayedFadeIn", sectionTitle: "もっと便利な機能" },
  { text: "ドラッグ&ドロップ\nで並べ替え", bg: "white", durationSec: 3, video: "videos/dnd-reorder.webm", videoStartFrom: 0.5, transition: "crossfade" },
  { text: "テンプレートを\n複製して編集", bg: "white", durationSec: 3, video: "videos/clone-template.webm", videoStartFrom: 0.5, transition: "crossfade" },
  { text: "検索で素早く見つける", bg: "white", durationSec: 4, video: "videos/search-filter.webm", videoStartFrom: 0.5, transition: "crossfade" },
  { text: "設定をファイルに保存", sub: "別のブラウザ・PCに\n引っ越しできる", bg: "gray", durationSec: 2.5, icon: "📤", icon2: "📲", transition: "crossfade", layout: "splitPane" },

  // === Section 6: Getting Started ===
  { id: "usage-intro", text: "ブラウザだけでOK", sub: "tags.yuniruyuni.net", bg: "white", durationSec: 3.5, icon: "🌐", transition: "flash", enterAnimation: "delayedFadeIn", sectionTitle: "はじめかた" },
  { text: "tags.yuniruyuni.net", sub: "にアクセス", bg: "blue", durationSec: 1.5, textSize: "lg", transition: "crossfade" },
  { text: "", bg: "gray", durationSec: 2, image: "screenshots/login.png", transition: "crossfade", highlight: hl["login:twitch-button"], highlightStyle: "sparkleClick" },
  { text: "ボタン１つでTwitchと連携", bg: "gray", durationSec: 2, icon: "👆", transition: "crossfade" },
  { text: "パスワード不要・安全に連携", bg: "gray", durationSec: 2.5, icon: "🔒", transition: "crossfade", callout: "＼ ブラウザ内で完結するよ ／" },

  // === Section 7: CTA ===
  { text: "今すぐ試してみよう！", bg: "purple", durationSec: 2, textSize: "xl", transition: "glow" },
  { text: "tags.yuniruyuni.net", bg: "purple", durationSec: 3, textSize: "lg", transition: "zoom", callout: "＼ 無料です！ ／" },
  { text: "GitHub でコードも公開中", sub: "yuniruyuni/StreamTagInventory", bg: "purple", durationSec: 2, transition: "push", callout: "＼ オープンソース ／" },
  { text: "フィードバック歓迎！", bg: "purple", durationSec: 1.5, icon: "🙌", transition: "flash" },
  { text: "Made by", bg: "purple", durationSec: 3, textSize: "lg", sub: "Virtual TechLead\nYuniruYuni", footnote: "twitch.tv/yuniruyuni", callout: "＼ よかったらRAIDくーださい！ ／", image: "yuniruyuni.png", transition: "glow" },
];
