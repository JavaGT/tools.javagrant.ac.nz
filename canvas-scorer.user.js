// ==UserScript==
// @name         Canvas SpeedGrader Scorer
// @namespace    https://tools.javagrant.ac.nz
// @version      1.4
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

  if (window.__SCOPE_SCORER__) return;
  window.__SCOPE_SCORER__ = true;
  if (window !== window.top) return;
  if (!window.location.pathname.match(/\/speed_grader\/?$/)) return;

  var VERSION = 1;
  var VERSION_KEY = 'canvas_sg_version';
  var STORAGE_KEY = 'canvas_sg_scores';
  var VARS_KEY = 'canvas_sg_variables';
  var COMMENTS_KEY = 'canvas_sg_comments';
  var DRAFTS_KEY = 'canvas_sg_drafts';
  var GRADES_KEY = 'canvas_sg_grades';
  var WINDOW_ID = 'canvas-scorer-window';

  var scores = {};
  var variables = [];
  var commentsStore = {};
  var drafts = {};
  var draftGrades = {};
  var commentDraft = '';
  var commentPopover = null;
  var win = null;
  var dragState = null;
  var dragOverlay = null;

  var appPhase = 'inactive'; // 'inactive' | 'active' | 'transitioning'
  var navToken = 0;
  var _saveTimer = null;
  var _resurrectionTimer = null;

  var baseFontSize = 13;
  var MIN_FONT = 10;
  var MAX_FONT = 20;

  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {
      if (e.name === 'QuotaExceededError') console.warn('Scorer: localStorage full — data not saved.');
    }
  }

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

  var FONT_SIZE_KEY = 'canvas_sg_font_size';

  function load() {
    try {
      var ver = localStorage.getItem(VERSION_KEY);
      if (ver === null) lsSet(VERSION_KEY, VERSION);
    } catch (_) {}
    try { var d = localStorage.getItem(STORAGE_KEY); if (d) scores = JSON.parse(d); } catch (_) { scores = {}; }
    try { var v = localStorage.getItem(VARS_KEY); if (v) variables = JSON.parse(v); } catch (_) { variables = []; }
    try { var c = localStorage.getItem(COMMENTS_KEY); if (c) commentsStore = JSON.parse(c); } catch (_) { commentsStore = {}; }
    try { var dw = localStorage.getItem(DRAFTS_KEY); if (dw) drafts = JSON.parse(dw); } catch (_) { drafts = {}; }
    try { var dg = localStorage.getItem(GRADES_KEY); if (dg) draftGrades = JSON.parse(dg); } catch (_) { draftGrades = {}; }
    try { var fs = localStorage.getItem(FONT_SIZE_KEY); if (fs) baseFontSize = parseInt(fs, 10) || 13; } catch (_) {}
  }

  function save() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(flushSave, 150);
  }

  function flushSave() {
    _saveTimer = null;
    var ids = extractIds();
    if (ids) {
      var aKey = getAssignmentKey(ids);
      drafts[aKey] = commentDraft;
      var gradeEl = document.getElementById('cv-draft-grade');
      if (gradeEl) draftGrades[aKey] = gradeEl.value;
      updateGradeCount(aKey);
    }
    lsSet(STORAGE_KEY, scores);
    lsSet(VARS_KEY, variables);
    lsSet(COMMENTS_KEY, commentsStore);
    lsSet(DRAFTS_KEY, drafts);
    lsSet(GRADES_KEY, draftGrades);
    lsSet(FONT_SIZE_KEY, baseFontSize);
  }

  function saveDraftForKey(key) {
    drafts[key] = commentDraft;
    save();
  }

  function loadDraftForKey(key) {
    commentDraft = drafts[key] !== undefined ? drafts[key] : '';
  }

  function loadGradeForKey(key) {
    document.getElementById('cv-draft-grade').value = draftGrades[key] !== undefined ? draftGrades[key] : '';
    updateGradeCount(key);
  }

  function updateGradeCount(key) {
    var prefix = key.split(':').slice(0, 2).join(':') + ':';
    var count = 0;
    var sum = 0;
    for (var k in draftGrades) {
      if (k.indexOf(prefix) === 0 && draftGrades[k] !== '') {
        count++;
        var num = parseFloat(draftGrades[k]);
        if (!isNaN(num)) sum += num;
      }
    }
    var el = document.getElementById('cv-grade-count');
    if (el) {
      if (count) {
        var avg = (sum / count).toFixed(1);
        el.textContent = ' ' + count + ' graded \u00b7 avg ' + avg;
      } else {
        el.textContent = '';
      }
    }
  }

  function backupData() {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key.indexOf('canvas_sg_') === 0) {
        try { data[key] = JSON.parse(localStorage.getItem(key)); } catch (_) { data[key] = localStorage.getItem(key); }
      }
    }
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'scorer-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    var student = ids.student_id || ids.anonymous_id || 'unknown';
    return ids.course_id + ':' + ids.assignment_id + ':' + student;
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

  function applyFontSize() {
    if (!win) return;
    var ratio = baseFontSize / 13;
    var els = win.querySelectorAll('*');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var orig = el.getAttribute('data-fs');
      if (orig === null) {
        var fs = parseInt(el.style.fontSize, 10);
        if (fs && !isNaN(fs)) {
          el.setAttribute('data-fs', fs);
          orig = fs;
        }
      }
      if (orig !== null) {
        el.style.fontSize = Math.round(parseInt(orig, 10) * ratio) + 'px';
      }
    }
  }

  function changeFontSize(delta) {
    baseFontSize = Math.min(MAX_FONT, Math.max(MIN_FONT, baseFontSize + delta));
    applyFontSize();
    save();
  }

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function findGradeInput() {
    var sel = [
      'input[data-testid="grade-input"]',
      'input.css-lykru6-textInput',
      'input[type="text"][name*="grade"]',
      '#grading-box-input',
      'input.grading-box',
    ];
    for (var i = 0; i < sel.length; i++) {
      var el = document.querySelector(sel[i]);
      if (el) return el;
    }
    return document.querySelector('[data-testid*="grade"] input, input[data-testid*="grade"]');
  }

  function findSubmitCommentBtn() {
    var sel = [
      'button[data-testid="submit-comment-button"]',
      'button[data-testid="comment-submit-button"]',
    ];
    // data-testid selectors
    for (var i = 0; i < sel.length; i++) {
      var el = document.querySelector(sel[i]);
      if (el) return el;
    }
    // find submit button in the feedback/comment area
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var text = btns[i].textContent.trim().toLowerCase();
      if (text === 'submit' || text === 'submit comment') return btns[i];
    }
    // look for any form submit near the feedback iframe
    var iframe = document.querySelector('iframe.tox-edit-area__iframe');
    if (iframe) {
      var wrapper = iframe.closest('[data-testid*="feedback"], [data-testid*="comment"], .tox, .feedback');
      if (wrapper) {
        var btn = wrapper.querySelector('button[type="submit"]');
        if (btn) return btn;
        // fallback: any visible button in the wrapper
        btns = wrapper.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
          if (btns[i].offsetParent !== null) return btns[i];
        }
      }
    }
    return null;
  }

  function setFeedbackInCanvas(text) {
    if (!text) return false;
    // Try TinyMCE API first
    if (window.tinymce) {
      try {
        var editors = tinymce.editors;
        for (var i = 0; i < editors.length; i++) {
          var ed = editors[i];
          if (ed && !ed.isHidden()) {
            ed.setContent(text);
            return true;
          }
        }
      } catch(_) {}
    }
    // Try iframe by class (tox-edit-area__iframe) or title
    var iframes = document.querySelectorAll('iframe.tox-edit-area__iframe, iframe[title*="Rich Text"], iframe[title*="Feedback"], iframe[id$="_ifr"]');
    for (var i = 0; i < iframes.length; i++) {
      try {
        var doc = iframes[i].contentDocument;
        if (doc) {
          doc.body.innerHTML = text;
          return true;
        }
      } catch(_) {}
    }
    // Fallback: try any iframe body that looks editable
    iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i++) {
      try {
        var doc = iframes[i].contentDocument;
        if (doc && doc.body && !doc.body.innerHTML && doc.designMode === 'on') {
          doc.body.innerHTML = text;
          return true;
        }
      } catch(_) {}
    }
    return false;
  }

  function pushToCanvas() {
    var grade = document.getElementById('cv-draft-grade');
    var gradeVal = grade ? grade.value.trim() : '';
    var commentVal = commentDraft.trim();

    if (!commentVal && !gradeVal) {
      flashMsg('Nothing to push — fill grade and/or comment first');
      return;
    }

    // Convert newlines to <br> for HTML feedback
    var htmlComment = commentVal.replace(/\n/g, '<br>');

    // Step 1: Set feedback content in TinyMCE
    if (htmlComment) {
      var ok = setFeedbackInCanvas(htmlComment);
      if (!ok) {
        flashMsg('Feedback iframe not found');
      }
    }

    // Chain remaining steps with delays
    setTimeout(function() {
      // Step 2: Submit comment
      if (htmlComment) {
        var submitBtn = findSubmitCommentBtn();
        if (submitBtn) submitBtn.click();
      }

      setTimeout(function() {
        // Step 3: Focus grade input
        var gradeInput = document.querySelector('input[data-testid="grade-input"]');
        if (!gradeInput) gradeInput = findGradeInput();
        if (gradeInput && gradeVal) {
          gradeInput.focus();
        }

        setTimeout(function() {
          // Step 4: Type out grade value
          var gradeInput = document.querySelector('input[data-testid="grade-input"]');
          if (!gradeInput) gradeInput = findGradeInput();
          if (gradeInput && gradeVal) {
            gradeInput.value = gradeVal;
            gradeInput.dispatchEvent(new Event('input', { bubbles: true }));
            gradeInput.dispatchEvent(new Event('change', { bubbles: true }));
          }

          flashMsg('Pushed to Canvas');
        }, 350);
      }, 350);
    }, 350);
  }

  var flashTimer = null;
  function flashMsg(text) {
    var el = document.getElementById('cv-flash');
    if (!el) return;
    el.textContent = text;
    el.style.opacity = '1';
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function() {
      el.style.opacity = '0';
    }, 2500);
  }

  // ---- skeletons (created once, survive renders) ----
  var skeleton = {
    rows: null,
    draftTa: null,
    subtitle: null,
  };

  function buildSkeleton() {
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
    s.userSelect = 'none';

    // header
    var header = document.createElement('div');
    header.id = 'cv-header';
    header.style.cssText = 'padding:10px 14px 8px;background:#0f766e;color:white;border-radius:10px 10px 0 0;cursor:move;user-select:none;';

    var topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;cursor:grab;';
    var titleWrap = document.createElement('div');
    var titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'font-size:14px;font-weight:700;';
    titleDiv.textContent = 'Scorer v1.4';
    skeleton.subtitle = document.createElement('span');
    skeleton.subtitle.style.cssText = 'font-size:11px;opacity:0.7;font-weight:400;';
    titleWrap.appendChild(titleDiv);
    titleWrap.appendChild(skeleton.subtitle);

    var closeBtn = document.createElement('button');
    closeBtn.id = 'cv-close';
    closeBtn.style.cssText = 'background:none;border:none;color:white;cursor:pointer;font-size:20px;line-height:1;padding:0;';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', closeWindow);

    topRow.appendChild(titleWrap);

    var fontBtnGroup = document.createElement('div');
    fontBtnGroup.style.cssText = 'display:flex;align-items:center;gap:2px;';
    var fontSizeDown = document.createElement('button');
    fontSizeDown.textContent = '\u2212';
    fontSizeDown.title = 'Decrease font size';
    fontSizeDown.style.cssText = 'background:none;border:none;color:white;cursor:pointer;line-height:1;padding:0 2px;font-weight:700;';
    var fontSizeUp = document.createElement('button');
    fontSizeUp.textContent = '+';
    fontSizeUp.title = 'Increase font size';
    fontSizeUp.style.cssText = 'background:none;border:none;color:white;cursor:pointer;line-height:1;padding:0 2px;font-weight:700;';
    fontSizeDown.addEventListener('click', function() { changeFontSize(-1); });
    fontSizeUp.addEventListener('click', function() { changeFontSize(1); });
    fontBtnGroup.appendChild(fontSizeDown);
    fontBtnGroup.appendChild(fontSizeUp);
    topRow.appendChild(fontBtnGroup);

    topRow.appendChild(closeBtn);
    header.appendChild(topRow);

    var gradeRow = document.createElement('div');
    gradeRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px;';
    var gradeLabel = document.createElement('span');
    gradeLabel.style.cssText = 'font-size:11px;opacity:0.8;white-space:nowrap;';
    gradeLabel.textContent = 'Draft Grade:';
    var gradeInput = document.createElement('input');
    gradeInput.id = 'cv-draft-grade';
    gradeInput.type = 'text';
    gradeInput.placeholder = '\u2013';
    gradeInput.style.cssText = 'flex:1;padding:2px 6px;border:1px solid rgba(255,255,255,0.3);border-radius:3px;font-size:12px;background:rgba(255,255,255,0.15);color:white;outline:none;min-width:0;user-select:text;';
    gradeInput.addEventListener('input', function() { save(); updateGradeCount(getAssignmentKey(extractIds())); });
    gradeInput.addEventListener('keydown', function(e) { e.stopPropagation(); });
    gradeInput.addEventListener('keyup', function(e) { e.stopPropagation(); });
    gradeInput.addEventListener('keypress', function(e) { e.stopPropagation(); });
    var gradeCount = document.createElement('span');
    gradeCount.id = 'cv-grade-count';
    gradeCount.style.cssText = 'font-size:10px;opacity:0.7;white-space:nowrap;';
    gradeRow.appendChild(gradeLabel);
    gradeRow.appendChild(gradeInput);
    gradeRow.appendChild(gradeCount);
    header.appendChild(gradeRow);

    topRow.addEventListener('mousedown', startDrag);
    topRow.addEventListener('touchstart', startDragTouch, { passive: false });
    win.appendChild(header);

    // rows container
    skeleton.rows = document.createElement('div');
    skeleton.rows.style.cssText = 'padding:12px 14px;overflow-y:auto;max-height:300px;';
    win.appendChild(skeleton.rows);

    // add-variable footer
    var addFooter = document.createElement('div');
    addFooter.style.cssText = 'padding:8px 14px;border-top:1px solid #e7e5e4;display:flex;gap:6px;';
    var newVarInput = document.createElement('input');
    newVarInput.id = 'cv-new-var';
    newVarInput.type = 'text';
    newVarInput.placeholder = 'New variable name';
    newVarInput.style.cssText = 'flex:1;padding:6px 8px;border:1px solid #d4d4d4;border-radius:4px;font-size:12px;outline:none;user-select:text;';
    var addVarBtn = document.createElement('button');
    addVarBtn.id = 'cv-add-var';
    addVarBtn.textContent = 'Add';
    addVarBtn.style.cssText = 'padding:6px 12px;background:#0f766e;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;';
    addFooter.appendChild(newVarInput);
    addFooter.appendChild(addVarBtn);
    win.appendChild(addFooter);

    addVarBtn.addEventListener('click', function() {
      var name = newVarInput.value.trim();
      if (!name) return;
      if (!addVariable(name)) return;
      newVarInput.value = '';
      renderRows();
    });
    newVarInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') addVarBtn.click();
    });

    // draft footer
    var draftFooter = document.createElement('div');
    draftFooter.style.cssText = 'padding:8px 14px 12px;border-top:1px solid #e7e5e4;';
    skeleton.draftTa = document.createElement('textarea');
    skeleton.draftTa.id = 'cv-draft';
    skeleton.draftTa.placeholder = 'Comment draft\u2026';
    skeleton.draftTa.style.cssText = 'width:100%;min-height:40px;padding:6px 8px;border:1px solid #d4d4d4;border-radius:4px;font-size:12px;font-family:inherit;resize:none;box-sizing:border-box;outline:none;overflow:hidden;user-select:text;';
    skeleton.draftTa.addEventListener('input', function() { commentDraft = skeleton.draftTa.value; save(); autoGrow(skeleton.draftTa); });
    skeleton.draftTa.addEventListener('keydown', function(e) { e.stopPropagation(); });
    skeleton.draftTa.addEventListener('keyup', function(e) { e.stopPropagation(); });
    skeleton.draftTa.addEventListener('keypress', function(e) { e.stopPropagation(); });

    var draftBtns = document.createElement('div');
    draftBtns.style.cssText = 'display:flex;gap:4px;margin-top:4px;';
    var copyBtn = document.createElement('button');
    copyBtn.id = 'cv-copy-draft';
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = 'padding:4px 10px;background:#0f766e;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;';
    var clearBtn = document.createElement('button');
    clearBtn.id = 'cv-clear-draft';
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = 'padding:4px 10px;background:transparent;color:#a8a29e;border:1px solid #d4d4d4;border-radius:4px;cursor:pointer;font-size:11px;';
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:10px;color:#a8a29e;margin-top:4px;';
    hint.innerHTML = 'Click &#8853; next to a variable for comment options';

    var flash = document.createElement('div');
    flash.id = 'cv-flash';
    flash.style.cssText = 'font-size:10px;color:#0f766e;margin-top:4px;opacity:0;transition:opacity 0.3s;';

    var pushBtn = document.createElement('button');
    pushBtn.id = 'cv-push';
    pushBtn.textContent = 'Push';
    pushBtn.title = 'Insert draft grade + feedback into Canvas fields';
    pushBtn.style.cssText = 'padding:4px 10px;background:#0f766e;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;';

    var backupBtn = document.createElement('button');
    backupBtn.id = 'cv-backup';
    backupBtn.textContent = 'Backup';
    backupBtn.style.cssText = 'padding:4px 10px;background:transparent;color:#a8a29e;border:1px solid #d4d4d4;border-radius:4px;cursor:pointer;font-size:11px;';

    draftBtns.appendChild(copyBtn);
    draftBtns.appendChild(clearBtn);
    draftBtns.appendChild(pushBtn);
    draftBtns.appendChild(backupBtn);
    draftFooter.appendChild(skeleton.draftTa);
    draftFooter.appendChild(draftBtns);
    draftFooter.appendChild(hint);
    draftFooter.appendChild(flash);
    win.appendChild(draftFooter);

    backupBtn.addEventListener('click', backupData);
    pushBtn.addEventListener('click', pushToCanvas);

    copyBtn.addEventListener('click', function() {
      var text = skeleton.draftTa.value;
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
    clearBtn.addEventListener('click', function() {
      commentDraft = '';
      skeleton.draftTa.value = '';
      autoGrow(skeleton.draftTa);
      save();
    });

    document.addEventListener('click', function(e) {
      if (commentPopover && !commentPopover.contains(e.target) && !e.target.closest('.cv-comment-btn')) {
        hideCommentPopover();
      }
    });

    document.body.appendChild(win);
  }

  function renderRows() {
    if (!skeleton.rows) return;
    var ids = extractIds();
    if (!ids) return;
    var currentScores = getAssignmentScores(ids);

    if (ids.assignment_id) {
      skeleton.subtitle.textContent = 'Assignment ' + ids.assignment_id + ' \u00b7 Student ' + (ids.student_id || ids.anonymous_id || '?');
    }

    skeleton.draftTa.value = commentDraft;
    autoGrow(skeleton.draftTa);

    skeleton.rows.innerHTML = '';

    if (!variables.length) {
      var empty = document.createElement('div');
      empty.style.cssText = 'font-size:12px;color:#a8a29e;font-style:italic;text-align:center;padding:16px 0;';
      empty.textContent = 'No variables yet. Add one below.';
      skeleton.rows.appendChild(empty);
      return;
    }

    var idsForRender = ids;
    var token = ++navToken;

    variables.forEach(function(v) {
      var checked = currentScores[v] !== undefined && currentScores[v] !== null;
      var val = checked ? currentScores[v] : 3;

      var row = document.createElement('div');
      row.style.cssText = 'margin-bottom:10px;';

      var line = document.createElement('div');
      line.style.cssText = 'display:flex;align-items:center;gap:6px;';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'cv-check';
      cb.setAttribute('data-var', v);
      cb.checked = checked;
      cb.style.cssText = 'accent-color:#0f766e;cursor:pointer;';
      line.appendChild(cb);

      var label = document.createElement('label');
      label.style.cssText = 'flex:1;font-size:13px;font-weight:500;color:#1c1917;cursor:pointer;';
      label.textContent = v;
      label.addEventListener('click', function() { cb.click(); });
      line.appendChild(label);

      var slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '1';
      slider.max = '5';
      slider.step = '1';
      slider.className = 'cv-slider';
      slider.setAttribute('data-var', v);
      slider.value = val;
      slider.disabled = !checked;
      slider.style.cssText = 'width:60px;accent-color:#0f766e;cursor:pointer;';
      line.appendChild(slider);

      var valSpan = document.createElement('span');
      valSpan.className = 'cv-val';
      valSpan.setAttribute('data-var', v);
      valSpan.style.cssText = 'font-size:13px;font-weight:600;color:#0f766e;min-width:14px;text-align:center;';
      valSpan.textContent = checked ? val : '\u2013';
      line.appendChild(valSpan);

      var commentBtn = document.createElement('button');
      commentBtn.className = 'cv-comment-btn';
      commentBtn.setAttribute('data-var', v);
      commentBtn.title = 'Comment options';
      commentBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:14px;color:#a8a29e;line-height:1;padding:0 2px;';
      commentBtn.innerHTML = '&oplus;';
      line.appendChild(commentBtn);

      var delBtn = document.createElement('button');
      delBtn.className = 'cv-del-var';
      delBtn.setAttribute('data-var', v);
      delBtn.title = 'Remove variable';
      delBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;color:#a8a29e;line-height:1;padding:0 2px;';
      delBtn.textContent = '\u00d7';
      line.appendChild(delBtn);

      row.appendChild(line);

      // history
      var hist = historyForVariable(v);
      if (hist.length) {
        var vals = hist.map(function(h) { return h.score; });
        var avg = (vals.reduce(function(a, b) { return a + b; }, 0) / vals.length).toFixed(1);
        var histDiv = document.createElement('div');
        histDiv.style.cssText = 'font-size:10px;color:#a8a29e;margin-top:2px;';
        histDiv.textContent = 'prev: ' + vals.join(', ') + ' \u00b7 avg ' + avg;
        row.appendChild(histDiv);
      }

      skeleton.rows.appendChild(row);

      // event listeners
      cb.addEventListener('change', function() {
        if (navToken !== token) return;
        var sliderEl = row.querySelector('.cv-slider');
        var valEl = row.querySelector('.cv-val');
        if (cb.checked) {
          sliderEl.disabled = false;
          var n = parseInt(sliderEl.value, 10);
          currentScores[v] = n;
          valEl.textContent = n;
        } else {
          sliderEl.disabled = true;
          currentScores[v] = null;
          valEl.textContent = '\u2013';
        }
        save();
      });

      slider.addEventListener('input', function() {
        if (navToken !== token) return;
        if (slider.disabled) return;
        var n = parseInt(slider.value, 10);
        currentScores[v] = n;
        var valEl = row.querySelector('.cv-val');
        if (valEl) valEl.textContent = n;
        save();
      });

      commentBtn.addEventListener('click', function() {
        if (commentPopover && commentPopover.getAttribute('data-var') === v) {
          hideCommentPopover(); return;
        }
        var checkedNow = currentScores[v] !== undefined && currentScores[v] !== null;
        var scoreNow = checkedNow ? currentScores[v] : null;
        showCommentPopover(commentBtn, v, scoreNow, idsForRender);
      });

      delBtn.addEventListener('click', function() {
        if (confirm('Remove variable "' + v + '" and all its scores?')) {
          removeVariable(v);
          renderRows();
        }
      });
    });
  }

  // ---- comment popover ----

  function showCommentPopover(anchor, varName, score, ids) {
    hideCommentPopover();
    commentPopover = document.createElement('div');
    commentPopover.setAttribute('data-var', varName);
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
    html += '<textarea class="cv-new-comment-text" style="width:100%;min-height:36px;padding:4px 6px;border:1px solid #d4d4d4;border-radius:4px;font-size:11px;font-family:inherit;resize:vertical;box-sizing:border-box;outline:none;user-select:text;"></textarea>' +
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
        if (skeleton.draftTa) {
          var cur = skeleton.draftTa.value;
          var sep = cur && !cur.endsWith('\n') ? '\n\n' : '';
          skeleton.draftTa.value = cur + sep + text;
          commentDraft = skeleton.draftTa.value;
          autoGrow(skeleton.draftTa);
          save();
          hideCommentPopover();
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

  // ---- drag ----

  function startDrag(e) {
    dragState = {
      offsetX: e.clientX - win.getBoundingClientRect().left,
      offsetY: e.clientY - win.getBoundingClientRect().top,
    };
    dragOverlay = document.createElement('div');
    dragOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999998;cursor:move;';
    document.body.appendChild(dragOverlay);
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
    dragOverlay = document.createElement('div');
    dragOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999998;cursor:move;';
    document.body.appendChild(dragOverlay);
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
    if (dragOverlay) { dragOverlay.remove(); dragOverlay = null; }
    document.removeEventListener('mousemove', duringDrag);
    document.removeEventListener('mouseup', endDrag);
  }

  function endDragTouch() {
    dragState = null;
    if (dragOverlay) { dragOverlay.remove(); dragOverlay = null; }
    document.removeEventListener('touchmove', duringDragTouch);
    document.removeEventListener('touchend', endDragTouch);
  }

  // ---- lifecycle ----

  function openWindow(ids) {
    if (win && document.body.contains(win)) {
      win.style.display = 'block';
      renderRows();
      applyFontSize();
      updateSettingsBtn(true);
      appPhase = 'active';
      return;
    }
    win = null;
    buildSkeleton();
    renderRows();
    applyFontSize();
    updateSettingsBtn(true);
    appPhase = 'active';
  }

  function closeWindow() {
    if (win) { win.style.display = 'none'; }
    updateSettingsBtn(false);
    appPhase = 'inactive';
  }

  function toggleWindow(ids) {
    if (win && win.style.display !== 'none') {
      closeWindow();
    } else {
      openWindow(ids || extractIds());
    }
  }

  function updateSettingsBtn(active) {
    var btn = document.getElementById('cv-settings-btn');
    if (!btn) return;
    if (active) {
      btn.classList.add('cv-active');
      btn.style.background = '#14b8a6';
    } else {
      btn.classList.remove('cv-active');
      btn.style.background = '#0f766e';
    }
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
      updateSettingsBtn(win && win.style.display !== 'none');
    });
    section.appendChild(btn);
  }

  // ---- resurrection observer ----
  function startResurrectionWatcher() {
    if (_resurrectionTimer) return;
    _resurrectionTimer = setInterval(function() {
      if (appPhase !== 'active' && appPhase !== 'inactive') return;
      if (win && !document.body.contains(win)) {
        win = null;
        buildSkeleton();
        renderRows();
        updateSettingsBtn(true);
      }
      if (!document.getElementById('cv-settings-btn')) {
        injectSettingsButton(extractIds());
      }
    }, 2000);
  }

  // ---- init ----

  function init() {
    if (!window.location.pathname.match(/\/speed_grader\/?$/)) return;
    var ids = extractIds();
    if (!ids || !ids.assignment_id) return;

    load();
    loadDraftForKey(getAssignmentKey(ids));

    if (variables.length === 0) {
      variables = ['Clarity', 'Structure', 'Depth', 'Originality'];
      flushSave();
    }

    openWindow(ids);
    loadGradeForKey(getAssignmentKey(ids));
    startResurrectionWatcher();

    document.addEventListener('keydown', function(e) {
      if (e.altKey && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        toggleWindow(extractIds());
      }
    });

    (function tryInject(tries) {
      injectSettingsButton(ids);
      if (!document.getElementById('cv-settings-btn') && tries > 0) {
        setTimeout(function() { tryInject(tries - 1); }, 1500);
      }
    })(5);

    // URL watcher — polls every 400ms + popstate for instant back/forward
    var lastUrl = window.location.href;
    setInterval(checkUrlChange, 400);
    window.addEventListener('popstate', checkUrlChange);

    function checkUrlChange() {
      if (window.location.href === lastUrl || appPhase === 'transitioning') return;
      lastUrl = window.location.href;
      appPhase = 'transitioning';
      var token = ++navToken;
      setTimeout(function() {
        if (navToken !== token) return;
        if (!window.location.pathname.match(/\/speed_grader\/?$/)) { closeWindow(); appPhase = 'inactive'; return; }
        var newIds = extractIds();
        if (newIds && (newIds.assignment_id !== ids.assignment_id || newIds.student_id !== ids.student_id)) {
          hideCommentPopover();
          saveDraftForKey(getAssignmentKey(ids));
          ids = newIds;
          load();
          loadDraftForKey(getAssignmentKey(ids));
          openWindow(ids);
          loadGradeForKey(getAssignmentKey(ids));
          setTimeout(function() { injectSettingsButton(ids); }, 800);
        }
        appPhase = 'active';
      }, 150);
    }

    window.addEventListener('beforeunload', function() {
      if (_saveTimer) flushSave();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
