// ==UserScript==
// @name         Article Unlock
// @namespace    https://tools.javagrant.ac.nz
// @version      1.0
// @description  Floating button to access paywalled academic articles via UoA Open Athens proxy or Anna's Archive
// @author       JavaGT
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL   https://gist.githubusercontent.com/JavaGT/ba5ef27b2f7047ecc9fc4e73182aa8c9/raw/unlock-article.user.js
// @downloadURL https://gist.githubusercontent.com/JavaGT/ba5ef27b2f7047ecc9fc4e73182aa8c9/raw/unlock-article.user.js
// ==/UserScript==

(function() {
  'use strict';

  if (window.__UNLOCK_ARTICLE__) return;
  window.__UNLOCK_ARTICLE__ = true;
  if (window !== window.top) return;

  var AT_HOST = 'go.openathens.net';
  var AT_PATH = '/redirector/auckland.ac.nz';
  var ANNAS = 'https://annas-archive.org';

  var WINDOW_ID = 'unlock-article-window';

  function isAcademicUrl(url) {
    var academic = [
      'doi.org', 'sciencedirect', 'springer', 'jstor', 'taylorandfrancis',
      'wiley', 'sagepub', 'oxfordjournals', 'cambridge.org',
      'nature.com', 'bmj.com', 'ieee.org', 'acm.org', 'pubmed',
      'ncbi.nlm.nih.gov', 'researchgate', 'semanticscholar',
      'proquest', 'ebscohost', 'oecd-ilibrary', 'degruyter',
    ];
    for (var i = 0; i < academic.length; i++) {
      if (url.indexOf(academic[i]) !== -1) return true;
    }
    return false;
  }

  function extractDOI(text) {
    var m = text && text.match(/\b10\.\d{4,9}\/[-._;()\/:A-Za-z0-9]+/);
    return m ? m[0] : null;
  }

  function findDOI() {
    var doi = extractDOI(window.location.href);
    if (doi) return doi;
    doi = extractDOI(document.title);
    if (doi) return doi;
    var meta = document.querySelector('meta[name="citation_doi"]');
    if (meta) return meta.getAttribute('content');
    var body = document.body && document.body.innerText;
    if (body) {
      doi = extractDOI(body.slice(0, 5000));
      if (doi) return doi;
    }
    return null;
  }

  function proxyUrl(url) {
    return 'https://' + AT_HOST + AT_PATH + '?url=' + encodeURIComponent(url);
  }

  function buildWindow() {
    var win = document.createElement('div');
    win.id = WINDOW_ID;
    var s = win.style;
    s.position = 'fixed';
    s.bottom = '16px';
    s.right = '16px';
    s.zIndex = 999999;
    s.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    s.fontSize = '13px';
    s.display = 'flex';
    s.flexDirection = 'column';
    s.gap = '6px';
    s.alignItems = 'flex-end';

    var doi = findDOI();

    var btnUoA = document.createElement('button');
    btnUoA.textContent = '\ud83d\udd12 Unlock via UoA';
    btnUoA.title = 'Redirect through University of Auckland Open Athens proxy';
    btnUoA.style.cssText = [
      'padding:8px 14px',
      'background:#0f766e',
      'color:#fff',
      'border:none',
      'borderRadius:8px',
      'cursor:pointer',
      'fontSize:13px',
      'fontWeight:600',
      'fontFamily:inherit',
      'boxShadow:0 2px 8px rgba(0,0,0,0.2)',
      'transition:background 0.15s',
    ].join(';');
    btnUoA.addEventListener('mouseenter', function() { btnUoA.style.background = '#14b8a6'; });
    btnUoA.addEventListener('mouseleave', function() { btnUoA.style.background = '#0f766e'; });
    btnUoA.addEventListener('click', function() {
      location.href = proxyUrl(location.href);
    });

    win.appendChild(btnUoA);

    var btnAnnas = document.createElement('button');
    btnAnnas.textContent = '\ud83d\udd0d Search Anna\'s Archive';
    btnAnnas.title = 'Look up this article on Anna\'s Archive';
    btnAnnas.style.cssText = [
      'padding:6px 12px',
      'background:transparent',
      'color:#1c1917',
      'border:1px solid #d4d4d4',
      'borderRadius:8px',
      'cursor:pointer',
      'fontSize:12px',
      'fontFamily:inherit',
      'boxShadow:0 2px 6px rgba(0,0,0,0.1)',
      'transition:background 0.15s',
    ].join(';');
    btnAnnas.addEventListener('mouseenter', function() { btnAnnas.style.background = '#f5f5f4'; });
    btnAnnas.addEventListener('mouseleave', function() { btnAnnas.style.background = 'transparent'; });

    if (doi) {
      btnAnnas.addEventListener('click', function() {
        window.open(ANNAS + '/scidb/' + doi, '_blank');
      });
    } else {
      btnAnnas.style.display = 'none';
    }

    win.appendChild(btnAnnas);

    document.body.appendChild(win);
  }

  function shouldShow() {
    if (isAcademicUrl(window.location.href)) return true;
    if (findDOI()) return true;

    var txt = (document.title || '') + ' ' + (document.body ? document.body.innerText.slice(0, 3000) : '');
    var keywords = ['article', 'paper', 'research', 'journal', 'abstract', 'full text', 'paywall'];
    for (var i = 0; i < keywords.length; i++) {
      if (txt.toLowerCase().indexOf(keywords[i]) !== -1) return true;
    }
    return false;
  }

  function init() {
    if (!shouldShow()) return;

    if (GM_registerMenuCommand) {
      GM_registerMenuCommand('Unlock this page via UoA', function() {
        location.href = proxyUrl(location.href);
      });
      var doi = findDOI();
      if (doi) {
        GM_registerMenuCommand('Search on Anna\'s Archive', function() {
          window.open(ANNAS + '/scidb/' + doi, '_blank');
        });
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildWindow);
    } else {
      buildWindow();
    }
  }

  init();
})();
