/* 授業プリントの独立した練習。物語の状態・保存・モーダル操作は呼び出し元が管理する。 */
(function () {
  'use strict';
  var own = Object.prototype.hasOwnProperty;
  function list() { return Array.isArray(window.KOUMON_ACTIVITIES) ? window.KOUMON_ACTIVITIES : []; }
  function find(id) { return list().filter(function (a) { return a.id === id; })[0]; }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function count(a) { return a.type === 'order' ? a.cards.length : a.questions.length; }
  function integer(value, max, fallback) { return Number.isInteger(value) && value >= 0 ? Math.min(value, max) : fallback; }
  function permutation(value, ids) { return Array.isArray(value) && value.length === ids.length && value.every(function (id, i) { return ids.indexOf(id) >= 0 && value.indexOf(id) === i; }); }
  function fresh(a) {
    var ids = a.type === 'order' ? a.cards.map(function (c) { return c.id; }) : [];
    return { answers: {}, order: permutation(a.initial, ids) ? a.initial.slice() : ids, checked: false, tries: 0, best: 0, firstScore: null, reflection: '' };
  }
  function complete(a, s) {
    return a.type === 'order' || a.questions.every(function (q) { return own.call(s.answers, q.id); });
  }
  function score(a, s) {
    if (a.type === 'order') return a.answer.reduce(function (n, id, i) { return n + (s.order[i] === id ? 1 : 0); }, 0);
    return a.questions.reduce(function (n, q) { return n + (s.answers[q.id] === q.answer ? 1 : 0); }, 0);
  }
  function clean(a, value) {
    var s = fresh(a);
    if (!plain(value)) return s;
    if (a.type === 'order') {
      if (permutation(value.order, a.cards.map(function (c) { return c.id; }))) s.order = value.order.slice();
    } else if (plain(value.answers)) a.questions.forEach(function (q) {
      if (own.call(value.answers, q.id) && q.options.some(function (o) { return o.id === value.answers[q.id]; })) s.answers[q.id] = value.answers[q.id];
    });
    s.tries = integer(value.tries, 9999, 0);
    s.best = integer(value.best, count(a), 0);
    s.firstScore = integer(value.firstScore, count(a), null);
    s.checked = value.checked === true && s.tries > 0 && complete(a, s);
    s.reflection = a.reflection && typeof value.reflection === 'string' ? value.reflection.slice(0, 1200) : '';
    if (!s.tries) { s.best = 0; s.firstScore = null; }
    if (s.checked) s.best = Math.max(s.best, score(a, s));
    return s;
  }
  function restore(saved) {
    var out = {};
    if (plain(saved)) list().forEach(function (a) { if (own.call(saved, a.id)) out[a.id] = clean(a, saved[a.id]); });
    return out;
  }
  function initial(id) { var a = find(id); return a ? fresh(a) : null; }
  function act(id, state, action, payload) {
    var a = find(id); if (!a) return null;
    var s = clean(a, state), p = plain(payload) ? payload : {};
    if (action === 'answer' && a.type !== 'order') {
      var q = a.questions.filter(function (x) { return x.id === p.question; })[0];
      if (q && q.options.some(function (o) { return o.id === p.value; }) && s.answers[q.id] !== p.value) { s.answers[q.id] = p.value; s.checked = false; }
      else if (q && p.value === '' && own.call(s.answers, q.id)) { delete s.answers[q.id]; s.checked = false; }
    } else if ((action === 'up' || action === 'down') && a.type === 'order') {
      var i = s.order.indexOf(p.card), j = i + (action === 'up' ? -1 : 1);
      if (i >= 0 && j >= 0 && j < s.order.length) { var old = s.order[i]; s.order[i] = s.order[j]; s.order[j] = old; s.checked = false; }
    } else if (action === 'check' && !s.checked && complete(a, s)) {
      var n = score(a, s); s.checked = true; s.tries = Math.min(s.tries + 1, 9999); s.best = Math.max(s.best, n);
      if (s.firstScore === null) s.firstScore = n;
    } else if (action === 'reset') {
      var reset = fresh(a); s.answers = reset.answers; s.order = reset.order; s.checked = false;
    } else if (action === 'reflect' && a.reflection && typeof p.value === 'string') s.reflection = p.value.slice(0, 1200);
    return s;
  }
  function actionButton(action, text, extra, disabled) {
    return '<button type="button" class="km-btn" data-km="activity-action" data-action="' + action + '"' + (extra || '') + (disabled ? ' disabled' : '') + '>' + text + '</button>';
  }
  function renderMenu(saved) {
    var states = restore(saved);
    return '<section class="km-act"><h3>プリントで練習する</h3><p class="km-m-lead">読みたいところを選び、札や言葉を動かして本文を確かめよう。途中の回答もこの端末に保存されます。</p><div class="km-act-menu">' + list().map(function (a, i) {
      var s = states[a.id], progress = s && s.tries ? '最高 ' + s.best + ' / ' + count(a) + '・確認 ' + s.tries + ' 回' : s && (Object.keys(s.answers).length || s.reflection || (a.type === 'order' && s.order.join('|') !== fresh(a).order.join('|'))) ? '練習中' : 'これから';
      return '<button type="button" class="km-btn km-act-menu-card" data-km="activity-open" data-id="' + esc(a.id) + '"><span class="km-act-number">' + (i + 1) + '</span><strong>' + esc(a.title) + '</strong><span>' + esc(a.lead) + '</span><small>約' + esc(a.minutes) + '分 · ' + esc(progress) + '</small></button>';
    }).join('') + '</div><div class="km-nav"><span></span><button type="button" class="km-btn" data-km="closemodal">閉じる</button></div></section>';
  }
  function quote(text) { return text ? '<blockquote class="km-act-quote">' + esc(text) + '</blockquote>' : ''; }
  function feedback(q, s) {
    if (!s.checked) return '';
    var correct = s.answers[q.id] === q.answer, answer = q.options.filter(function (o) { return o.id === q.answer; })[0];
    return '<div class="km-act-feedback ' + (correct ? 'is-correct' : 'is-retry') + '"><b>' + (correct ? '○ 本文と一致' : '△ 本文を確認') + '</b>' + (!correct && answer ? '<span>答え：' + esc(answer.label) + '</span>' : '') + '<p>' + esc(q.why) + '</p></div>';
  }
  function select(q, s) {
    return '<label class="km-act-choice"><span>' + esc(q.prompt) + '</span><select data-activity-answer="' + esc(q.id) + '"><option value="">選んでください</option>' + q.options.map(function (o) { return '<option value="' + esc(o.id) + '"' + (s.answers[q.id] === o.id ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</select></label>';
  }
  function formation(a, s) {
    var pos = a.questions.filter(function (q) { return q.id === 'position'; })[0];
    if (!pos) return matches(a, s);
    var directions = { north: '北側', east: '東側', south: '南側', west: '西側' };
    return '<fieldset class="km-act-formation"><legend>' + esc(pos.prompt) + '</legend>' + quote(pos.quote) + '<p class="km-act-help">項王との位置関係を表す模式図です（上が北）。樊噲を置き、顔の向きを選びます。</p><div class="km-act-compass"><span class="km-act-north">北 ↑</span><div class="km-act-center">項王 →<br>東向き</div>' + pos.options.map(function (o) {
      return '<button type="button" class="km-btn km-act-position km-act-pos-' + esc(o.id) + '" data-km="activity-action" data-action="answer" data-question="position" data-value="' + esc(o.id) + '" aria-pressed="' + (s.answers.position === o.id) + '"><span>' + esc(directions[o.id] || o.label) + '</span><b>' + (s.answers.position === o.id ? '樊噲 ' + ({north:'↑',east:'→',south:'↓',west:'←'}[s.answers.direction] || '（向きを選ぶ）') : 'ここに置く') + '</b></button>';
    }).join('') + '</div>' + feedback(pos, s) + '</fieldset><div class="km-act-match-board">' + a.questions.filter(function (q) { return q !== pos; }).map(function (q) { return '<article class="km-act-question">' + quote(q.quote) + select(q, s) + feedback(q, s) + '</article>'; }).join('') + '</div>';
  }
  function matches(a, s) {
    return '<div class="km-act-match-board">' + a.questions.map(function (q, i) {
      return '<article class="km-act-question"><span class="km-act-item-number">' + (i + 1) + '</span>' + quote(q.quote) + select(q, s) + feedback(q, s) + '</article>';
    }).join('') + '</div>';
  }
  function ordering(a, s) {
    return '<p class="km-act-help">上から順に出来事が進みます。「上へ」「下へ」で札を動かそう。</p><ol class="km-act-order">' + s.order.map(function (id, i) {
      var c = a.cards.filter(function (x) { return x.id === id; })[0], correct = s.checked && a.answer[i] === id;
      return '<li class="km-act-order-card' + (s.checked ? correct ? ' is-correct' : ' is-retry' : '') + '"><span class="km-act-item-number">' + (i + 1) + '</span><div class="km-act-card-copy"><p>' + esc(c.text) + '</p>' + quote(c.quote) + (s.checked ? '<b class="km-act-position-result">' + (correct ? '○ 順序が一致' : '△ 順序を確認') + '</b>' : '') + '</div><div class="km-act-move">' + actionButton('up', '↑ 上へ', ' data-card="' + esc(id) + '" aria-label="' + esc(c.text) + 'を上へ"', i === 0) + actionButton('down', '↓ 下へ', ' data-card="' + esc(id) + '" aria-label="' + esc(c.text) + 'を下へ"', i === s.order.length - 1) + '</div></li>';
    }).join('') + '</ol>' + (s.checked ? '<div class="km-act-feedback"><b>本文の流れ</b><p>' + esc(a.why) + '</p><ol>' + a.answer.map(function (id) { return '<li>' + esc(a.cards.filter(function (c) { return c.id === id; })[0].text) + '</li>'; }).join('') + '</ol></div>' : '');
  }
  function render(id, state) {
    var a = find(id);
    if (!a) return '<h3>活動が見つかりません</h3><button class="km-btn" data-km="activities">活動一覧へ</button>';
    var s = clean(a, state), n = score(a, s), status = s.checked ? n + ' / ' + count(a) + ' が本文と一致しました。解説を読んで、回答を直すこともできます。' : complete(a, s) ? '準備ができたら「本文と照らす」で確かめよう。' : 'すべての欄を選んでから、本文と照らそう。';
    return '<section class="km-act"><div class="km-act-kicker">プリントで練習 · 約' + esc(a.minutes) + '分</div><h3>' + esc(a.title) + '</h3><p class="km-m-lead">' + esc(a.lead) + '</p><p class="km-act-source">資料：' + esc(a.source) + '</p>' + (a.type === 'order' ? ordering(a, s) : a.type === 'formation' ? formation(a, s) : matches(a, s)) +
      (a.reflection ? '<label class="km-act-reflection"><b>' + esc(a.reflection.prompt) + '</b><span id="km-act-reflection-hint">' + esc(a.reflection.hint) + '（自由記述は自動採点しません・1200字まで）</span><textarea rows="4" maxlength="1200" data-activity-reflection aria-describedby="km-act-reflection-hint">' + esc(s.reflection) + '</textarea></label>' : '') +
      '<p class="km-act-status" role="status">' + status + '</p>' + (s.tries ? '<p class="km-act-progress">確認 ' + s.tries + ' 回 · 初回 ' + (s.firstScore === null ? '―' : s.firstScore) + ' / ' + count(a) + ' · 最高 ' + s.best + ' / ' + count(a) + '</p>' : '') + '<div class="km-nav km-act-nav"><button type="button" class="km-btn" data-km="activities">活動一覧へ</button>' + actionButton('reset', '札を戻す', '') + '<button type="button" class="km-btn gold" data-km="activity-action" data-action="check"' + (!complete(a, s) || s.checked ? ' disabled' : '') + '>本文と照らす</button></div></section>';
  }
  function summary(saved) {
    var states = restore(saved), lines = [];
    list().forEach(function (a) {
      var s = states[a.id]; if (!s) return;
      lines.push('・' + a.title + '：' + (s.tries ? '初回 ' + (s.firstScore === null ? '―' : s.firstScore) + '/' + count(a) + '、最高 ' + s.best + '/' + count(a) + '、確認 ' + s.tries + ' 回' : '練習中'));
      if (s.checked) lines.push('　今回：' + score(a, s) + '/' + count(a) + ' が本文と一致');
      if (s.reflection) lines.push('　考えたこと（自動採点なし）：' + s.reflection);
    });
    return lines;
  }
  window.KoumonActivities = { restore: restore, initial: initial, renderMenu: renderMenu, render: render, act: act, summary: summary };
})();
