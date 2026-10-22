---
id: "0010"
title: "Bun の Brotli 修正版が出るまで外向き fetch の応答展開を止める"
status: "accepted"
date: "2026-10-22"
supersedes: null
superseded_by: null
related_specres: []
tags: [security, runtime]
---

## コンテキスト

Bun 1.4.3 に同梱された Brotli は CVE-2026-111497 の共有コード修正より前。
2026-10-22 時点で修正済みの安定版は確認できない。jose の Twitch JWKS 取得も
サーバーの fetch を通るため、公開受信側の CDN だけではこの経路を防げない。

## 検討した選択肢

安定版の修正を待つだけでは既知の経路が残る。canary や独自 Bun ビルドへの
置換はランタイム全体の互換性確認が必要。Accept-Encoding の指定だけでは
相手が無視した応答を止められない。

## 決定

起動時の最初の import で global fetch を包み、identity を要求すると同時に
Bun の decompress を常に false にする。圧縮応答は展開前に拒否する。
DB や JWT の検証要件は変更しない。

## 帰結

global fetch 経路の Brotli 展開を抑制できる。identity を返さない上流は失敗する。
デコーダ自体は未修正であり、Bun.fetch の直接 import、別 HTTP client、zlib、
DecompressionStream、ビルド時の展開までは保護しない。安定版の修正確認後に
ランタイムを更新し、この一時措置を撤去する。

## 参照

- [実装・検証・撤去手順](../runtime-security-2026-10.md)
