$env:GOOS="windows"; $env:GOARCH="amd64"; go build -o ./build/back-windows-amd64
$env:GOOS="linux"; $env:GOARCH="amd64"; go build -o ./build/back-linux-amd64
$env:GOOS="linux"; $env:GOARCH="arm64"; go build -o ./build/back-linux-arm64
$env:GOOS="darwin"; $env:GOARCH="amd64"; go build -o ./build/back-darwin-amd64
$env:GOOS="darwin"; $env:GOARCH="arm64"; go build -o ./build/back-darwin-arm