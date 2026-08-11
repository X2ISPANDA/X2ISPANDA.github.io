// 基于 Iconify CDN 的图标系统
// 文档：https://iconify.design/
// 渲染方式：<span class="iconify" style="font-size:24px" data-icon="mdi:wechat"></span>

const ICON_MAP = {
  // 社交平台图标（艺术家页/艺术家库页）
  instagram: 'mdi:instagram',
  weibo: 'mdi:weibo',
  bilibili: 'fa7-brands:bilibili',
  netease: 'thesvg-color:netease-cloud-music',
  qq: 'thesvg-color:qq',
  github: 'mdi:github',

  // 联系方式图标（贡献者页）
  'QQ': 'thesvg-color:qq',
  '微信': 'thesvg-color:wechat',
  '邮箱': 'material-icon-theme:email',
  'Email': 'material-icon-theme:email',
  'B站': 'fa7-brands:bilibili',
  'Bilibili': 'fa7-brands:bilibili',
  'GitHub': 'mdi:github',
  '博客': 'mdi:blogger',
  '抖音': 'simple-icons:douyin',
  '微博': 'mdi:weibo',
  'Twitter': 'mdi:twitter',
  '小红书': 'thesvg-color:xiaohongshu',
  '网易音乐人': 'thesvg-color:netease-cloud-music',
  '个人主页': 'mdi:link-variant',
  '电话': 'mdi:phone',
  '手机': 'mdi:cellphone',

  // 通用图标
  'link': 'mdi:link-variant',
  'arrow-left': 'mdi:arrow-left',
  'file': 'mdi:file-document-outline',
  'music': 'mdi:music-note'
};

function renderSocialIcon(key) {
  const icon = ICON_MAP[key] || 'mdi:link-variant';
  return `<span class="iconify" data-icon="${icon}"></span>`;
}

function renderContactIcon(key) {
  const icon = ICON_MAP[key] || 'mdi:email';
  return `<span class="iconify w-5 h-5 inline-flex items-center justify-center" data-icon="${icon}"></span>`;
}

function getIcon(key) {
  return ICON_MAP[key] || 'mdi:circle';
}
