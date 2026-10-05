{
  description = "mvm - Tauri 製 Markdown ビューア";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        # Tauri v2 の Linux 依存 (https://wiki.nixos.org/wiki/Tauri)
        tauriLibs = with pkgs; [
          at-spi2-atk
          atkmm
          cairo
          gdk-pixbuf
          glib
          gtk3
          harfbuzz
          librsvg
          libsoup_3
          pango
          webkitgtk_4_1
          openssl
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = with pkgs; [
            pkg-config
            gobject-introspection
            cargo
            rustc
            rust-analyzer
            clippy
            rustfmt
            cargo-tauri
            nodejs_24
            pnpm
            git
          ];
          buildInputs = tauriLibs;

          shellHook = ''
            export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:$XDG_DATA_DIRS"
            export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath tauriLibs}:$LD_LIBRARY_PATH"
          '';
        };
      }
    );
}
