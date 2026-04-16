import requests
import json
import warnings
warnings.filterwarnings("ignore")

BASE = "https://ws-swr9i9kneudx2ljk.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
KEY = "sk-REDACTED"
headers = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

models = ["qwen-flash", "qwen3.5-flash", "qwen3.5-plus", "qwen3.6-plus"]
for m in models:
    body = {
        "model": m,
        "messages": [{"role": "user", "content": "Say hello in one word only"}],
        "max_tokens": 20,
        "temperature": 0.1,
    }
    try:
        r = requests.post(f"{BASE}/chat/completions", json=body, headers=headers, verify=False, timeout=30)
        if r.status_code == 200:
            d = r.json()
            txt = d["choices"][0]["message"]["content"]
            usage = d.get("usage", {})
            print(f"[OK] {m:20s} -> '{txt[:40]}' (tokens: {usage.get('total_tokens', '?')})")
        else:
            print(f"[FAIL] {m:20s} -> HTTP {r.status_code}: {r.text[:100]}")
    except Exception as e:
        print(f"[ERR] {m:20s} -> {e}")
