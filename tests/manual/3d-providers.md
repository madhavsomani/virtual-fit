# Manual 3D Provider Tests

## Test the API locally
```bash
# Start the API (Azure Functions Core Tools)
cd /Users/madhav/.openclaw/workspace/projects/virtual-tryon-v2/app
func start --port 7071
```

## Test each provider

### 1. Mock (no keys needed — always works)
```bash
curl -X POST http://localhost:7071/api/generate-3d \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400"}'
```
Expected: `{"provider": "mock", "isMock": true, "textureUrl": "...", "message": "No 3D API key configured..."}`

### 2. Meshy (needs MESHY_API_KEY)
```bash
# Get key: https://www.meshy.ai → Sign up → API Keys
export MESHY_API_KEY=your_key_here

# Start generation
curl -X POST http://localhost:7071/api/generate-3d \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400"}'
# Returns: {"taskId": "xxx", "provider": "meshy", "status": "pending", "pollUrl": "/api/generate-3d?taskId=xxx&provider=meshy"}

# Poll for result (repeat every 5s until status=completed)
curl "http://localhost:7071/api/generate-3d?taskId=xxx&provider=meshy"
# Returns: {"status": "completed", "glbUrl": "https://...model.glb"}
```

### 3. HuggingFace (needs HF_TOKEN)
```bash
# Get token: https://huggingface.co/settings/tokens
export HF_TOKEN=hf_xxxx

curl -X POST http://localhost:7071/api/generate-3d \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400"}'
# Returns: {"provider": "huggingface", "status": "completed", "glbUrl": "data:model/gltf-binary;base64,..."}
```

### 4. Replicate (needs REPLICATE_API_TOKEN)
```bash
# Get token: https://replicate.com/account/api-tokens
export REPLICATE_API_TOKEN=r8_xxxx

curl -X POST http://localhost:7071/api/generate-3d \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400"}'
# Takes 30-120s, returns: {"provider": "replicate", "status": "completed", "glbUrl": "https://..."}
```

## Set up in Azure SWA
1. Go to Azure Portal → your Static Web App → Settings → Configuration
2. Add these Application settings:
   - `MESHY_API_KEY` = your Meshy key
   - `HF_TOKEN` = your HuggingFace token
   - `REPLICATE_API_TOKEN` = your Replicate token (optional)
3. Save → the API will automatically use the first available provider

## Provider comparison
| Provider | Speed | Quality | Free Tier | Best For |
|----------|-------|---------|-----------|----------|
| Meshy | 30-60s | ★★★★★ | 100 credits/mo | Clothing, production |
| HuggingFace | 10-30s | ★★★☆☆ | Unlimited (rate-limited) | Testing, dev |
| Replicate | 30-120s | ★★★★☆ | $0 credit to start | Fallback |
| Mock | Instant | ★☆☆☆☆ | Always free | Flat image overlay |
