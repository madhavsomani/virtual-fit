#!/bin/bash
# serve-https.sh — Serve VirtualFit over HTTPS via Tailscale for mobile camera access
# Usage: ./serve-https.sh [port]
# Requires: tailscale, npx (for local-ssl-proxy or similar)

set -e

PORT="${1:-3000}"
HTTPS_PORT="${2:-3443}"
HOSTNAME=$(tailscale status --json 2>/dev/null | grep -o '"DNSName":"[^"]*"' | head -1 | cut -d'"' -f4 | sed 's/\.$//')

if [ -z "$HOSTNAME" ]; then
  echo "❌ Tailscale not running or no hostname found"
  echo "   Run: tailscale up"
  exit 1
fi

echo "📱 VirtualFit HTTPS Server"
echo "   Tailscale hostname: $HOSTNAME"
echo ""

# Generate cert if not exists
CERT_DIR="$HOME/.local/share/virtualfit-certs"
mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_DIR/$HOSTNAME.crt" ]; then
  echo "🔐 Generating Tailscale certificate..."
  tailscale cert --cert-file="$CERT_DIR/$HOSTNAME.crt" --key-file="$CERT_DIR/$HOSTNAME.key" "$HOSTNAME"
fi

echo "🚀 Starting HTTPS proxy..."
echo "   HTTP:  http://localhost:$PORT"
echo "   HTTPS: https://$HOSTNAME:$HTTPS_PORT"
echo ""
echo "📱 Open on your phone: https://$HOSTNAME:$HTTPS_PORT/mirror/"
echo ""

# Start Next.js dev server in background
cd "$(dirname "$0")"
npx next dev -p "$PORT" &
NEXT_PID=$!

# HTTPS proxy using Node.js (no extra deps needed)
node -e "
const https = require('https');
const http = require('http');
const fs = require('fs');
const options = {
  cert: fs.readFileSync('$CERT_DIR/$HOSTNAME.crt'),
  key: fs.readFileSync('$CERT_DIR/$HOSTNAME.key'),
};
https.createServer(options, (req, res) => {
  const proxy = http.request({ hostname: 'localhost', port: $PORT, path: req.url, method: req.method, headers: req.headers }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  req.pipe(proxy);
}).listen($HTTPS_PORT, '0.0.0.0', () => {
  console.log('HTTPS proxy on :$HTTPS_PORT');
});
" &
PROXY_PID=$!

trap "kill $NEXT_PID $PROXY_PID 2>/dev/null" EXIT
wait
