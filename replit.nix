{ pkgs }: {
  deps = [
    pkgs.nodejs-20_x
    pkgs.nodePackages.typescript
    pkgs.nodePackages.npm
    pkgs.postgresql
  ];
}
