// ==UserScript==
// @name         Canvas SpeedGrader Scorer
// @namespace    https://tools.javagrant.ac.nz
// @version      1.0
// @description  Floating scoring window for Canvas SpeedGrader — track assignment scores across custom variables in localStorage
// @author       JavaGT
// @match        https://canvas.auckland.ac.nz/courses/*/gradebook/speed_grader*
// @grant        none
// @updateURL   https://gist.githubusercontent.com/JavaGT/ba5ef27b2f7047ecc9fc4e73182aa8c9/raw/canvas-scorer.user.js
// @downloadURL https://gist.githubusercontent.com/JavaGT/ba5ef27b2f7047ecc9fc4e73182aa8c9/raw/canvas-scorer.user.js
// ==/UserScript==

(function() {
  'use strict';

  var STORAGE_KEY = 'canvas_sg_scores';
  var VARS_KEY = 'canvas_sg_variables';
  var WINDOW_ID = 'canvas-scorer-window';

  var scores = {};
  var variables = [];
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
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scores)); } catch (_) {}
    try { localStorage.setItem(VARS_KEY, JSON.stringify(variables)); } catch (_) {}
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
      var val = currentScores[v] !== undefined && currentScores[v] !== null ? currentScores[v] : '';
      var hist = historyForVariable(v);
      var histHtml = '';
      if (hist.length) {
        var vals = hist.map(function(h) { return h.score; });
        var avg = (vals.reduce(function(a, b) { return a + b; }, 0) / vals.length).toFixed(1);
        histHtml = '<div style="font-size:10px;color:#a8a29e;margin-top:2px;">prev: ' + vals.join(', ') + ' &middot; avg ' + avg + '</div>';
      }
      rowsHtml +=
        '<div style="margin-bottom:10px;">' +
        '<div style="display:flex;align-items:center;gap:4px;">' +
        '<label style="flex:1;font-size:13px;font-weight:500;color:#1c1917;">' + escapeHtml(v) + '</label>' +
        '<input type="number" step="any" class="cv-score" data-var="' + escapeHtml(v) + '" value="' + val + '" placeholder="&ndash;" style="width:70px;padding:4px 6px;border:1px solid #d4d4d4;border-radius:4px;font-size:13px;text-align:right;background:#fff;color:#1c1917;outline:none;">' +
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
      '<div style="padding:8px 14px 12px;border-top:1px solid #e7e5e4;">' +
      '<div style="display:flex;gap:6px;">' +
      '<input id="cv-new-var" type="text" placeholder="New variable name" style="flex:1;padding:6px 8px;border:1px solid #d4d4d4;border-radius:4px;font-size:12px;outline:none;">' +
      '<button id="cv-add-var" style="padding:6px 12px;background:#0f766e;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Add</button>' +
      '</div>' +
      '<div style="font-size:10px;color:#a8a29e;margin-top:6px;">Scores auto-saved. Leave blank for undefined.</div>' +
      '</div>';

    win.querySelector('#cv-close').addEventListener('click', closeWindow);

    var header = win.querySelector('#cv-header');
    header.addEventListener('mousedown', startDrag);
    header.addEventListener('touchstart', startDragTouch, { passive: false });

    win.querySelectorAll('.cv-score').forEach(function(inp) {
      inp.addEventListener('input', function() {
        var varName = inp.getAttribute('data-var');
        var raw = inp.value.trim();
        if (raw === '') {
          currentScores[varName] = null;
        } else {
          var n = parseFloat(raw);
          currentScores[varName] = isNaN(n) ? null : n;
        }
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
    s.width = '320px';
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

  function closeWindow() {
    if (win) { win.style.display = 'none'; }
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function init() {
    var ids = extractIds();
    if (!ids || !ids.assignment_id) return;

    load();

    if (variables.length === 0) {
      variables = ['Clarity', 'Structure', 'Depth', 'Originality'];
      save();
    }

    openWindow(ids);

    window.addEventListener('popstate', function() {
      setTimeout(function() {
        var newIds = extractIds();
        if (newIds && newIds.assignment_id !== ids.assignment_id) {
          ids = newIds;
          load();
          renderWindow(ids);
        }
      }, 100);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
