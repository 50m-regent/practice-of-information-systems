# CGOを有効にする
$env:CGO_ENABLED=1

# Windows (amd64) - 通常、クロスコンパイラは不要ですが、MinGWなどが必要な場合があります
$env:GOOS="windows"; $env:GOARCH="amd64"; go build -o ./build/back-windows-amd64

# クロスコンパイルむずすぎ CGO=1だとWin上では厳しいかも
# WSLでやるか？
# Linux (amd64) - 例: x86_64-linux-gnu-gcc
#$env:GOOS="linux"; $env:GOARCH="amd64"; $env:CC="x86_64-linux-gnu-gcc"; go build -o ./build/back-linux-amd64

# Linux (arm64) - 例: aarch64-linux-gnu-gcc
#$env:GOOS="linux"; $env:GOARCH="arm64"; $env:CC="aarch64-linux-gnu-gcc"; go build -o ./build/back-linux-arm64

# macOS (amd64) - 例: x86_64-apple-darwinXX-clang (XXはバージョン)
#$env:GOOS="darwin"; $env:GOARCH="amd64"; $env:CC="x86_64-apple-darwin-clang"; go build -o ./build/back-darwin-amd64

# macOS (arm64) - 例: aarch64-apple-darwinXX-clang
#$env:GOOS="darwin"; $env:GOARCH="arm64"; $env:CC="aarch64-apple-darwin-clang"; go build -o ./build/back-darwin-arm64