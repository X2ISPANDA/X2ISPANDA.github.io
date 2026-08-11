/**
 * layout.js - 共享布局组件
 * 统一注入导航栏、页脚、搜索弹窗，各页面只需引入此文件
 * 修改导航栏/页脚只需改这一个文件
 */
(function () {
  'use strict';

  // ============ 1. 共享 CSS（导航栏艺术字动画） ============
  const sharedStyle = document.createElement('style');
  sharedStyle.textContent = `
    .nav-art-title {
      display: inline-block;
      background: linear-gradient(135deg, #ec4899 0%, #a855f7 33%, #3b82f6 66%, #06b6d4 100%);
      background-size: 300% 300%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      color: transparent;
      letter-spacing: 1px;
      transform-style: preserve-3d;
      animation: gradient-shift 3s ease infinite, nav-float 2.5s ease-in-out infinite, nav-glow 2s ease-in-out infinite;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .nav-art-title:hover {
      animation: gradient-shift 1s ease infinite, nav-3d-shake 0.4s ease-in-out infinite;
      transform: scale(1.15) rotateY(20deg) rotateX(10deg);
      filter: drop-shadow(0 0 12px rgba(236, 72, 153, 0.9)) drop-shadow(0 0 24px rgba(168, 85, 247, 0.6));
    }
    @keyframes gradient-shift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
    @keyframes nav-float { 0%,100%{transform:translateY(0) rotateZ(0deg)} 33%{transform:translateY(-4px) rotateZ(-2deg)} 66%{transform:translateY(-2px) rotateZ(1deg)} }
    @keyframes nav-glow { 0%,100%{filter:drop-shadow(0 0 4px rgba(236,72,153,.4))} 50%{filter:drop-shadow(0 0 10px rgba(236,72,153,.7)) drop-shadow(0 0 16px rgba(168,85,247,.4))} }
    @keyframes nav-3d-shake { 0%,100%{transform:scale(1.15) rotateY(20deg) rotateX(10deg) rotateZ(0deg)} 25%{transform:scale(1.18) rotateY(-15deg) rotateX(-5deg) rotateZ(-5deg)} 75%{transform:scale(1.18) rotateY(25deg) rotateX(15deg) rotateZ(5deg)} }
    /* 搜索弹窗动画 */
    @keyframes searchIn { from{opacity:0;transform:scale(.95) translateY(-10px)} to{opacity:1;transform:scale(1) translateY(0)} }
    .animate-search-in { animation: searchIn 0.2s ease-out; }
  `;
  document.head.appendChild(sharedStyle);

  // ============ 2. 检测当前页面，确定高亮项 ============
  const LOGO_URL = 'https://i0.hdslb.com/bfs/article/a2323ad6e33924c39061b35ae29f9fd937977624.png';
  const path = location.pathname;
  const filename = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
  const params = new URLSearchParams(location.search);
  const isTutorial = params.get('type') === 'tutorial';

  // 导航项定义：match 为匹配的文件名数组
  const navItems = [
    { href: './index.html', label: '首页', match: ['index.html'] },
    { href: './artists.html', label: '艺术家库', match: ['artists.html', 'artist.html'] },
    { href: './albums.html', label: '专辑库', match: ['albums.html', 'album.html'] },
    { href: './contributors.html', label: '贡献者', match: ['contributors.html', 'contributor.html'] },
    { href: '#', label: '搜索', match: ['search.html'], onclick: 'openSearchOverlay(event)' },
    { href: './posts.html', label: '逼逼', match: ['posts.html', 'post.html'] },
    { href: './submit.html', label: '我要投稿', match: ['submit.html'] },
    { href: './support.html', label: '赞助', match: ['support.html'] },
    { href: './about.html', label: '关于', match: ['about.html'] },
    { href: './links.html', label: '友链', match: ['links.html'] },
  ];

  function isNavActive(item) {
    if (item.onclick) return item.match.includes(filename);
    if (item.active) return item.match.includes(filename) && item.active();
    return item.match.includes(filename);
  }

  // ============ 3. 构建 Header ============
  const navLinksHtml = navItems.map(item => {
    const active = isNavActive(item);
    const cls = active ? 'hover:text-pink-600 font-medium text-pink-600' : 'hover:text-pink-600';
    const onclick = item.onclick ? ` onclick="${item.onclick}"` : '';
    return `<a href="${item.href}" class="${cls}"${onclick}>${item.label}</a>`;
  }).join('\n        ');

  const headerHtml = `
  <header class="bg-white shadow-sm sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="./index.html" class="flex items-center gap-2 text-2xl font-bold">
        <img src="${LOGO_URL}" alt="LrcShare Logo" class="w-8 h-8" />
        <span class="nav-art-title">LrcShare</span>
      </a>
      <nav class="hidden md:flex gap-6 text-gray-600">
        ${navLinksHtml}
      </nav>
    </div>
  </header>`;

  // ============ 4. 构建 Footer ============
  const footerHtml = `
  <footer class="bg-gray-800 text-white py-12 mt-12">
    <div class="max-w-6xl mx-auto px-4 text-center">
      <p class="mb-4">&copy; 2023-2026 LrcShare. 全球最小滚动歌词分享网站</p>
      <p class="mb-2 text-sm text-gray-400">
        <span id="busuanzi_container_site_pv" style="display:none">👁 总访问量 <span id="busuanzi_value_site_pv"></span> 次</span>
        <span class="mx-2">·</span>
        <span id="busuanzi_container_site_uv" style="display:none">👥 访客 <span id="busuanzi_value_site_uv"></span> 人</span>
        <span class="mx-2">·</span>
        <span id="busuanzi_container_page_pv" style="display:none">📄 本页 <span id="busuanzi_value_page_pv"></span> 次</span>
      </p>
      <div class="flex flex-wrap justify-center gap-x-6 gap-y-2 text-gray-400 text-sm">
        <a href="./posts.html" class="hover:text-white">逼逼</a>
        <a href="./about.html" class="hover:text-white">关于</a>
        <a href="./contributors.html" class="hover:text-white">贡献者</a>
        <a href="./links.html" class="hover:text-white">友链</a>
        <a href="./support.html" class="hover:text-white">赞助</a>
        <a href="../admin/index.html" class="hover:text-white">管理后台</a>
      </div>
    </div>
  </footer>`;

  // ============ 5. 搜索弹窗 ============
  const overlayHtml = `
  <div id="searchOverlay" class="fixed inset-0 z-[9999] hidden">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeSearchOverlay()"></div>
    <div class="relative min-h-screen flex items-start justify-center pt-[8vh] px-4">
      <div class="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-search-in">
        <div class="flex items-center gap-3 p-4 border-b">
          <svg class="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" id="overlaySearchInput" placeholder="搜索歌曲、歌手或歌词内容..." class="flex-1 py-2 text-lg text-gray-800 focus:outline-none bg-transparent" autocomplete="off" />
          <span class="hidden sm:inline-block text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Enter 搜索</span>
          <button onclick="closeSearchOverlay()" class="p-1 hover:bg-gray-100 rounded transition">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div id="overlaySearchContent" class="max-h-[70vh] overflow-y-auto">
          <div class="p-8 text-center text-gray-400">
            <div class="text-4xl mb-3">🔍</div>
            <div>输入关键词开始搜索</div>
            <div class="text-xs mt-2 text-gray-300">支持按 歌手 / 专辑 / 单曲 / 歌词内容 搜索</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  // ============ 6. 注入到页面 ============
  // 在 body 最前面插入 header
  document.body.insertAdjacentHTML('afterbegin', headerHtml);

  // 在 body 末尾插入 footer + search overlay
  document.body.insertAdjacentHTML('beforeend', footerHtml + overlayHtml);

  // ============ 7. 搜索弹窗逻辑 ============
  const api = window.LRCSHAPE_API;
  let overlaySearchTimer = null;

  window.openSearchOverlay = function (e) {
    if (e) e.preventDefault();
    const overlay = document.getElementById('searchOverlay');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('overlaySearchInput').focus(), 100);
  };

  window.openSearchOverlayWithKeyword = function (keyword) {
    const overlay = document.getElementById('searchOverlay');
    const overlayInput = document.getElementById('overlaySearchInput');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      overlayInput.value = keyword;
      overlayInput.focus();
      doOverlaySearch(keyword);
    }, 100);
  };

  window.closeSearchOverlay = function () {
    const overlay = document.getElementById('searchOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }
  };

  // Esc 关闭 / Ctrl+K 打开
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('searchOverlay');
      if (overlay && !overlay.classList.contains('hidden')) closeSearchOverlay();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearchOverlay();
    }
  });

  function highlight(text, keyword) {
    if (!keyword) return text;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<span class="text-pink-500 font-bold">$1</span>');
  }

  const overlayInput = document.getElementById('overlaySearchInput');
  if (overlayInput) {
    overlayInput.addEventListener('input', (e) => {
      clearTimeout(overlaySearchTimer);
      const value = e.target.value.trim();
      if (!value) {
        document.getElementById('overlaySearchContent').innerHTML = '<div class="p-8 text-center text-gray-400"><div class="text-4xl mb-3">🔍</div><div>输入关键词开始搜索</div></div>';
        return;
      }
      overlaySearchTimer = setTimeout(() => doOverlaySearch(value), 300);
    });
    overlayInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) doOverlaySearch(e.target.value.trim());
    });
  }

  async function doOverlaySearch(keyword) {
    const content = document.getElementById('overlaySearchContent');
    content.innerHTML = '<div class="p-8 text-center text-gray-400">搜索中...</div>';
    try {
      const data = await api.search(keyword);
      renderOverlayResults(data, keyword);
    } catch (err) {
      content.innerHTML = '<div class="p-8 text-center text-gray-400">搜索失败</div>';
    }
  }

  function formatDuration(d) {
    if (!d || d === 'NULL' || d === 'null') return '--:--';
    let s = String(d).trim().split('.')[0];
    const parts = s.split(':');
    if (parts.length === 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return s;
  }

  function renderOverlayResults(data, keyword) {
    const content = document.getElementById('overlaySearchContent');
    let html = '';

    const artists = data.artists || [];
    if (artists.length > 0) {
      html += `<div class="px-5 pt-4 pb-2"><span class="text-xs font-semibold text-gray-400 uppercase">🎤 歌手</span> <span class="text-xs text-gray-400">(${artists.length})</span></div><div class="grid grid-cols-2 md:grid-cols-3 gap-1 px-3 pb-2">`;
      html += artists.map(artist => {
        const avatar = artist.avatar || LOGO_URL;
        const disambiguation = artist.disambiguation ? ` <span class="text-xs text-purple-500">(${artist.disambiguation})</span>` : '';
        return `<a href="./artist.html?id=${artist.id}" onclick="closeSearchOverlay()" class="flex items-center gap-2 px-3 py-2 hover:bg-pink-50 rounded-lg transition"><img src="${avatar}" class="w-8 h-8 rounded-full bg-gray-100 object-contain" /><div class="text-sm font-medium text-gray-800 truncate">${highlight(artist.name, keyword)}${disambiguation}</div></a>`;
      }).join('') + '</div>';
    }

    const albums = data.albums || [];
    if (albums.length > 0) {
      html += `<div class="px-5 pt-3 pb-2 border-t"><span class="text-xs font-semibold text-gray-400 uppercase">💿 专辑</span> <span class="text-xs text-gray-400">(${albums.length})</span></div><div class="grid grid-cols-2 md:grid-cols-3 gap-1 px-3 pb-2">`;
      html += albums.map(album => `<a href="./album.html?id=${album.id}" onclick="closeSearchOverlay()" class="flex items-center gap-2 px-3 py-2 hover:bg-pink-50 rounded-lg transition"><div class="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded flex items-center justify-center text-white text-xs shrink-0">💿</div><div class="text-sm font-medium text-gray-800 truncate">${highlight(album.name, keyword)}</div></a>`).join('') + '</div>';
    }

    const songs = data.songs || [];
    if (songs.length > 0) {
      html += `<div class="px-5 pt-3 pb-2 border-t"><span class="text-xs font-semibold text-gray-400 uppercase">🎵 单曲</span> <span class="text-xs text-gray-400">(${songs.length})</span></div><div class="divide-y">`;
      html += songs.map(song => {
        const lrcLower = (song.lrc_text || '').toLowerCase();
        let snippet = '';
        const idx = lrcLower.indexOf(keyword.toLowerCase());
        if (idx !== -1) {
          const start = Math.max(0, idx - 25);
          const end = Math.min((song.lrc_text || '').length, idx + keyword.length + 25);
          snippet = (song.lrc_text || '').substring(start, end).replace(/\[.*?\]/g, '');
        }
        return `<a href="./song.html?id=${song.id}" onclick="closeSearchOverlay()" class="flex items-center gap-3 px-5 py-3 hover:bg-pink-50 transition"><div class="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center text-pink-600 text-xs shrink-0">🎵</div><div class="flex-1 min-w-0"><div class="text-sm font-medium text-gray-800 truncate">${highlight(song.title, keyword)}</div><div class="text-xs text-gray-500 truncate">${highlight(song.artist_name, keyword)} · ${highlight(song.album_name, keyword)}</div>${snippet ? `<div class="text-xs text-gray-400 mt-0.5 truncate">...${highlight(snippet, keyword)}...</div>` : ''}</div><span class="text-xs text-gray-400 shrink-0 tabular-nums">${formatDuration(song.duration)}</span></a>`;
      }).join('') + '</div>';
    }

    if (!html) html = `<div class="p-10 text-center"><div class="text-5xl mb-3">😔</div><div class="text-gray-400">没有找到与 "${keyword}" 相关的结果</div></div>`;
    content.innerHTML = html;
  }

  // ============ 8. 不蒜子统计 ============
  const busuanziScript = document.createElement('script');
  busuanziScript.async = true;
  busuanziScript.src = '//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
  document.body.appendChild(busuanziScript);
})();
