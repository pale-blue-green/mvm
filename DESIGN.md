# mvm 設計

[k1LoW/mo](https://github.com/k1LoW/mo) を参考にした、Tauri v2 製のスタンドアロン Markdown ビューア。

## 方針

- mo は Go の HTTP サーバとブラウザ SPA の構成である。mvm は HTTP サーバを持たず、Tauri ウィンドウ内の SPA と Rust 側のファイル処理で構成する。
- Markdown のレンダリングはフロントエンド(TypeScript)で行う。Mermaid、KaTeX、Shiki はどの方式でもフロントで描画するため、Rust 側でパースしない。
- Rust 側の責務は、ファイル読み込み、ファイル監視、CLI 引数処理、single-instance、セッション永続化に限定する。

## 決定事項と除外

| 項目 | 決定 |
|---|---|
| グループ(mo の `-t`) | 実装しない。ただしタブとして扱う前提で状態モデルとセッション形式を設計する |
| stdin 入力 | 実装しない |
| MDX | 実装しない |
| UI フレームワーク | React |
| 対象 OS | Linux と Windows を先行し、macOS は後 |
| mo のサーバ系機能(`--port` / `--bind` / `--status` / `--shutdown` / `--restart` / リモートアクセス) | HTTP サーバがないため廃止 |

## アーキテクチャ

```mermaid
flowchart LR
  CLI["mvm file.md / dir / glob"] --> RS
  subgraph RS["Rust (src-tauri)"]
    SI["single-instance"]
    CMD["commands: read_file / list_dir / session"]
    WT["notify watcher (親ディレクトリ単位)"]
    SS["session store (JSON)"]
  end
  subgraph FE["WebView (TypeScript)"]
    ST["state (discriminated union)"]
    MD["unified pipeline"]
    UI["sidebar / ToC / search / viewer"]
  end
  SI -- "emit: open-files" --> ST
  WT -- "emit: file-changed" --> ST
  ST -- "invoke" --> CMD
  CMD --> SS
  ST --> MD --> UI
```

### mo との対応

| mo | mvm |
|---|---|
| 1ポート1サーバ、既存サーバへの POST でファイル追加 | `tauri-plugin-single-instance`。2つ目の起動時に `argv` と `cwd` を受け取り、アクティブなタブにファイルを追加する |
| SSE による live reload | Rust の `notify` で監視し、Tauri のイベントでフロントへ通知する |
| ドラッグ&ドロップ(メモリ読み込みで live reload 不可) | `onDragDropEvent` で絶対パスを取得するため live reload が有効 |
| `$XDG_STATE_HOME/mo/backup/mo-<port>.json` | アプリデータディレクトリに JSON を原子的に保存する |

### 設計判断

1. **ファイル読み込みと監視は fs プラグインを使わず、自前の Rust コマンドと `notify` で実装する。** `tauri-plugin-fs` は任意パス読み取りにスコープの明示が必要で、任意の Markdown を開く用途ではスコープが広くなる。自前コマンドなら capabilities を最小にできる。`src-tauri/capabilities/*.json` には `core:default` が必要で、変更後は `tauri dev` の再起動が要る(Growi: `/knowledge/libraries/rust/tauri/capabilities`)。
2. **監視は親ディレクトリ単位で行い、参照カウントで管理する。** 多くのエディタは一時ファイルへの書き込み後に rename で保存するため、ファイル単位の監視では通知が途絶えるおそれがある。監視はタブとは独立し、全タブのファイル集合から導出する。
3. **相対パス画像は asset protocol で表示する。** `convertFileSrc` で変換し、開いた Markdown のディレクトリだけを実行時にスコープへ追加する。静的スコープに `**/*` は許可しない。
4. **サニタイズと CSP を有効にする。** `rehype-raw` で生 HTML を通すため `rehype-sanitize` が必須。CSP の `img-src` に `asset:` と `http://asset.localhost` を許可する。Markdown 内のリンクは WebView 内遷移を禁止し、外部 URL は OS のブラウザで開く。
5. **フロントの状態は discriminated union で表現する。** ファイルは `loading | loaded | missing | error`。ファイル ID は branded type で、絶対パスの SHA-256 先頭8桁とする(mo と同方式)。

## タブの前提(UI は未実装)

M1〜M2 ではタブ UI を作らず、`tabs` が常に1要素の状態として動かす。後からタブ UI を足すときに、状態モデルとセッション形式の変更を不要にするのが目的。

- 状態: `AppState = { tabs: Tab[]; activeTabId: TabId }`、`Tab = { id: TabId; title: string; files: FileId[]; activeFileId: FileId | null }`。ファイルの内容と状態は、タブの外の `files: Record<FileId, FileEntry>` に持つ。同じファイルを複数タブで開いても、内容と監視は1つで済む。
- セッション JSON: `{ version: 1, tabs: [...], activeTabId }`。単一リストをトップレベルに置く形式にはしない。
- イベント: `open-files` のペイロードは `{ files: OpenedFile[]; tabId?: TabId }`(Rust がパスを解決・登録した後の値)。省略時はアクティブなタブに追加する。`file-changed` はタブに依存せずファイル単位で発行する。
- CLI: 今回はタブを指定するフラグを持たない。追加するときは mo の `-t` 相当を `--tab` として足す。

## 技術スタック

| 層 | 選定 |
|---|---|
| シェル | Tauri v2 |
| Rust crate | `tauri-plugin-single-instance`、`tauri-plugin-dialog`、`notify`(+ debouncer)、`serde`、`sha2` |
| フロント | TypeScript、Vite、React 19、Tailwind CSS v4 |
| Markdown | unified(remark-parse、remark-gfm、remark-rehype、rehype-raw、rehype-sanitize、rehype-slug、@shikijs/rehype)+ hast-util-to-jsx-runtime。M2 以降で remark-math、rehype-katex、rehype-github-alerts、mermaid を追加 |
| パッケージ管理 | pnpm |
| テスト | vitest、`cargo test`。E2E は `tauri-driver` を検討し、ビルド済みバイナリを対象にする。CI で開発サーバは使わない |
| 開発環境 | `flake.nix` + direnv(NixOS)。WebKitGTK など Tauri の Linux 依存を含める |
| 配布 | Linux は AppImage/deb、Windows は msi/nsis、macOS は dmg。OS ごとの CI マトリクスでビルドする |

Windows 向けビルドは WSL の UNC パス上で行うとコンパイルがクラッシュするため、Windows 側のファイルシステムで行う(Growi: `/knowledge/libraries/rust/tauri/wsl-windows-build`)。

## 実装範囲

1. **M1**: CLI でファイルを開く / GFM・Shiki・相対画像 / 保存時の live reload / single-instance / ダーク・ライトテーマ
2. **M2**: ディレクトリ・glob 監視 / サイドバー(ツリー)・ToC・全文検索 / ドラッグ&ドロップ・ダイアログでの追加 / Mermaid・KaTeX・GitHub Alerts / セッション永続化
3. **M3**: フォントサイズ・本文幅 / frontmatter 折りたたみ / Raw 表示とコピー / 画像・Mermaid のズーム / `.md` の関連付け / 配布 CI

## M1 の実装で確定した事項

- `@shikijs/rehype` は非同期プラグインのため、同期の `react-markdown` では変換に失敗する(描画時に例外となる)。`unified().run()` で hast を得て `hast-util-to-jsx-runtime` で React 要素に変換する。変換は `src/lib/pipeline.ts`(Tauri 非依存、vitest で検証)に分離している。
- Shiki の Oniguruma は WASM を使うため、CSP の `script-src` に `'wasm-unsafe-eval'` が必要。
- `ErrorBoundary` を表示領域に置く。描画中の例外でアプリ全体が空白になるのを防ぐ。
- 実行時の asset スコープ追加は `app.asset_protocol_scope().allow_directory(dir, true)`(Tauri 2.12)。スコープは開いたファイルのディレクトリ配下のみのため、親ディレクトリ(`../img/` など)の画像は表示できない想定(未確認)。
- 親ディレクトリ監視は、一時ファイルへ書き込んでから rename する保存方式でも live reload が動作する(Linux で確認)。
- `img-src` は `https:` を許可している。外部画像(README のバッジなど)を表示するためで、リモート画像による閲覧の追跡は許容している。

## M2 の実装で確定した事項

### CLI

`mvm [-R] [-w] <file | dir | glob>...`

| 引数 | 動作 |
|---|---|
| ファイル | そのまま開く(拡張子は問わない) |
| ディレクトリ | 直下の Markdown(`md` / `markdown` / `mdown` / `mkd`)を開く。`-R` で再帰する。`.` 始まりのディレクトリ、`node_modules`、`target` は辿らない |
| glob | `*` `?` `[` を含む引数。cwd 基準で展開する。`**` を含むと再帰とみなす |
| `-w` | 展開元(ディレクトリ・glob)を監視パターンとして登録し、一致する新規ファイルを自動で開く |

- 1回の展開で開くファイル数は1000件が上限。
- 未知のフラグは無視する(GTK 等が付与する引数を拒否しないため)。
- 2つ目の起動(single-instance)も同じ引数を解釈し、既存ウィンドウの先頭の新規ファイルを選択する。監視パターンによる自動追加では選択を変えない。

### 監視パターンとセッション

- 保存先は `app_data_dir()/session.json`(`version: 1`)。タブ、各タブのファイルパスと選択中ファイル、監視パターン、閉じたファイルを持つ。一時ファイルへ書いて rename する。
- フロントは状態が変わるたびに 300ms のデバウンス後に保存する。復元が終わるまで保存しない(保存済みセッションを空の状態で上書きしないため)。
- 起動時は、保存済みセッションを復元してから、監視パターンを再走査して前回終了後に増えたファイルを加え、最後に起動引数のファイルを開く。
- 閉じたファイルは `closed` に記録し、監視パターンが再度開かないようにする。明示的に開くと記録から外れる。
- 監視パターンを解除する UI は未実装。解除するには `session.json` の `patterns` を編集する。

### 描画

- 数式は `remark-math` + `rehype-katex`、GitHub Alerts は `rehype-github-alerts`、Mermaid は最初の図を描画するときに動的 import する。いずれも sanitize の後段に置く。
- `rehype-github-alerts` は名前付きエクスポートのみ。デフォルトインポートは `undefined` になり、`unified().use(undefined)` はエラーにならず何もしない。
- Mermaid は `securityLevel: "strict"` で描画し、ダーク/ライトの切替に追従して再描画する。構文エラーの図は、エラー文とソースを表示する。
- 目次は hast の見出し(`rehype-slug` が付けた id)から生成する。幅が狭いウィンドウでは非表示(`xl` 以上で表示)。

### 検証状況

- ヘッドレス Wayland(cage)で、ディレクトリの再帰展開、ツリー表示、目次、数式、アラート、Mermaid(正常系と構文エラー)、監視パターンによる新規ファイルの自動追加、2つ目の起動によるファイル追加、セッション復元、検索(`Ctrl+K`)を確認した。
- ドラッグ&ドロップとファイル選択ダイアログは、ポインタ操作とデスクトップポータルが必要なため未確認。

## M3 の実装で確定した事項

- 表示設定(文字サイズ4段階、本文幅の狭/広)は `localStorage` の `mvm.settings` に保存する。不正な保存値は項目ごとに既定値へ戻す。本文幅は `max-w-3xl` / `max-w-6xl` で、実際の幅はウィンドウ幅とサイドバー・目次の幅で制限される。
- サイドバーはヘッダー左端の ☰ ボタンまたは `Ctrl+B`(macOS は `Cmd+B`)で表示/非表示を切り替える。開閉状態は `mvm.settings` の `sidebarOpen` に保存する。非表示の間もアンマウントせず `display: none` にし、検索語とツリーの折りたたみ状態を保つ。非表示中の `Ctrl+K` は表示に戻してから検索欄にフォーカスする。
- スクロール位置はファイルごとに記憶し(`src/lib/scrollMemory.ts`)、ファイルを切り替えたときに復元する。位置はメモリ上のみで、再起動後は先頭から表示する。内容は非同期に描画され、画像や Mermaid の図で高さが後から変わるため、目標位置に届くまで内容のサイズ変化(`ResizeObserver`)のたびに再適用する。ユーザーの操作(ホイール、タッチ、キー、ポインタ)か 2 秒で打ち切る。復元中の `scroll` イベントは保存しない(内容の入れ替えで `scrollTop` が丸められた値を、新しいファイルの位置として上書きしないため)。
- YAML frontmatter は先頭の `---` から次の `---` 行までを分離し、折りたたみ(`<details>`)で表示する。Markdown の変換対象には含めない。閉じ行がない場合は frontmatter として扱わない。
- Raw 表示は元のテキストをそのまま表示する。文字サイズと本文幅の設定に連動する。
- コピーは Markdown(元のテキスト)、テキスト(`innerText`)、HTML(`innerHTML`)の3種類。`navigator.clipboard` を使い、使えない場合は `execCommand("copy")` に切り替える。テキストと HTML は Raw 表示中は選択できない。
- 画像と Mermaid の図をクリックすると、`react-zoom-pan-pinch` による全画面モーダルで拡大・パンできる。Esc または背景のクリックで閉じる。Mermaid の図はキーボード(Enter)でも開ける。図は背景が透明なため、半透明の背景越しにページが重なると線が見えなくなる。図は不透明なパネル(ライトは白、ダークは `neutral-900`。Mermaid の配色がテーマに追従するため、線とパネルのコントラストが保たれる)に載せる。
- `.md` の関連付けは `bundle.fileAssociations`(`md` / `markdown` / `mdown` / `mkd`、`role: Viewer`)で設定する。
  - Tauri が生成する `.desktop` は `Exec=mvm` で `%F` が付かず、ファイルマネージャーからの起動でパスが渡らない。`src-tauri/desktop-template.desktop` を `bundle.linux.deb.desktopTemplate` / `rpm.desktopTemplate` に指定し、`Exec={{exec}} %F` としている(deb で生成結果を確認)。
  - macOS は Finder からの起動時に引数ではなく `RunEvent::Opened` でパスが渡されるため、現状は未対応(関連付けはするが、開いたファイルは表示されない)。
- CI(`.github/workflows/ci.yml`)は、フロント(型検査、テスト、ビルド)と Rust(clippy `-D warnings`、テスト。Ubuntu / Windows / macOS)を実行する。Rust のビルドには `dist/` が必要なため、先にフロントをビルドする。開発サーバは使わない。
- リリース(`.github/workflows/release.yml`)は `v*` タグの push で、`tauri-apps/tauri-action` により Ubuntu / Windows / macOS(arm64 と Intel)の配布物をドラフトリリースに添付する。シークレットは `GITHUB_TOKEN` のみ。コード署名と公証は未設定。
- どちらのワークフローも `actionlint` で検証したが、GitHub 上では未実行。

## 未検証事項

実装前に context7 または実機で確認する。

- `dragDropEnabled` を有効にしたとき、Windows で WebView 内の HTML5 DnD が無効になるか
- `bundle.fileAssociations` の設定方法
- ドラッグ&ドロップ(`onDragDropEvent`)とファイル選択ダイアログの実機動作
- 配布物のインストールと起動(CI は 2026-10-05、リリース `release.yml` は v0.1.0 のタグ push で全ジョブ成功し、ドラフトリリースに deb / rpm / AppImage / msi / NSIS / dmg(arm64・Intel)を添付できた。生成物は起動して確認していない)
- ファイルマネージャーのダブルクリックで `.md` が開くこと(`.desktop` の内容のみ確認)
- macOS の `RunEvent::Opened` への対応
- Windows / macOS での GUI の動作(CI でビルドとテストのみ確認。Linux 以外では起動して確認していない)
- mo の監視ライブラリが fsnotify か fswatcher か(mo の CLAUDE.md と go.mod の記述が食い違っている。ソース未読)
