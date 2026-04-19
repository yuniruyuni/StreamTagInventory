import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * CSPRNG 由来の推測不能な識別子。OIDC nonce / CSRF token / session bearer
 * のように secret 性が必要な値を表現する。
 *
 * **内部表現は base64url string (no-padding)**。理由:
 * - HTTP / URL / Cookie / DB (TEXT) の全境界で string のまま流れるため、
 *   Model ↔ 境界の変換コストがゼロになる
 * - equals の timing-safe 比較時のみ bytes に落とす
 *
 * 失敗挙動: CSPRNG が使えない稀な環境 (kernel entropy 未初期化 / seccomp で
 * `getrandom` 拒否 / /dev/urandom 不在) で Node の `randomBytes` が throw する。
 * usecase runner の catch 節で `INTERNAL` Fail に集約されリクエストは HTTP 500
 * になる。リトライで直らない類の障害のため、Model 層では握り潰さない。
 */
export class Token {
  private constructor(private readonly value: string) {}

  /** CSPRNG で新しい Token を生成する (既定 32 bytes = 256 bit)。 */
  static generate(byteLength = 32): Token {
    return new Token(randomBytes(byteLength).toString("base64url"));
  }

  /**
   * base64url 文字列から Token を復元する (protocol 入力 / DB 読出し用)。
   * padding `=` や標準 base64 の `+` / `/` が混入しても decode → 再エンコードで
   * canonical な no-padding base64url に正規化する (DB の等値照合を安定させる)。
   */
  static fromBase64url(s: string): Token {
    const canonical = Buffer.from(s, "base64url").toString("base64url");
    return new Token(canonical);
  }

  /** HTTP / 永続化境界向けの base64url 表現 (内部形式そのまま)。 */
  toBase64url(): string {
    return this.value;
  }

  /**
   * Timing-safe 等価比較。長さが違えば即 false、同長なら bytes に落として
   * `timingSafeEqual`。decode は本関数内でのみ発生する。
   */
  equals(other: Token): boolean {
    if (this.value.length !== other.value.length) return false;
    const a = Buffer.from(this.value, "base64url");
    const b = Buffer.from(other.value, "base64url");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * SHA-256 ハッシュを base64url 文字列で返す。session cookie の DB 照合用
   * (ADR 0005: cookie = raw / DB = sha256 分離)。
   *
   * 入力は decode 済の raw bytes に対して hash するため、base64url 表記の
   * padding / alphabet ドリフトの影響を受けない。出力も 32 bytes → 43 文字の
   * no-padding base64url で、Token の内部表現と同形式。
   */
  hash(): string {
    const bytes = Buffer.from(this.value, "base64url");
    return createHash("sha256").update(bytes).digest("base64url");
  }
}
