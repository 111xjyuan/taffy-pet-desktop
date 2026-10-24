// 独立版胶水层：命中区穿透 + 去计费 + 退出按钮
(function () {
  var api = window.taffyDesktop;
  if (!api) return;

  // 1) 只有鼠标压在塔菲身上时才让窗口接收事件，其余区域完全穿透
  var hovering = false;
  function visible(el) {
    if (!el) return false;
    var s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    var r = el.getBoundingClientRect();
    return !!(r.width && r.height);
  }
  // 可交互范围 = 塔菲本体 + 打开中的菜单 + 气泡（菜单在左侧，必须一起算，否则点不到）
  function hitRect() {
    // 菜单/气泡是挂在 body 上的，不在 #tp-root 里面
    var sels = ['#tp-root .tp-layers', '.tp-menu', '.tp-bubble'];
    var x = 1e9, y = 1e9, x2 = -1e9, y2 = -1e9, any = false;
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i]);
      if (!visible(el)) continue;
      var r = el.getBoundingClientRect();
      any = true;
      if (r.left < x) x = r.left;
      if (r.top < y) y = r.top;
      if (r.right > x2) x2 = r.right;
      if (r.bottom > y2) y2 = r.bottom;
    }
    return any ? { x: x, y: y, w: x2 - x, h: y2 - y } : null;
  }
  function insidePet(x, y) {
    var r = hitRect();
    if (!r) return false;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
  document.addEventListener('mousemove', function (e) {
    var over = insidePet(e.clientX, e.clientY);
    if (over !== hovering) { hovering = over; api.hover(over); }
  }, true);

  // 把命中矩形上报给主进程（它自己轮询光标，避免点击抢时序）
  var busy = false;
  document.addEventListener('pointerdown', function () { busy = true }, true);
  document.addEventListener('pointerup', function () { setTimeout(function () { busy = false }, 120) }, true);
  document.addEventListener('pointercancel', function () { busy = false }, true);


  if (api.bounds) {
    var lastJson = '';
    setInterval(function () {
      var r = hitRect();
      var payload = r
        ? { x: r.x, y: r.y, w: r.w, h: r.h, pad: 10, busy: busy }
        : { x: 0, y: 0, w: 0, h: 0, pad: 0, busy: busy };
      var j = JSON.stringify(payload);
      if (j !== lastJson) { lastJson = j; api.bounds(payload) }
    }, 150);
  }



  // 2) 去掉所有计费相关节点（余额、今日、本轮、计费设置组）
  var KILL = ['.tp-bal', '.tp-metas', '.tp-met'];
  function stripBilling(scope) {
    KILL.forEach(function (sel) {
      scope.querySelectorAll(sel).forEach(function (n) { n.remove() });
    });
    var BAD = /今日消耗|本轮消耗|按压弹出余额|刷新间隔|余额|计费|任务完成通知/;
    scope.querySelectorAll('.tp-row').forEach(function (row) {
      if (BAD.test(row.textContent || '')) row.remove();
    });
    // 「刷新余额」「计费显示」这类按钮/小标题也一起摘掉
    scope.querySelectorAll('.tp-menu button, .tp-menu .tp-sub, .tp-menu .tp-tip, .tp-menu .tp-sec, .tp-menu .tp-h, .tp-menu .tp-label').forEach(function (n) {
      var t = (n.textContent || '').trim();
      if (t && BAD.test(t) && !n.classList.contains('tp-switch')) n.remove();
    });
    // 菜单头部的金额块整个去掉，只留名字与形态
    scope.querySelectorAll('.tp-mstat').forEach(function (n) { n.remove() });
  }

  // 3) 菜单和气泡是整块重绘的，用 observer 每次重绘后清理
  var mo = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var t = list[i].target;
      var scope = (t.nodeType === 1) ? t : t.parentElement;
      if (scope) stripBilling(scope.closest('.tp-menu, .tp-bubble') || scope);
    }
  });

  // 3.5) 独立版没有计费，刷新余额按钮直接摘掉
  function stripRefresh() {
    document.querySelectorAll('.tp-menu [data-refresh-bal]').forEach(function (b) { b.remove() });
  }

  // 4) 菜单里加「退出桌宠」
  function addQuitButton() {
    var menu = document.querySelector('.tp-menu');
    if (!menu || menu.querySelector('.tp-quit')) return;
    var box = menu.querySelector('.tp-body-area') || menu;
    var btn = document.createElement('button');
    btn.className = 'tp-quit';
    btn.textContent = '退出桌宠';
    btn.style.cssText = 'margin:10px 12px 14px;padding:9px 0;width:calc(100% - 24px);border:1px solid #f0c3d8;' +
      'border-radius:10px;background:#fff6fa;color:#c2477e;font-size:13px;cursor:pointer';
    btn.addEventListener('click', function () { api.quit() });
    box.appendChild(btn);
  }

  // 调试：?menu=1 自动打开菜单
  if (/[?&]menu=1/.test(location.search)) {
    setTimeout(function () {
      var stage = document.querySelector('#tp-root .tp-stage');
      if (stage) stage.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    }, 3500);
  }

  var tries = 0;
  var timer = setInterval(function () {
    var root = document.getElementById('tp-root');
    if (!root) { if (++tries > 600) clearInterval(timer); return; }
    clearInterval(timer);
    mo.observe(document.body, { childList: true, subtree: true });
    stripBilling(document.body);
    setInterval(function () { stripBilling(document.body); stripRefresh(); addQuitButton() }, 600);
  }, 150);
})();
