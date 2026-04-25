/**
 * <virtualfit-button> Web Component
 * 
 * Usage on Shopify product pages:
 *   <virtualfit-button
 *     product-id="123"
 *     garment-image="https://cdn.shopify.com/.../product.jpg"
 *     shop-id="my-store">
 *     👕 Try It On
 *   </virtualfit-button>
 * 
 * Requires embed.js to be loaded on the page.
 */
(function() {
  'use strict';

  class VirtualFitButton extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      var productId = this.getAttribute('product-id') || '';
      var garmentImage = this.getAttribute('garment-image') || '';
      var shopId = this.getAttribute('shop-id') || '';
      var color = this.getAttribute('color') || '#6C5CE7';

      this.shadowRoot.innerHTML = [
        '<style>',
        '  :host { display: inline-block; }',
        '  button {',
        '    background: ' + color + ';',
        '    color: #fff;',
        '    border: none;',
        '    border-radius: 8px;',
        '    padding: 12px 20px;',
        '    font-size: 14px;',
        '    font-weight: 600;',
        '    font-family: inherit;',
        '    cursor: pointer;',
        '    display: flex;',
        '    align-items: center;',
        '    gap: 6px;',
        '    transition: transform 0.15s, opacity 0.15s;',
        '  }',
        '  button:hover { transform: scale(1.03); opacity: 0.9; }',
        '  button:active { transform: scale(0.98); }',
        '</style>',
        '<button><slot>\uD83D\uDC55 Try It On</slot></button>',
      ].join('\n');

      this.shadowRoot.querySelector('button').addEventListener('click', function() {
        // Phase 7.68: prefer the per-product API (tryOnProduct) when
        // available. Pre-7.68 the click did setGarment(garmentImage)
        // then open() — two separate operations, no productId
        // tracking, and the per-PDP analytics event from 7.62
        // (try_on_product) never fired. With multiple buttons on a
        // Shopify collection grid this also raced (setGarment from
        // button A, then setGarment from button B, then open() from
        // button A — wrong garment shown). tryOnProduct atomically
        // updates BOTH garmentImage + productId on config, rebuilds
        // the iframe src once, and opens. Falls back to the legacy
        // setGarment+open path on older embed.js versions that don't
        // expose tryOnProduct yet.
        if (window.VirtualFit && typeof window.VirtualFit.tryOnProduct === 'function') {
          window.VirtualFit.tryOnProduct({
            garmentImage: garmentImage,
            productId: productId,
          });
          return;
        }
        if (window.VirtualFit) {
          if (garmentImage) {
            window.VirtualFit.setGarment(garmentImage);
          }
          window.VirtualFit.open();
        } else {
          // Fallback: open mirror in new tab. Phase 7.68: derive base
          // from the document's loading <script src=...> origin so dev
          // (localhost), Azure SWA preview, and retailer-CDN-proxied
          // bundles work. Pre-7.68 this was hardcoded to the prod URL
          // which made the web component cross-origin in every other
          // environment (same bug as 7.67 fixed in embed.js).
          var base = (function() {
            try {
              var s = document.currentScript;
              if (!s) {
                var all = document.getElementsByTagName('script');
                for (var i = all.length - 1; i >= 0; i--) {
                  var src = all[i].src || '';
                  if (src.indexOf('virtualfit-button') !== -1 || src.indexOf('embed.js') !== -1) {
                    s = all[i];
                    break;
                  }
                }
              }
              if (s && s.src) return new URL(s.src).origin;
            } catch (e) { /* fall through */ }
            return 'https://virtualfit.app';
          })();
          var params = new URLSearchParams();
          params.set('embed', 'true');
          if (shopId) params.set('shopId', shopId);
          if (productId) params.set('productId', productId);
          if (garmentImage) params.set('garmentImage', garmentImage);
          window.open(base + '/mirror/?' + params.toString(), '_blank');
        }
      });
    }
  }

  if (!customElements.get('virtualfit-button')) {
    customElements.define('virtualfit-button', VirtualFitButton);
  }
})();
