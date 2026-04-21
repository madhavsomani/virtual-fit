# Waitlist API

## POST /api/waitlist
Captures email + willingness-to-pay survey data.

### Request
```json
{
  "email": "user@example.com",
  "revenue": "10k-50k",
  "wouldPay": "Yes, definitely",
  "killerFeature": "Shopify integration",
  "source": "homepage"
}
```

### Response
```json
{"success": true, "message": "You're on the list! We'll reach out soon."}
```

### What happens on submit
1. Entry logged to `/tmp/virtualfit-waitlist.jsonl`
2. Email sent to madhavsomani007@gmail.com via FormSubmit
3. Milestone webhook fires at 5, 10, 25, 50, 100, 250, 500, 1000 signups

## Environment Variables
| Var | Required | Description |
|-----|----------|-------------|
| `MILESTONE_WEBHOOK_URL` | No | URL to POST milestone notifications (Telegram, n8n, Slack, etc.) |

### Webhook Payload
```json
{
  "text": "🎉 VirtualFit milestone: 10 waitlist signups! Latest: user@example.com",
  "count": 10,
  "email": "user@example.com",
  "milestone": 10
}
```

### Wiring to Telegram (via n8n)
1. Create n8n webhook node
2. Set `MILESTONE_WEBHOOK_URL` in Azure SWA env to the n8n webhook URL
3. Add n8n Telegram node: send `{{$json.text}}` to your chat
