/**
 * VirtualFit Embed Widget — drop-in virtual try-on for any website.
 * 
 * Usage:
 *   <script src="https://wonderful-sky-0513a3610.7.azurestaticapps.net/embed.js"
 *     data-retailer="YourStoreName"
 *     data-position="bottom-right"
 *     data-color="#6C5CE7">
 *   </script>
 * 
 * Or manual init:
 *   VirtualFit.init({ retailer: 'YourStore', position: 'bottom-right' });
 */
(function() {
  'use strict';

  var BASE_URL = 'https://wonderful-sky-0513a3610.7.azurestaticapps.net';
  var WIDGET_ID = 'virtualfit-widget';
  
  // Read config from script tag attributes
  var script = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var config = {
    retailer: script.getAttribute('data-retailer') || '',
    position: script.getAttribute('data-position') || 'bottom-right',
    color: script.getAttribute('data-color') || '#6C5CE7',
    buttonText: script.getAttribute('data-button-text') || '👕 Try It On',
    width: script.getAttribute('data-width') || '400',
    height: script.getAttribute('data-height') || '650',
  };

  function createStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '#' + WIDGET_ID + '-btn {',
      '  position: fixed;',
      '  ' + (config.position.includes('right') ? 'right: 20px' : 'left: 20px') + ';',
      '  ' + (config.position.includes('top') ? 'top: 20px' : 'bottom: 20px') + ';',
      '  z-index: 99999;',
      '  background: ' + config.color + ';',
      '  color: #fff;',
      '  border: none;',
      '  border-radius: 50px;',
      '  padding: 14px 24px;',
      '  font-size: 15px;',
      '  font-weight: 700;',
      '  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;',
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

  function createWidget() {
    // Floating button
    var btn = document.createElement('button');
    btn.id = WIDGET_ID + '-btn';
    btn.innerHTML = config.buttonText;
    btn.onclick = togglePanel;
    document.body.appendChild(btn);

    // Panel with iframe
    var panel = document.createElement('div');
    panel.id = WIDGET_ID + '-panel';
    panel.innerHTML = [
      '<button id="' + WIDGET_ID + '-close" onclick="document.getElementById(\'' + WIDGET_ID + '-panel\').classList.remove(\'open\')">✕</button>',
      '<iframe src="' + BASE_URL + '/mirror/?embed=true&retailer=' + encodeURIComponent(config.retailer) + '" allow="camera *; microphone" loading="lazy"></iframe>',
    ].join('');
    document.body.appendChild(panel);
  }

  function togglePanel() {
    var panel = document.getElementById(WIDGET_ID + '-panel');
    if (panel) {
      panel.classList.toggle('open');
    }
    // Track widget open
    try {
      fetch(BASE_URL + '/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'widget-open@' + (config.retailer || 'unknown'),
          source: 'embed-widget',
          killerFeature: 'widget opened on ' + window.location.hostname,
        }),
      }).catch(function() {});
    } catch(e) {}
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      createStyles();
      createWidget();
    });
  } else {
    createStyles();
    createWidget();
  }

  // Public API
  window.VirtualFit = {
    init: function(opts) {
      Object.assign(config, opts || {});
      createStyles();
      createWidget();
    },
    open: function() { togglePanel(); },
    close: function() {
      var panel = document.getElementById(WIDGET_ID + '-panel');
      if (panel) panel.classList.remove('open');
    },
  };
})();
