# Shopify Integration Guide — VirtualFit

## 10-Minute Install (No Code Required)

### Option A: Theme Editor (Easiest)
1. Go to **Shopify Admin → Online Store → Themes → Customize**
2. Click **App embeds** (bottom-left sidebar)
3. If VirtualFit isn't listed yet, use the manual method below

### Option B: Manual Script Tag (5 minutes)
1. Go to **Shopify Admin → Online Store → Themes**
2. Click **⋯ → Edit code**
3. Open `layout/theme.liquid`
4. Find the closing `</body>` tag
5. Paste this **before** `</body>`:

```html
<script
  src="https://wonderful-sky-0513a3610.7.azurestaticapps.net/embed.js"
  data-shop-id="YOUR_SHOP_ID"
  data-retailer="Your Store Name"
  data-position="bottom-right"
  data-color="#6C5CE7">
</script>
```

6. Replace `YOUR_SHOP_ID` and `Your Store Name`
7. Click **Save**
8. A "👕 Try It On" button now appears on every page

### Option C: Product Page Only
To show the button only on product pages:

1. Open `templates/product.liquid` (or `sections/product-template.liquid`)
2. Add this where you want the button:

```html
<virtualfit-button
  product-id="{{ product.id }}"
  garment-image="{{ product.featured_image | img_url: '600x' }}"
  shop-id="YOUR_SHOP_ID">
  👕 Try It On
</virtualfit-button>
<script src="https://wonderful-sky-0513a3610.7.azurestaticapps.net/embed.js"
  data-shop-id="YOUR_SHOP_ID"></script>
```

## Get Your Shop ID
1. Go to [/retailer/signup](/retailer/signup)
2. Enter your store details
3. Your Shop ID is generated automatically

## Configuration Options

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-shop-id` | — | Your unique shop identifier |
| `data-retailer` | — | Store name shown in the widget |
| `data-position` | `bottom-right` | Button position: `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `data-color` | `#6C5CE7` | Primary color (hex) |
| `data-button-text` | `👕 Try It On` | Button label |
| `data-font-family` | system-ui | Font family |
| `data-garment-set` | — | Load a specific garment collection |
| `data-product-id` | — | Shopify product ID for tracking |
| `data-garment-image` | — | Product image URL to use as garment texture |

## JavaScript API

After the script loads, you can control the widget programmatically:

```javascript
// Open/close the try-on panel
VirtualFit.open();
VirtualFit.close();

// Set a garment from your product page
VirtualFit.setGarment(productImageUrl);

// Listen for events
VirtualFit.on('garment-changed', function(data) {
  console.log('Customer tried on:', data);
});

VirtualFit.on('add-to-cart', function(data) {
  // Customer wants to buy this garment
  Shopify.addItem(data.productId, 1);
});

VirtualFit.on('screenshot', function(data) {
  // Customer took a screenshot of their try-on
  console.log('Screenshot:', data.dataUrl);
});
```

## Shopify OAuth App (Coming Soon)
We're building a native Shopify app that:
- Automatically imports your product catalog
- Generates garment textures from your product photos
- Shows try-on analytics in your Shopify admin
- One-click install from the Shopify App Store

**Timeline:** Beta Q3 2026. [Join the waitlist →](/retailer/signup)

## Support
- Email: madhavsomani007@gmail.com
- We'll install it for free during beta — just send us your store URL
