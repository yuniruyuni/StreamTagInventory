/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ===== Layer rules (AutoKanban 由来) =====
    // Rule 1: Model は他レイヤーに依存しない
    {
      name: "model-no-upper-layer-deps",
      comment:
        "Models must not depend on repositories, usecases, or presentation",
      severity: "error",
      from: { path: "^src/models/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/(repositories|usecases|presentation)/" },
    },
    // Rule 2: Repository は上位レイヤーに依存しない
    {
      name: "repository-no-upper-layer-deps",
      comment: "Repositories must not depend on usecases or presentation",
      severity: "error",
      from: { path: "^src/repositories/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/(usecases|presentation)/" },
    },
    // Rule 3: Usecase 実装は Repository を直接 import しない (context 経由)
    //   src/usecases/*.ts (runner.ts / context.ts) は framework のため subdir パターンで除外
    {
      name: "usecase-no-direct-repository-import",
      comment:
        "Usecases must access repositories through context, not direct imports",
      severity: "error",
      from: { path: "^src/usecases/.+/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/repositories/" },
    },
    // Rule 4: Usecase は Presentation に依存しない
    {
      name: "usecase-no-presentation-deps",
      comment: "Usecases must not depend on presentation layer",
      severity: "error",
      from: { path: "^src/usecases/.+/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/presentation/" },
    },
    // Rule 5: Usecase 間の横串 import 禁止 (barrel index.ts と framework 除外)
    {
      name: "usecase-no-cross-usecase-deps",
      comment:
        "Individual usecase files must not import other usecases (except via framework or barrel index.ts)",
      severity: "error",
      from: {
        path: "^src/usecases/.+/",
        pathNot: "(/index\\.ts$|\\.test\\.ts$)",
      },
      to: {
        path: "^src/usecases/",
        pathNot: "(^src/usecases/[^/]+\\.ts$|/index\\.ts$)",
      },
    },
    // Rule 6: Presentation は Repository を直接 import しない (usecase 経由)
    {
      name: "presentation-no-direct-repository-import",
      comment: "Presentation must not directly import repositories",
      severity: "error",
      from: { path: "^src/presentation/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/repositories/" },
    },
    // Rule 7: 循環依存禁止
    {
      name: "no-circular",
      comment: "No circular dependencies allowed",
      severity: "error",
      from: { pathNot: "\\.test\\.ts$" },
      to: { circular: true },
    },

    // ===== プロジェクト固有 =====
    // Rule 8: embedded-postgres は test 用途のみ
    //   本番 src で参照すると Cloud Run 上に不要な Postgres バイナリが入ってしまう。
    //   test/ は scan 対象外、src/**/*.test.ts は pathNot で除外、その他 src は禁止。
    {
      name: "embedded-postgres-only-in-test",
      comment:
        "embedded-postgres is a test-only dependency. Production code must use pg via Database interface.",
      severity: "error",
      from: { path: "^src/", pathNot: "\\.test\\.ts$" },
      // dependency-cruiser の `to.path` は resolved パス (e.g. `../node_modules/.../embedded-postgres/...`)
      // にマッチする。モジュール名単位で拾える平坦な regex に。
      to: { path: "/embedded-postgres/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
