
{
  description = "A development environment for the Treasury Bond Visualizer";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
  };

  outputs = { self, nixpkgs }: let
    pkgs = nixpkgs.legacyPackages.x86_64-linux;
  in {
    devShells.default = pkgs.mkShell {
      buildInputs = with pkgs; [
        python311
        python311Packages.requests
      ];
    };
  };
}
