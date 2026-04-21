# VirtualFit Embed Widget

> Add virtual try-on to any website with one line of code.

[![npm version](https://badge.fury.io/js/virtualfit-embed.svg)](https://www.npmjs.com/package/virtualfit-embed)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Quick Start

Add this script tag to your website:

```html
<script 
  src="https://cdn.virtualfit.io/embed.js"
  data-retailer="YourStoreName"
  data-color="#6C5CE7">
</script>
```

That's it! A "Try It On" button appears on your page. When clicked, it opens a virtual fitting room.

## Demo

[Live Demo](https://wonderful-sky-0513a3610.7.azurestaticapps.net/retailer) | [Documentation](https://wonderful-sky-0513a3610.7.azurestaticapps.net/retailer/docs)

## Configuration

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-retailer` | - | Your store name (shown in the widget) |
| `data-shop-id` | - | Your unique shop identifier |
| `data-color` | `#6C5CE7` | Primary button color (hex) |
| `data-position` | `bottom-right` | Button position: `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `data-button-text` | `👕 Try It On` | Custom button text |
| `data-button-radius` | `50` | Button border radius (px) |
| `data-width` | `400` | Widget panel width (px) |
| `data-height` | `650` | Widget panel height (px) |
| `data-garment-image` | - | Pre-load a specific garment image URL |
| `data-product-id` | - | Product ID for analytics tracking |

## JavaScript API

```javascript
// Programmatic control
VirtualFit.open();       // Open the widget
VirtualFit.close();      // Close the widget
VirtualFit.toggle();     // Toggle open/close

// Set a garment to try on
VirtualFit.setGarment('https://example.com/shirt.png');

// Customize theme at runtime
VirtualFit.setTheme({
  primaryColor: '#ff6600',
  fontFamily: 'Helvetica, sans-serif'
});

// Listen to events
VirtualFit.on('garment-changed', (data) => {
  console.log('User changed to:', data.garment);
});

VirtualFit.on('add-to-cart', (data) => {
  console.log('Add to cart clicked for:', data.productId);
  // Hook into your cart system here
});

VirtualFit.on('screenshot', (data) => {
  console.log('User took screenshot:', data.dataUrl);
});

// Re-initialize with new config
VirtualFit.init({
  shopId: 'new-shop',
  retailer: 'New Store Name',
  primaryColor: '#10B981'
});

// Remove widget completely
VirtualFit.destroy();
```

## Events

The widget dispatches custom events on `window`:

| Event | Detail | Description |
|-------|--------|-------------|
| `virtualfit:ready` | `{}` | Widget loaded and ready |
| `virtualfit:garment-changed` | `{ garment: {...} }` | User changed garment |
| `virtualfit:screenshot` | `{ dataUrl: string }` | User captured screenshot |
| `virtualfit:add-to-cart` | `{ productId: string }` | User clicked add-to-cart |

```javascript
window.addEventListener('virtualfit:add-to-cart', (e) => {
  addToCart(e.detail.productId);
});
```

## Shopify Integration

1. Go to **Online Store → Themes → Edit code**
2. Open `theme.liquid`
3. Add before `</body>`:

```html
<script 
  src="https://cdn.virtualfit.io/embed.js"
  data-retailer="{{ shop.name }}"
  data-shop-id="{{ shop.permanent_domain }}"
  data-color="#6C5CE7">
</script>
```

4. Save and preview

## WooCommerce Integration

Add to your theme's `functions.php`:

```php
add_action('wp_footer', function() {
  echo '<script 
    src="https://cdn.virtualfit.io/embed.js"
    data-retailer="' . esc_attr(get_bloginfo('name')) . '"
    data-color="#6C5CE7">
  </script>';
});
```

## Self-Hosting

If you prefer to self-host:

```bash
# Download
curl -O https://cdn.virtualfit.io/embed.js

# Or via npm
npm install virtualfit-embed
```

Then include from your own CDN:

```html
<script src="/your-cdn/embed.js" data-retailer="Your Store"></script>
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+
- iOS Safari 13+
- Android Chrome 80+

Requires camera access for try-on functionality.

## Privacy

- All camera processing happens in the browser
- No video is uploaded or stored
- Analytics only track widget opens/closes, not personal data

## License

MIT License - see [LICENSE](LICENSE)

---

**Powered by [VirtualFit](https://wonderful-sky-0513a3610.7.azurestaticapps.net)** - Virtual try-on for the web
