# mvm

Tauri v2 で作ったスタンドアロンの Markdown ビューア。[k1LoW/mo](https://github.com/k1LoW/mo) を参考にしている。mo は HTTP サーバとブラウザで表示するが、mvm は HTTP サーバを持たず、ネイティブウィンドウ内で表示する。

## 機能

- GFM、シンタックスハイライト(Shiki)、数式(KaTeX)、GitHub Alerts、Mermaid
- 保存時の自動再読み込み(エディタの rename 保存に対応)
- ディレクトリ・glob の展開と、新規ファイルの自動追加(`-w`)
- サイドバー(ツリー/フラット表示、`Ctrl+B` で表示/非表示)、目次、ファイル名・本文の検索(`Ctrl+K`)
- 相対パス画像の表示、画像と図のクリックによる拡大
- YAML frontmatter の折りたたみ、Raw 表示、Markdown / テキスト / HTML のコピー
- 文字サイズ(4段階)と本文幅の切替、ダーク/ライトテーマ(システム設定に追従)
- ドラッグ&ドロップ、ファイル/フォルダ選択ダイアログ
- 再起動時に開いていたファイルを復元
- 起動中に `mvm` を再実行すると、既存のウィンドウにファイルを追加

## 使い方

```sh
mvm README.md                 # ファイルを開く
mvm a.md b.md                 # 複数のファイル
mvm docs/                     # ディレクトリ直下の Markdown
mvm -R docs/                  # 再帰的に展開
mvm -w -R docs/               # 展開に加え、docs 配下に作られた新規ファイルを自動で開く
mvm 'docs/**/*.md'            # glob(シェルに展開させないよう引用符で囲む)
```

| フラグ | 動作 |
|---|---|
| `-R`, `--recursive` | ディレクトリを再帰的に展開する |
| `-w`, `--watch` | 展開元(ディレクトリ・glob)を監視パターンとして登録し、一致する新規ファイルを自動で開く |

- ディレクトリの展開対象は `md` / `markdown` / `mdown` / `mkd`。`.` で始まるディレクトリ、`node_modules`、`target` は辿らない。1回の展開で開くのは1000ファイルまで。
- 閉じたファイルは、監視パターンが再度開かない。
- セッション(開いているファイル、選択中のファイル、監視パターン)は、アプリのデータディレクトリの `session.json` に保存する。Linux では `~/.local/share/com.tsukasa-ind.mvm/session.json`。監視パターンを解除する UI はまだないため、解除するには `session.json` の `patterns` を編集する。

### キーボードショートカット

| キー | 動作 |
|---|---|
| `Ctrl+B` | サイドバーの表示/非表示 |
| `Ctrl+K` | 検索欄にフォーカス(サイドバーが非表示なら表示する) |
| `Esc` | 拡大表示を閉じる |

macOS では `Ctrl` の代わりに `Cmd` を使える。

## インストール(Nix)

Linux(x86_64 / aarch64)向けに flake でパッケージを提供している。

```sh
nix run .                      # ビルドして起動(引数はそのまま渡る: nix run . -- README.md)
nix profile install .          # ユーザー環境にインストール
nix build .                    # ./result/bin/mvm を作る
```

リモートの flake として使う場合は、`.` を `github:<owner>/mvm` などのフレーク参照に置き換える。

NixOS や home-manager では、flake の入力に追加して `overlays.default` を適用するか、`packages.${system}.default` を直接参照する。

```nix
{
  inputs.mvm.url = "path:/path/to/mvm"; # または github:<owner>/mvm
  # ...
  # nixpkgs.overlays = [ inputs.mvm.overlays.default ];
  # environment.systemPackages = [ pkgs.mvm ];   # overlay を適用した場合
  # environment.systemPackages = [ inputs.mvm.packages.${system}.default ];  # 直接参照する場合
}
```

- ビルドは `nix/package.nix`(`rustPlatform.buildRustPackage` + `cargo-tauri.hook` + `fetchPnpmDeps`)で行う。deb 形式でバンドルした `.desktop` とアイコンも `share/` に入る。
- ソースは flake の `self`(Git で追跡しているファイルのみ)。新しいファイルを追加したら `git add` してからビルドする。
- `pnpm-lock.yaml` を更新したら、`nix/package.nix` の `pnpmDeps.hash` を更新する。`hash = lib.fakeHash;` にしてビルドすると、エラーに正しい値(`got:`)が表示される。
- ビルド中に `cargo test` が実行される。

## 開発

必要なもの: Rust、Node.js 24、pnpm、Tauri の[システム依存パッケージ](https://v2.tauri.app/start/prerequisites/)。

NixOS または Nix を使う場合は、`flake.nix` の devShell と direnv で一式が揃う。

```sh
direnv allow          # または nix develop
pnpm install
pnpm tauri dev        # 開発サーバ(Vite)付きで起動
```

### テストと検査

```sh
pnpm typecheck
pnpm test                                         # vitest
cd src-tauri && cargo test
cd src-tauri && cargo clippy --all-targets -- -D warnings
```

Rust のビルドは `dist/` を埋め込むため、事前に `pnpm build` が必要。`cargo tauri build --debug --no-bundle` は両方を実行する。

### ビルド

```sh
pnpm tauri build                  # 現在の OS 向けの配布物
pnpm tauri build --bundles deb    # 形式を指定
```

クロスビルドはできない。各 OS 向けの配布物は GitHub Actions で作る。`v*` タグを push すると `release.yml` がドラフトリリースに配布物を添付する。Windows 向けのビルドを WSL で行う場合は、WSL の UNC パス上ではなく Windows 側のファイルシステムで行う。

## 構成

| パス | 内容 |
|---|---|
| `src-tauri/src/` | Rust。ファイル登録(`files.rs`)、引数の展開(`scan.rs`)、監視パターン(`pattern.rs`)、ファイル監視(`watcher.rs`)、セッション(`session.rs`)、Tauri コマンド(`lib.rs`) |
| `src/lib/pipeline.ts` | Markdown から hast への変換(unified)。Tauri に依存しない |
| `src/state/`, `src/domain/` | 状態管理(reducer)と型 |
| `src/components/` | サイドバー、目次、ビューア、ツールバー、Mermaid、ズームモーダル |

ファイルの読み取りは、フロントエンドが渡すパスではなく、Rust 側が登録した ID で行う。Tauri の `fs` プラグインは使っていない。設計の経緯と判断は [DESIGN.md](DESIGN.md) にある。

## ライセンス

[MIT](LICENSE)

## 制限

- 動作確認は Linux(WebKitGTK)のみ。Windows と macOS は未確認。
- macOS で Finder からファイルを開く操作(`RunEvent::Opened`)には未対応。
- コード署名と公証は未設定。
