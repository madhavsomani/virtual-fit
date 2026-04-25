/**
 * VirtualFit Embed Widget v2 — drop-in virtual try-on for any website.
 * 
 * Usage:
 *   <script src="https://virtualfit.app/embed.js"
 *     data-shop-id="my-store-123"
 *     data-retailer="YourStoreName"
 *     data-position="bottom-right"
 *     data-color="#6C5CE7"
 *     data-font-family="system-ui"
 *     data-button-radius="50">
 *   </script>
 * 
 * Or manual init:
 *   VirtualFit.init({ shopId: 'my-store', retailer: 'Your Store', primaryColor: '#ff6600' });
 * 
 * PostMessage API (parent ↔ iframe):
 *   iframe → parent: { type: 'virtualfit:ready' }
 *   iframe → parent: { type: 'virtualfit:garment-changed', garment: {...} }
 *   iframe → parent: { type: 'virtualfit:screenshot', dataUrl: '...' }
 *   iframe → parent: { type: 'virtualfit:close' }
 *   parent → iframe: { type: 'virtualfit:set-garment', garmentUrl: '...' }
 *   parent → iframe: { type: 'virtualfit:set-theme', theme: {...} }
 */
(function() {
  'use strict';

  var BASE_URL = 'https://virtualfit.app';
  var WIDGET_ID = 'virtualfit-widget';
  var VERSION = '2.0.0';
  
  // Read config from script tag attributes
  var script = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var config = {
    shopId: script.getAttribute('data-shop-id') || script.getAttribute('data-retailer') || '',
    retailer: script.getAttribute('data-retailer') || '',
    position: script.getAttribute('data-position') || 'bottom-right',
    color: script.getAttribute('data-color') || '#6C5CE7',
    fontFamily: script.getAttribute('data-font-family') || '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    buttonText: script.getAttribute('data-button-text') || '\uD83D\uDC55 Try It On',
    buttonRadius: script.getAttribute('data-button-radius') || '50',
    width: script.getAttribute('data-width') || '400',
    height: script.getAttribute('data-height') || '650',
    productId: script.getAttribute('data-product-id') || '',
    garmentImage: script.getAttribute('data-garment-image') || '',
  };

  // Build iframe URL with theming params
  function buildIframeUrl() {
    var params = new URLSearchParams();
    params.set('embed', 'true');
    if (config.shopId) params.set('shopId', config.shopId);
    if (config.retailer) params.set('retailer', config.retailer);
    if (config.color) params.set('primaryColor', config.color);
    if (config.productId) params.set('productId', config.productId);
    if (config.garmentImage) params.set('garmentImage', config.garmentImage);
    return BASE_URL + '/mirror/?' + params.toString();
  }

  function createStyles() {
    var style = document.createElement('style');
    style.id = WIDGET_ID + '-styles';
    style.textContent = [
      '#' + WIDGET_ID + '-btn {',
      '  position: fixed;',
      '  ' + (config.position.includes('right') ? 'right: 20px' : 'left: 20px') + ';',
      '  ' + (config.position.includes('top') ? 'top: 20px' : 'bottom: 20px') + ';',
      '  z-index: 99999;',
      '  background: ' + config.color + ';',
      '  color: #fff;',
      '  border: none;',
      '  border-radius: ' + config.buttonRadius + 'px;',
      '  padding: 14px 24px;',
      '  font-size: 15px;',
      '  font-weight: 700;',
      '  font-family: ' + config.fontFamily + ';',
      '  cursor: pointer;',
      '  box-shadow: 0 4px 20px rgba(0,0,0,0.3);',
      '  transition: transform 0.2s, box-shadow 0.2s;',
      '  display: flex; align-items: center; gap: 8px;',
      '}',
      '#' + WIDGET_ID + '-btn:hover {',
      '  transform: scale(1.05);',
      '  box-shadow: 0 6px 28px rgba(0,0,0,0.4);',
      '}',
      '#' + WIDGET_ID + '-panel {',
      '  position: fixed;',
      '  ' + (config.position.includes('right') ? 'right: 20px' : 'left: 20px') + ';',
      '  ' + (config.position.includes('top') ? 'top: 80px' : 'bottom: 80px') + ';',
      '  z-index: 99999;',
      '  width: ' + config.width + 'px;',
      '  height: ' + config.height + 'px;',
      '  max-width: calc(100vw - 40px);',
      '  max-height: calc(100vh - 120px);',
      '  border-radius: 16px;',
      '  overflow: hidden;',
      '  box-shadow: 0 8px 40px rgba(0,0,0,0.5);',
      '  display: none;',
      '  background: #0c0c0e;',
      '  position: fixed;',
      '}',
      '#' + WIDGET_ID + '-panel.open { display: block; }',
      '#' + WIDGET_ID + '-panel iframe {',
      '  width: 100%; height: 100%; border: none;',
      '}',
      '#' + WIDGET_ID + '-close {',
      '  position: absolute; top: 8px; right: 12px;',
      '  z-index: 100000;',
      '  background: rgba(0,0,0,0.6); color: #fff;',
      '  border: none; border-radius: 50%;',
      '  width: 32px; height: 32px;',
      '  font-size: 16px; cursor: pointer;',
      '  display: flex; align-items: center; justify-content: center;',
      '}',
      '@media (max-width: 480px) {',
      '  #' + WIDGET_ID + '-panel {',
      '    width: calc(100vw - 16px) !important;',
      '    height: calc(100vh - 100px) !important;',
      '    left: 8px !important; right: 8px !important;',
      '    bottom: 72px !important;',
      '    border-radius: 12px;',
      '  }',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  var iframeEl = null;

  function createWidget() {
    // Don't create duplicate widgets
    if (document.getElementById(WIDGET_ID + '-btn')) return;

    // Floating button
    var btn = document.createElement('button');
    btn.id = WIDGET_ID + '-btn';
    btn.innerHTML = config.buttonText;
    btn.onclick = togglePanel;
    document.body.appendChild(btn);

    // Panel with iframe
    var panel = document.createElement('div');
    panel.id = WIDGET_ID + '-panel';
    
    var closeBtn = document.createElement('button');
    closeBtn.id = WIDGET_ID + '-close';
    closeBtn.textContent = '\u2715';
    closeBtn.onclick = closePanel;
    panel.appendChild(closeBtn);

    iframeEl = document.createElement('iframe');
    iframeEl.src = buildIframeUrl();
    iframeEl.allow = 'camera *; microphone';
    iframeEl.loading = 'lazy';
    // Note: sandbox removed — it blocks camera access on iOS Safari embeds
    // iframeEl.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-camera');
    panel.appendChild(iframeEl);

    document.body.appendChild(panel);
  }

  function openPanel() {
    var panel = document.getElementById(WIDGET_ID + '-panel');
    if (panel) panel.classList.add('open');
    trackEvent('widget_opened');
  }

  function closePanel() {
    var panel = document.getElementById(WIDGET_ID + '-panel');
    if (panel) panel.classList.remove('open');
    trackEvent('widget_closed');
  }

  function togglePanel() {
    var panel = document.getElementById(WIDGET_ID + '-panel');
    if (panel) {
      if (panel.classList.contains('open')) {
        closePanel();
      } else {
        openPanel();
      }
    }
  }

  // --- Cross-origin postMessage protocol ---
  function handleMessage(event) {
    // Only accept messages from our iframe origin
    if (event.origin !== new URL(BASE_URL).origin) return;
    
    var data = event.data;
    if (!data || typeof data.type !== 'string' || !data.type.startsWith('virtualfit:')) return;

    switch (data.type) {
      case 'virtualfit:ready':
        // Iframe is loaded and ready — send theme config. Phase 7.65:
        // mirror only consumes primaryColor; fontFamily/buttonRadius/
        // shopId postMessage fields were unread (mirror's set-theme
        // handler reads only data.theme.primaryColor). Stripped.
        sendToIframe({ type: 'virtualfit:set-theme', theme: {
          primaryColor: config.color,
        }});
        dispatchCustomEvent('virtualfit:ready', {});
        break;
      case 'virtualfit:close':
        closePanel();
        break;
      case 'virtualfit:garment-changed':
        dispatchCustomEvent('virtualfit:garment-changed', data);
        trackEvent('garment_changed', { garment: data.garment });
        break;
      case 'virtualfit:screenshot':
        dispatchCustomEvent('virtualfit:screenshot', { dataUrl: data.dataUrl });
        break;
      case 'virtualfit:add-to-cart':
        dispatchCustomEvent('virtualfit:add-to-cart', data);
        trackEvent('add_to_cart', { productId: data.productId });
        break;
    }
  }

  function sendToIframe(msg) {
    if (iframeEl && iframeEl.contentWindow) {
      iframeEl.contentWindow.postMessage(msg, BASE_URL);
    }
  }

  function dispatchCustomEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch(e) {}
  }

  // --- Analytics tracking ---
  function trackEvent(eventName, data) {
    try {
      fetch(BASE_URL + '/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'event@' + (config.shopId || config.retailer || 'unknown'),
          source: 'embed-widget',
          revenue: eventName,
          killerFeature: JSON.stringify(Object.assign({ 
            host: window.location.hostname,
            shopId: config.shopId,
            version: VERSION,
          }, data || {})),
        }),
      }).catch(function() {});
    } catch(e) {}
  }

  // --- Lifecycle ---
  window.addEventListener('message', handleMessage);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      createStyles();
      createWidget();
    });
  } else {
    createStyles();
    createWidget();
  }

  // --- Public API ---
  window.VirtualFit = {
    version: VERSION,
    config: config,
    init: function(opts) {
      Object.assign(config, opts || {});
      // Remove old widget if re-initializing
      var old = document.getElementById(WIDGET_ID + '-btn');
      if (old) old.remove();
      var oldPanel = document.getElementById(WIDGET_ID + '-panel');
      if (oldPanel) oldPanel.remove();
      var oldStyles = document.getElementById(WIDGET_ID + '-styles');
      if (oldStyles) oldStyles.remove();
      createStyles();
      createWidget();
    },
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    setGarment: function(garmentUrl) {
      sendToIframe({ type: 'virtualfit:set-garment', garmentUrl: garmentUrl });
    },
    // Phase 7.62: per-product try-on. Updates config.garmentImage +
    // config.productId, rebuilds the iframe URL (only if garmentImage
    // changed — a re-load triggers another segformer→TRELLIS pipeline
    // run, 30-90s, HF Spaces quota), then opens the panel. Wire your
    // product cards' onclick to this for a real per-PDP try-on flow.
    tryOnProduct: function(opts) {
      opts = opts || {};
      var newImg = opts.garmentImage || '';
      var newPid = opts.productId || '';
      var changed = newImg && newImg !== config.garmentImage;
      config.garmentImage = newImg;
      config.productId = newPid;
      if (changed && iframeEl) {
        iframeEl.src = buildIframeUrl();
      }
      openPanel();
      trackEvent('try_on_product', { productId: newPid, garmentImage: newImg });
    },
    setTheme: function(theme) {
      sendToIframe({ type: 'virtualfit:set-theme', theme: theme });
    },
    on: function(eventName, callback) {
      window.addEventListener('virtualfit:' + eventName, function(e) {
        callback(e.detail);
      });
    },
    destroy: function() {
      window.removeEventListener('message', handleMessage);
      var btn = document.getElementById(WIDGET_ID + '-btn');
      if (btn) btn.remove();
      var panel = document.getElementById(WIDGET_ID + '-panel');
      if (panel) panel.remove();
      var styles = document.getElementById(WIDGET_ID + '-styles');
      if (styles) styles.remove();
    },
  };
})();
