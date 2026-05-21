// ==UserScript==
// @name         Canvas SpeedGrader Scorer
// @namespace    https://tools.javagrant.ac.nz
// @version      1.3
// @description  Floating scoring window for Canvas SpeedGrader — track assignment scores across custom variables in localStorage
// @author       JavaGT
// @match        https://canvas.auckland.ac.nz/courses/*/gradebook/speed_grader
// @match        https://canvas.auckland.ac.nz/courses/*/gradebook/speed_grader?*
// @grant        none
// @updateURL   https://gist.githubusercontent.com/JavaGT/ba5ef27b2f7047ecc9fc4e73182aa8c9/raw/canvas-scorer.user.js
// @downloadURL https://gist.githubusercontent.com/JavaGT/ba5ef27b2f7047ecc9fc4e73182aa8c9/raw/canvas-scorer.user.js
// ==/UserScript==

(function() {
  'use strict';

  if (window !== window.top) return;

  var STORAGE_KEY = 'canvas_sg_scores';
  var VARS_KEY = 'canvas_sg_variables';
  var COMMENTS_KEY = 'canvas_sg_comments';
  var WINDOW_ID = 'canvas-scorer-window';

  var scores = {};
  var variables = [];
  var commentsStore = {};
  var commentDraft = '';
  var commentPopover = null;
  var win = null;
  var dragState = null;

  function extractIds() {
    var m = window.location.pathname.match(/\/courses\/(\d+)\/gradebook\/speed_grader/);
    if (!m) return null;
    var params = new URLSearchParams(window.location.search);
    return {
      course_id: m[1],
      assignment_id: params.get('assignment_id'),
      student_id: params.get('student_id'),
      anonymous_id: params.get('anonymous_id'),
    };
  }

  function load() {
    try {
      var d = localStorage.getItem(STORAGE_KEY);
      if (d) scores = JSON.parse(d);
    } catch (_) { scores = {}; }
    try {
      var v = localStorage.getItem(VARS_KEY);
      if (v) variables = JSON.parse(v);
    } catch (_) { variables = []; }
    try {
      var c = localStorage.getItem(COMMENTS_KEY);
      if (c) commentsStore = JSON.parse(c);
    } catch (_) { commentsStore = {}; }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scores)); } catch (_) {}
    try { localStorage.setItem(VARS_KEY, JSON.stringify(variables)); } catch (_) {}
    try { localStorage.setItem(COMMENTS_KEY, JSON.stringify(commentsStore)); } catch (_) {}
  }

  function addComment(varName, score, text) {
    text = text.trim();
    if (!text) return false;
    if (!commentsStore[varName]) commentsStore[varName] = {};
    if (!commentsStore[varName][score]) commentsStore[varName][score] = [];
    if (commentsStore[varName][score].indexOf(text) === -1) {
      commentsStore[varName][score].push(text);
    }
    save();
    return true;
  }

  function getCommentsForScoreRange(varName, score) {
    var results = [];
    if (!commentsStore[varName]) return results;
    for (var s = score - 1; s <= score + 1; s++) {
      if (commentsStore[varName][s] && commentsStore[varName][s].length) {
        commentsStore[varName][s].forEach(function(c) {
          results.push({ score: s, text: c });
        });
      }
    }
    return results;
  }

  function getAssignmentKey(ids) {
    return ids.course_id + ':' + ids.assignment_id;
  }

  function getAssignmentScores(ids) {
    var key = getAssignmentKey(ids);
    if (!scores[key]) scores[key] = {};
    return scores[key];
  }

  function historyForVariable(varName) {
    var ids = extractIds();
    if (!ids) return [];
    var currentKey = getAssignmentKey(ids);
    var h = [];
    for (var key in scores) {
      if (key === currentKey) continue;
      if (scores[key] && scores[key][varName] !== undefined && scores[key][varName] !== null) {
        h.push({ assignmentKey: key, score: scores[key][varName] });
      }
    }
    h.sort(function(a, b) { return a.assignmentKey.localeCompare(b.assignmentKey); });
    return h;
  }

  function addVariable(name) {
    name = name.trim();
    if (!name) return false;
    if (variables.indexOf(name) !== -1) return false;
    variables.push(name);
    save();
    return true;
  }

  function removeVariable(name) {
    var idx = variables.indexOf(name);
    if (idx === -1) return;
    variables.splice(idx, 1);
    for (var key in scores) {
      if (scores[key] && scores[key][name] !== undefined) {
        delete scores[key][name];
      }
    }
    save();
  }

  function renderWindow(ids) {
    if (!win) return;
    var assignmentKey = getAssignmentKey(ids);
    var currentScores = getAssignmentScores(ids);

    var titleHtml = 'Scorer';
    var subtitleHtml = '';
    if (ids.assignment_id) {
      subtitleHtml = '<span style="font-size:11px;opacity:0.7;font-weight:400;">Assignment ' + ids.assignment_id + ' &middot; Student ' + (ids.student_id || ids.anonymous_id || '?') + '</span>';
    }

    var rowsHtml = '';
    variables.forEach(function(v) {
      var checked = currentScores[v] !== undefined && currentScores[v] !== null;
      var val = checked ? currentScores[v] : 3;
      var hist = historyForVariable(v);
      var histHtml = '';
      if (hist.length) {
        var vals = hist.map(function(h) { return h.score; });
        var avg = (vals.reduce(function(a, b) { return a + b; }, 0) / vals.length).toFixed(1);
        histHtml = '<div style="font-size:10px;color:#a8a29e;margin-top:2px;">prev: ' + vals.join(', ') + ' &middot; avg ' + avg + '</div>';
      }
      rowsHtml +=
        '<div style="margin-bottom:10px;">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
        '<input type="checkbox" class="cv-check" data-var="' + escapeHtml(v) + '" ' + (checked ? 'checked' : '') + ' style="accent-color:#0f766e;cursor:pointer;">' +
        '<label style="flex:1;font-size:13px;font-weight:500;color:#1c1917;">' + escapeHtml(v) + '</label>' +
        '<input type="range" min="1" max="5" step="1" class="cv-slider" data-var="' + escapeHtml(v) + '" value="' + val + '" ' + (!checked ? 'disabled' : '') + ' style="width:60px;accent-color:#0f766e;cursor:pointer;">' +
        '<span class="cv-val" data-var="' + escapeHtml(v) + '" style="font-size:13px;font-weight:600;color:#0f766e;min-width:14px;text-align:center;">' + (checked ? val : '&ndash;') + '</span>' +
        '<button class="cv-comment-btn" data-var="' + escapeHtml(v) + '" style="background:none;border:none;cursor:pointer;font-size:14px;color:#a8a29e;line-height:1;padding:0 2px;" title="Comment options">&oplus;</button>' +
        '<button class="cv-del-var" data-var="' + escapeHtml(v) + '" style="background:none;border:none;cursor:pointer;font-size:16px;color:#a8a29e;line-height:1;padding:0 2px;" title="Remove variable">&times;</button>' +
        '</div>' +
        histHtml +
        '</div>';
    });

    if (!variables.length) {
      rowsHtml = '<div style="font-size:12px;color:#a8a29e;font-style:italic;text-align:center;padding:16px 0;">No variables yet. Add one below.</div>';
    }

    win.innerHTML =
      '<div id="cv-header" style="padding:10px 14px;background:#0f766e;color:white;border-radius:10px 10px 0 0;cursor:move;user-select:none;display:flex;justify-content:space-between;align-items:flex-start;">' +
      '<div><div style="font-size:14px;font-weight:700;">' + titleHtml + '</div>' + subtitleHtml + '</div>' +
      '<button id="cv-close" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;line-height:1;padding:0;">&times;</button>' +
      '</div>' +
      '<div style="padding:12px 14px;overflow-y:auto;max-height:400px;">' +
      rowsHtml +
      '</div>' +
      '<div style="padding:8px 14px;border-top:1px solid #e7e5e4;">' +
      '<div style="display:flex;gap:6px;">' +
      '<input id="cv-new-var" type="text" placeholder="New variable name" style="flex:1;padding:6px 8px;border:1px solid #d4d4d4;border-radius:4px;font-size:12px;outline:none;">' +
      '<button id="cv-add-var" style="padding:6px 12px;background:#0f766e;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Add</button>' +
      '</div>' +
      '</div>' +
      '<div style="padding:8px 14px 12px;border-top:1px solid #e7e5e4;">' +
      '<textarea id="cv-draft" placeholder="Comment draft&hellip;" style="width:100%;min-height:40px;padding:6px 8px;border:1px solid #d4d4d4;border-radius:4px;font-size:12px;font-family:inherit;resize:vertical;box-sizing:border-box;outline:none;">' + escapeHtml(commentDraft) + '</textarea>' +
      '<div style="display:flex;gap:4px;margin-top:4px;">' +
      '<button id="cv-copy-draft" style="padding:4px 10px;background:#0f766e;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;">Copy</button>' +
      '<button id="cv-clear-draft" style="padding:4px 10px;background:transparent;color:#a8a29e;border:1px solid #d4d4d4;border-radius:4px;cursor:pointer;font-size:11px;">Clear</button>' +
      '</div>' +
      '<div style="font-size:10px;color:#a8a29e;margin-top:4px;">Click &#8853; next to a variable for comment options</div>' +
      '</div>';

    win.querySelector('#cv-close').addEventListener('click', closeWindow);

    var header = win.querySelector('#cv-header');
    header.addEventListener('mousedown', startDrag);
    header.addEventListener('touchstart', startDragTouch, { passive: false });

    win.querySelectorAll('.cv-check').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var varName = cb.getAttribute('data-var');
        var slider = win.querySelector('.cv-slider[data-var="' + escapeHtml(varName) + '"]');
        var valSpan = win.querySelector('.cv-val[data-var="' + escapeHtml(varName) + '"]');
        if (cb.checked) {
          slider.disabled = false;
          var n = parseInt(slider.value, 10);
          currentScores[varName] = n;
          valSpan.textContent = n;
        } else {
          slider.disabled = true;
          currentScores[varName] = null;
          valSpan.innerHTML = '&ndash;';
        }
        save();
      });
    });

    win.querySelectorAll('.cv-slider').forEach(function(slider) {
      slider.addEventListener('input', function() {
        if (slider.disabled) return;
        var varName = slider.getAttribute('data-var');
        var n = parseInt(slider.value, 10);
        currentScores[varName] = n;
        var valSpan = win.querySelector('.cv-val[data-var="' + escapeHtml(varName) + '"]');
        if (valSpan) valSpan.textContent = n;
        save();
      });
    });

    win.querySelectorAll('.cv-del-var').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var varName = btn.getAttribute('data-var');
        if (confirm('Remove variable "' + varName + '" and all its scores?')) {
          removeVariable(varName);
          renderWindow(ids);
        }
      });
    });

    win.querySelector('#cv-add-var').addEventListener('click', function() {
      var inp = win.querySelector('#cv-new-var');
      var name = inp.value.trim();
      if (!name) return;
      if (!addVariable(name)) { return; }
      inp.value = '';
      renderWindow(ids);
    });

    win.querySelector('#cv-new-var').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        win.querySelector('#cv-add-var').click();
      }
    });

    win.querySelectorAll('.cv-comment-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        var varName = btn.getAttribute('data-var');
        var checked = currentScores[varName] !== undefined && currentScores[varName] !== null;
        var score = checked ? currentScores[varName] : null;
        showCommentPopover(btn, varName, score, ids);
      });
    });

    var draftTa = win.querySelector('#cv-draft');
    draftTa.addEventListener('input', function() {
      commentDraft = draftTa.value;
    });

    win.querySelector('#cv-copy-draft').addEventListener('click', function() {
      var text = win.querySelector('#cv-draft').value;
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    });

    win.querySelector('#cv-clear-draft').addEventListener('click', function() {
      commentDraft = '';
      win.querySelector('#cv-draft').value = '';
    });

    document.addEventListener('click', function(e) {
      if (commentPopover && !commentPopover.contains(e.target) && !e.target.closest('.cv-comment-btn')) {
        hideCommentPopover();
      }
    });
  }

  function showCommentPopover(anchor, varName, score, ids) {
    hideCommentPopover();
    commentPopover = document.createElement('div');
    var checked = score !== null;
    var related = checked ? getCommentsForScoreRange(varName, score) : [];

    var html = '<div style="font-size:12px;font-weight:600;margin-bottom:4px;">' + escapeHtml(varName);
    if (checked) html += ' @ score ' + score;
    html += '</div>';

    if (!checked) {
      html += '<div style="font-size:11px;color:#a8a29e;font-style:italic;">Score this variable first to see related comments.</div>';
    } else if (!related.length) {
      html += '<div style="font-size:11px;color:#a8a29e;font-style:italic;">No previous comments for scores ' + (score-1) + '\u2013' + (score+1) + '.</div>';
    } else {
      html += '<div style="font-size:10px;color:#a8a29e;margin-bottom:4px;">Previous comments for scores ' + (score-1) + '\u2013' + (score+1) + ':</div>';
      related.forEach(function(r) {
        html += '<div class="cv-pick-comment" data-text="' + escapeHtml(r.text) + '" style="font-size:11px;padding:4px 6px;margin-bottom:3px;background:#f5f5f4;border-radius:4px;cursor:pointer;word-break:break-word;">[' + r.score + '] ' + escapeHtml(r.text) + '</div>';
      });
    }

    html += '<div style="margin-top:6px;border-top:1px solid #e7e5e4;padding-top:6px;">';
    if (checked) {
      html += '<div style="font-size:10px;color:#a8a29e;margin-bottom:2px;">New comment for score ' + score + ':</div>';
    } else {
      html += '<div style="font-size:10px;color:#a8a29e;margin-bottom:2px;">New comment:</div>';
    }
    html += '<textarea class="cv-new-comment-text" style="width:100%;min-height:36px;padding:4px 6px;border:1px solid #d4d4d4;border-radius:4px;font-size:11px;font-family:inherit;resize:vertical;box-sizing:border-box;outline:none;"></textarea>' +
      '<div style="display:flex;gap:4px;margin-top:4px;">' +
      '<button class="cv-save-comment" style="padding:4px 10px;background:#0f766e;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;">Save</button>' +
      '<span class="cv-comment-msg" style="font-size:10px;color:#0f766e;align-self:center;"></span>' +
      '</div></div>';

    commentPopover.innerHTML = html;
    var s = commentPopover.style;
    s.position = 'fixed';
    s.zIndex = 1000000;
    s.background = '#fff';
    s.border = '1px solid #d4d4d4';
    s.borderRadius = '8px';
    s.padding = '10px';
    s.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
    s.width = '250px';
    s.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    s.fontSize = '12px';
    s.color = '#1c1917';

    document.body.appendChild(commentPopover);

    var rect = anchor.getBoundingClientRect();
    var top = rect.bottom + 4;
    var left = Math.max(4, Math.min(rect.left, window.innerWidth - 260));
    if (top + 300 > window.innerHeight) top = Math.max(4, rect.top - 300);
    s.top = top + 'px';
    s.left = left + 'px';

    commentPopover.querySelectorAll('.cv-pick-comment').forEach(function(el) {
      el.addEventListener('click', function() {
        var text = el.getAttribute('data-text');
        var draftTa = win && win.querySelector('#cv-draft');
        if (draftTa) {
          var cur = draftTa.value;
          var sep = cur && !cur.endsWith('\n') ? '\n' : '';
          draftTa.value = cur + sep + '[' + escapeHtml(varName) + ' ' + (score || '?') + '] ' + text;
          commentDraft = draftTa.value;
        }
      });
    });

    commentPopover.querySelector('.cv-save-comment').addEventListener('click', function() {
      var ta = commentPopover.querySelector('.cv-new-comment-text');
      var text = ta.value.trim();
      var msg = commentPopover.querySelector('.cv-comment-msg');
      if (!text) { msg.textContent = 'Empty'; return; }
      var s = checked ? score : 0;
      if (addComment(varName, s, text)) {
        msg.textContent = 'Saved';
        ta.value = '';
      } else { msg.textContent = 'Exists'; }
    });
  }

  function hideCommentPopover() {
    if (commentPopover) { commentPopover.remove(); commentPopover = null; }
  }

  function startDrag(e) {
    dragState = {
      offsetX: e.clientX - win.getBoundingClientRect().left,
      offsetY: e.clientY - win.getBoundingClientRect().top,
    };
    document.addEventListener('mousemove', duringDrag);
    document.addEventListener('mouseup', endDrag);
    e.preventDefault();
  }

  function startDragTouch(e) {
    var t = e.touches[0];
    dragState = {
      offsetX: t.clientX - win.getBoundingClientRect().left,
      offsetY: t.clientY - win.getBoundingClientRect().top,
    };
    document.addEventListener('touchmove', duringDragTouch, { passive: false });
    document.addEventListener('touchend', endDragTouch);
    e.preventDefault();
  }

  function duringDrag(e) {
    if (!dragState) return;
    win.style.left = Math.max(0, Math.min(window.innerWidth - win.offsetWidth, e.clientX - dragState.offsetX)) + 'px';
    win.style.top = Math.max(0, Math.min(window.innerHeight - win.offsetHeight, e.clientY - dragState.offsetY)) + 'px';
    win.style.right = 'auto';
    win.style.bottom = 'auto';
  }

  function duringDragTouch(e) {
    if (!dragState) return;
    var t = e.touches[0];
    win.style.left = Math.max(0, Math.min(window.innerWidth - win.offsetWidth, t.clientX - dragState.offsetX)) + 'px';
    win.style.top = Math.max(0, Math.min(window.innerHeight - win.offsetHeight, t.clientY - dragState.offsetY)) + 'px';
    win.style.right = 'auto';
    win.style.bottom = 'auto';
    e.preventDefault();
  }

  function endDrag() {
    dragState = null;
    document.removeEventListener('mousemove', duringDrag);
    document.removeEventListener('mouseup', endDrag);
  }

  function endDragTouch() {
    dragState = null;
    document.removeEventListener('touchmove', duringDragTouch);
    document.removeEventListener('touchend', endDragTouch);
  }

  function openWindow(ids) {
    if (win) {
      win.style.display = 'block';
      renderWindow(ids);
      return;
    }
    win = document.createElement('div');
    win.id = WINDOW_ID;
    var s = win.style;
    s.position = 'fixed';
    s.top = '80px';
    s.right = '24px';
    s.width = '360px';
    s.background = '#fff';
    s.border = '1px solid #e7e5e4';
    s.borderRadius = '12px';
    s.boxShadow = '0 8px 30px rgba(0,0,0,0.15)';
    s.zIndex = 999999;
    s.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    s.fontSize = '13px';
    s.color = '#1c1917';
    s.boxSizing = 'border-box';

    document.body.appendChild(win);
    renderWindow(ids);
  }

  function toggleWindow(ids) {
    if (win && win.style.display !== 'none') {
      closeWindow();
    } else {
      openWindow(ids || extractIds());
    }
  }

  function closeWindow() {
    if (win) { win.style.display = 'none'; }
    var btn = document.getElementById('cv-settings-btn');
    if (btn) btn.classList.remove('cv-active');
  }

  function injectSettingsButton(ids) {
    var section = document.querySelector('[data-testid="settings-section"]');
    if (!section || document.getElementById('cv-settings-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'cv-settings-btn';
    btn.title = 'Toggle Scorer (Alt+Shift+S)';
    btn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;">' +
        '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>' +
        '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>' +
      '</svg>' +
      '<span style="margin-left:4px;font-size:12px;font-weight:600;">Scorer</span>';
    btn.style.cssText = 'display:inline-flex;align-items:center;padding:6px 12px;margin:4px 0;background:#0f766e;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit;line-height:1;';
    btn.addEventListener('click', function() {
      toggleWindow(extractIds());
      if (win && win.style.display !== 'none') {
        btn.classList.add('cv-active');
        btn.style.background = '#14b8a6';
      } else {
        btn.classList.remove('cv-active');
        btn.style.background = '#0f766e';
      }
    });
    section.appendChild(btn);

    // keep active state in sync
    var origOpen = openWindow;
    openWindow = function(oid) {
      origOpen(oid);
      var b = document.getElementById('cv-settings-btn');
      if (b) { b.classList.add('cv-active'); b.style.background = '#14b8a6'; }
    };
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function init() {
    if (!window.location.pathname.match(/\/speed_grader\/?$/)) return;
    var ids = extractIds();
    if (!ids || !ids.assignment_id) return;

    load();

    if (variables.length === 0) {
      variables = ['Clarity', 'Structure', 'Depth', 'Originality'];
      save();
    }

    openWindow(ids);

    document.addEventListener('keydown', function(e) {
      if (e.altKey && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        toggleWindow(extractIds());
        var btn = document.getElementById('cv-settings-btn');
        if (btn) {
          var isOpen = win && win.style.display !== 'none';
          btn.style.background = isOpen ? '#14b8a6' : '#0f766e';
        }
      }
    });

    // inject into settings section after DOM stabilises
    setTimeout(function() { injectSettingsButton(ids); }, 1000);

    // watch for URL changes — Canvas uses pushState between assignments
    var lastUrl = window.location.href;
    var origPushState = history.pushState;
    var origReplaceState = history.replaceState;
    history.pushState = function() {
      origPushState.apply(this, arguments);
      checkUrlChange();
    };
    history.replaceState = function() {
      origReplaceState.apply(this, arguments);
      checkUrlChange();
    };
    window.addEventListener('popstate', checkUrlChange);

    function checkUrlChange() {
      if (window.location.href === lastUrl) return;
      lastUrl = window.location.href;
      setTimeout(function() {
        if (!window.location.pathname.match(/\/speed_grader\/?$/)) { closeWindow(); return; }
        var newIds = extractIds();
        if (newIds && newIds.assignment_id !== ids.assignment_id) {
          ids = newIds;
          load();
          renderWindow(ids);
        }
      }, 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
