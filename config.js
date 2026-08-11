// LrcShare Supabase 配置
// ANON_KEY 是公开密钥，可在前端使用（只读+投稿权限）
// 管理后台通过 Supabase Auth 登录获得写入权限，无需 SERVICE_ROLE_KEY

const SUPABASE_URL = 'https://spb-fr3kfwlu71j1wx89.supabase.opentrust.net';

// 匿名密钥（公开）- 用于前台展示页和投稿页
const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNwYi1mcjNrZndsdTcxajF3eDg5IiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODU5Nzk0MjcsImV4cCI6MjEwMTU1NTQyN30.96Ml9CB_eg0tdECDU3qJgqHFPNqx--kRYze5-_mZ3jA';

// 导出配置到全局变量
window.LRCSHAPE_CONFIG = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
};
