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
        if (window.VirtualFit) {
          if (garmentImage) {
            window.VirtualFit.setGarment(garmentImage);
          }
          window.VirtualFit.open();
        } else {
          // Fallback: open mirror in new tab
          var base = 'https://wonderful-sky-0513a3610.7.azurestaticapps.net';
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
