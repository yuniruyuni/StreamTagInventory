---
id: "0011"
title: "Bun 1.4.4 の修正版導入時も fetch の応答展開ガードを維持する"
status: "accepted"
date: "2026-10-25"
supersedes: "0010"
superseded_by: null
related_specres: []
tags: [security, runtime]
---

## コンテキスト

Bun 1.4.4 の公式安定版は、CVE-2026-111497 の修正を含む Brotli 1.2.1 を
同梱している。ADR 0010 では修正版の導入とガード撤去を続けて行う予定だった。
今回の承認範囲では、修正版への更新と同時に外向き通信の動作を広げない。

## 検討した選択肢

ランタイム更新とガード撤去を同時に行う方法と、ガードを維持して更新する方法を
比較した。後者なら既存の identity 応答ポリシーを保ってランタイム互換性を検証できる。

## 決定

Docker と CI を Bun 1.4.4 に更新し、Docker イメージは digest を固定する。
コンパイル済みサーバも再生成する。global fetch の decompress: false、
identity 要求、圧縮応答拒否は維持する。ガードと診断用 CLI の撤去は別の
レビュー対象とする。

## 帰結

Bun 内蔵デコーダの修正と、既存 fetch ガードの維持を別々に確認する。
identity に応じない上流は引き続き失敗する。DB・JWT・権限の設定は変えない。
ガード自体の適用範囲は広がらず、別の HTTP クライアント等の評価は引き続き必要。

## 参照

- [実装・検証・撤去手順](../runtime-security-2026-10.md)
- https://github.com/oven-sh/bun/releases/tag/bun-v1.4.4
- https://github.com/oven-sh/bun/blob/bun-v1.4.4/scripts/build/deps/brotli.ts
