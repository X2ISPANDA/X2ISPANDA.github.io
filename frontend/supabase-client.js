// LrcShare 前端共享 Supabase 客户端
// 使用 ANON_KEY（公开密钥）进行只读+投稿操作
(function() {
  // 等待 config.js 加载完成
  function getConfig() {
    return window.LRCSHAPE_CONFIG;
  }

  function initSupabase() {
    const config = getConfig();
    if (!config) {
      console.error('LRCSHAPE_CONFIG 未加载，请确保 config.js 已引入');
      return null;
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.error('Supabase SDK 未加载，请检查 CDN 脚本是否能正常访问');
      return null;
    }
    return window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  let supabase = initSupabase();
  // CDN 加载慢时的兜底：最多重试 5 秒
  if (!supabase) {
    let retries = 0;
    const tm = setInterval(() => {
      retries++;
      supabase = initSupabase();
      if (supabase || retries >= 25) clearInterval(tm);
    }, 200);
  }

  // 构造搜索结果（本地模糊搜索替代后端搜索 API）
  async function searchAll(keyword) {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return { artists: [], albums: [], songs: [] };

    // 1. 搜索艺术家（按名称匹配）
    const { data: artistResults, error: artistErr } = await supabase.from('artists').select('*').ilike('name', `%${kw}%`);
    if (artistErr) console.warn('artist search error:', artistErr);
    const matchedArtistIds = (artistResults || []).map(a => a.id);

    // 2. 搜索歌曲：按标题匹配 + 按艺术家匹配 + 按歌词匹配
    const songByTitle = supabase.from('songs').select('*, albums(name)').eq('status', 'published').ilike('title', `%${kw}%`);
    const songByArtist = matchedArtistIds.length > 0
      ? supabase.from('songs').select('*, albums(name)').eq('status', 'published').overlaps('artist_ids', matchedArtistIds)
      : null;
    const songByLrc = supabase.from('songs').select('*, albums(name)').eq('status', 'published').ilike('lrc_text', `%${kw}%`);

    // 3. 搜索专辑：按名称匹配 + 按艺术家匹配
    const albumByName = supabase.from('albums').select('*').ilike('name', `%${kw}%`);
    const albumByArtist = matchedArtistIds.length > 0
      ? supabase.from('albums').select('*').overlaps('artist_ids', matchedArtistIds)
      : null;

    // 按固定顺序执行，避免 filter(Boolean) 后索引错位
    const hasSongByArtist = songByArtist !== null;
    const hasAlbumByArtist = albumByArtist !== null;
    const queries = [];
    const IDX_SONG_TITLE = queries.push(songByTitle) - 1;
    const IDX_SONG_ARTIST = hasSongByArtist ? queries.push(songByArtist) - 1 : -1;
    const IDX_SONG_LRC = queries.push(songByLrc) - 1;
    const IDX_ALBUM_NAME = queries.push(albumByName) - 1;
    const IDX_ALBUM_ARTIST = hasAlbumByArtist ? queries.push(albumByArtist) - 1 : -1;

    const results = await Promise.all(queries);

    // 合并歌曲结果并去重
    const songMap = new Map();
    const allArtistIds = new Set();
    const addSongs = (res) => {
      if (!res || !res.data) return;
      res.data.forEach(s => {
        songMap.set(s.id, s);
        (s.artist_ids || []).forEach(id => allArtistIds.add(id));
      });
    };
    addSongs(results[IDX_SONG_TITLE]);
    if (hasSongByArtist) addSongs(results[IDX_SONG_ARTIST]);
    addSongs(results[IDX_SONG_LRC]);

    // 合并专辑结果并去重
    const albumMap = new Map();
    const addAlbums = (res) => {
      if (!res || !res.data) return;
      res.data.forEach(a => albumMap.set(a.id, a));
    };
    addAlbums(results[IDX_ALBUM_NAME]);
    if (hasAlbumByArtist) addAlbums(results[IDX_ALBUM_ARTIST]);

    // 获取艺术家名称映射
    const artistMap = {};
    if (allArtistIds.size > 0) {
      const { data: artistsData } = await supabase
        .from('artists')
        .select('id, name')
        .in('id', Array.from(allArtistIds));
      (artistsData || []).forEach(ar => {
        artistMap[ar.id] = ar.name;
      });
    }

    const songResults = Array.from(songMap.values()).map(s => {
      const names = (s.artist_ids || []).map(id => artistMap[id] || '').filter(Boolean);
      return {
        ...s,
        artist_name: names.join(' / ') || '未知',
        album_name: s.albums?.name || ''
      };
    });

    return { artists: artistResults || [], albums: Array.from(albumMap.values()), songs: songResults };
  }

  // 每次调用 API 之前兜底等 supabase client 就绪，避免 CDN 加载慢导致报错
  async function waitForClient() {
    if (supabase) return supabase;
    return new Promise((resolve, reject) => {
      let tries = 0;
      const tm = setInterval(() => {
        tries++;
        if (supabase) { clearInterval(tm); resolve(supabase); }
        else if (tries > 50) { clearInterval(tm); reject(new Error('Supabase client 初始化失败，请检查网络或 CDN 脚本')); }
      }, 100);
    });
  }

  // API 辅助函数（与前端 fetch API 兼容的格式）
  window.LRCSHAPE_API = {
    get supabase() { return supabase; },
    waitForClient,

    // 获取艺术家（带作品数时使用数据库RPC，避免全量拉取）
    async getArtists(options = {}) {
      const includeCount = options.includeCount || false;
      const limit = options.limit || null;

      if (includeCount && limit) {
        // 使用数据库RPC函数，GROUP BY + COUNT，只返回limit条
        const { data, error } = await supabase.rpc('get_top_artists', { limit_count: limit });
        if (error) throw error;
        return data || [];
      }

      // 不带count的简单查询
      let query = supabase
        .from('artists')
        .select('id, name, sort, avatar, types, disambiguation, is_show, aliases')
        .order('name');
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    // 获取单个艺术家
    async getArtist(id) {
      const { data, error } = await supabase.from('artists').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    // 按ID批量获取艺术家（只查需要的，不拉全表）
    async getArtistsByIds(ids) {
      if (!ids || ids.length === 0) return [];
      const { data, error } = await supabase
        .from('artists')
        .select('id, name, sort, avatar, types, disambiguation, is_show, aliases')
        .in('id', ids);
      if (error) throw error;
      return data || [];
    },

    // 获取同歌手的其他歌曲（只查相关歌曲，不拉全表）
    async getRelatedSongs(artistIds, excludeSongId) {
      if (!artistIds || artistIds.length === 0) return [];
      // 对每个artistId查询包含该artist的歌曲，然后去重
      const queries = artistIds.map(id =>
        supabase.from('songs')
          .select('id, title, artist_ids, album_id, duration, is_hidden, created_at, albums(name)')
          .eq('status', 'published')
          .contains('artist_ids', [id])
          .neq('id', excludeSongId)
      );
      const results = await Promise.all(queries);
      const seen = new Set();
      const songs = [];
      results.forEach(r => {
        (r.data || []).forEach(s => {
          if (!seen.has(s.id)) { seen.add(s.id); songs.push(s); }
        });
      });
      return songs;
    },

    // 获取艺术家的歌曲（数据库精确查询，不再全量拉取）
    async getArtistSongs(artistId) {
      // 查询1：artist_ids 数组包含该艺术家的歌曲（演唱）
      const { data: singData, error: err1 } = await supabase
        .from('songs')
        .select('*, albums(name, year)')
        .eq('status', 'published')
        .overlaps('artist_ids', [artistId])
        .order('created_at', { ascending: false });
      if (err1) throw err1;

      // 查询2：作词/作曲/编曲包含该艺术家的歌曲
      const { data: workData, error: err2 } = await supabase
        .from('songs')
        .select('*, albums(name, year)')
        .eq('status', 'published')
        .or(`lyricist.ilike.%${artistId}%,composer.ilike.%${artistId}%,arranger.ilike.%${artistId}%`)
        .order('created_at', { ascending: false });
      if (err2) throw err2;

      // 合并去重
      const songMap = new Map();
      [...(singData || []), ...(workData || [])].forEach(s => {
        if (!songMap.has(s.id)) songMap.set(s.id, s);
      });

      // 收集所有 artist_ids 用于解析名称
      const allArtistIds = new Set();
      Array.from(songMap.values()).forEach(s => {
        (s.artist_ids || []).forEach(id => allArtistIds.add(id));
      });

      // 批量查询艺术家名称
      const artistMap = {};
      if (allArtistIds.size > 0) {
        const { data: artistsData } = await supabase
          .from('artists')
          .select('id, name')
          .in('id', Array.from(allArtistIds));
        (artistsData || []).forEach(ar => {
          artistMap[ar.id] = ar.name;
        });
      }

      return Array.from(songMap.values()).map(s => {
        const ids = s.artist_ids || [];
        const names = ids.map(id => artistMap[id] || id).filter(Boolean);
        return {
          ...s,
          artist_name: names.join(' / ') || '',
          album_name: s.albums?.name || '',
          album_year: s.albums?.year || ''
        };
      });
    },

    // 获取艺术家的专辑（数据库精确查询）
    async getArtistAlbums(artistId) {
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .overlaps('artist_ids', [artistId])
        .order('name');
      if (error) throw error;

      // 收集所有 artist_ids
      const allArtistIds = new Set();
      (data || []).forEach(a => {
        (a.artist_ids || []).forEach(id => allArtistIds.add(id));
      });

      // 批量查询艺术家信息
      const artistMap = {};
      if (allArtistIds.size > 0) {
        const { data: artistsData } = await supabase
          .from('artists')
          .select('id, name')
          .in('id', Array.from(allArtistIds));
        (artistsData || []).forEach(ar => {
          artistMap[ar.id] = ar;
        });
      }

      return (data || []).map(a => {
        const ids = a.artist_ids || [];
        const names = ids.map(id => artistMap[id]?.name || '').filter(Boolean);
        return {
          ...a,
          artist_name: names.join(' / ') || '未知',
          artists: ids.map(id => artistMap[id]).filter(Boolean)
        };
      });
    },

    // 获取所有专辑
    async getAlbums(includeCount = false) {
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .order('name');
      if (error) throw error;

      // 收集所有 artist_ids
      const allArtistIds = new Set();
      (data || []).forEach(a => {
        (a.artist_ids || []).forEach(id => allArtistIds.add(id));
      });

      // 批量查询艺术家信息（1次请求）
      const artistMap = {};
      if (allArtistIds.size > 0) {
        const { data: artistsData } = await supabase
          .from('artists')
          .select('id, name')
          .in('id', Array.from(allArtistIds));
        (artistsData || []).forEach(ar => {
          artistMap[ar.id] = ar;
        });
      }

      // 批量查询所有专辑的歌曲数（1次请求，替代N次）
      const countMap = {};
      if (includeCount && data && data.length > 0) {
        const albumIds = data.map(a => a.id);
        const { data: countData } = await supabase
          .from('songs')
          .select('album_id')
          .in('album_id', albumIds)
          .eq('status', 'published');
        (countData || []).forEach(s => {
          if (s.album_id) countMap[s.album_id] = (countMap[s.album_id] || 0) + 1;
        });
      }

      return (data || []).map(a => {
        const ids = a.artist_ids || [];
        const names = ids.map(id => artistMap[id]?.name || '').filter(Boolean);
        const result = {
          ...a,
          artist_name: names.join(' / ') || '未知',
          artists: ids.map(id => artistMap[id]).filter(Boolean)
        };
        if (includeCount) result.song_count = countMap[a.id] || 0;
        return result;
      });
    },

    // 获取单个专辑
    async getAlbum(id) {
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;

      // 获取艺术家信息
      const ids = data.artist_ids || [];
      const artistMap = {};
      if (ids.length > 0) {
        const { data: artistsData } = await supabase
          .from('artists')
          .select('id, name, is_show')
          .in('id', ids);
        (artistsData || []).forEach(ar => {
          artistMap[ar.id] = ar;
        });
      }

      const names = ids.map(id => artistMap[id]?.name || '').filter(Boolean);
      return {
        ...data,
        artist_name: names.join(' / ') || '未知',
        artists: ids.map(id => artistMap[id]).filter(Boolean)
      };
    },

    // 获取专辑的歌曲
    async getAlbumSongs(albumId) {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('album_id', albumId)
        .eq('status', 'published')
        .order('track');
      if (error) throw error;

      // 批量查询艺术家信息
      const allArtistIds = new Set();
      (data || []).forEach(s => {
        (s.artist_ids || []).forEach(id => allArtistIds.add(id));
      });

      const artistMap = {};
      if (allArtistIds.size > 0) {
        const { data: artistsData } = await supabase
          .from('artists')
          .select('id, name')
          .in('id', Array.from(allArtistIds));
        (artistsData || []).forEach(ar => {
          artistMap[ar.id] = ar.name;
        });
      }

      return (data || []).map(s => {
        const names = (s.artist_ids || []).map(id => artistMap[id] || '').filter(Boolean);
        return {
          ...s,
          artist_name: names.join(' / ') || '未知'
        };
      });
    },

    // 获取所有歌曲（不含 lrc_text，用于列表展示）
    async getSongs(limit) {
      let query = supabase
        .from('songs')
        .select('id, title, artist_ids, album_id, lyricist, composer, arranger, duration, status, is_hidden, created_at, albums(name)')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;

      // 批量查询艺术家信息
      const allArtistIds = new Set();
      (data || []).forEach(s => {
        (s.artist_ids || []).forEach(id => allArtistIds.add(id));
      });

      const artistMap = {};
      if (allArtistIds.size > 0) {
        const { data: artistsData } = await supabase
          .from('artists')
          .select('id, name')
          .in('id', Array.from(allArtistIds));
        (artistsData || []).forEach(ar => {
          artistMap[ar.id] = ar.name;
        });
      }

      return (data || []).map(s => {
        const names = (s.artist_ids || []).map(id => artistMap[id] || '').filter(Boolean);
        return {
          ...s,
          artist_name: names.join(' / ') || '未知',
          album_name: s.albums?.name || ''
        };
      });
    },

    // 获取单个歌曲
    async getSong(id) {
      const { data, error } = await supabase
        .from('songs')
        .select('*, albums(name)')
        .eq('id', id)
        .single();
      if (error) throw error;

      // 获取艺术家信息
      const ids = data.artist_ids || [];
      const artistMap = {};
      if (ids.length > 0) {
        const { data: artistsData } = await supabase
          .from('artists')
          .select('id, name, is_show')
          .in('id', ids);
        (artistsData || []).forEach(ar => {
          artistMap[ar.id] = ar;
        });
      }

      const names = ids.map(id => artistMap[id]?.name || '').filter(Boolean);
      return {
        ...data,
        artist_name: names.join(' / ') || '未知',
        artists: ids.map(id => artistMap[id]).filter(Boolean),
        album_name: data.albums?.name || ''
      };
    },

    // 搜索
    async search(keyword) {
      return searchAll(keyword);
    },

    // 提交投稿
    async submitSubmission(payload) {
      const songData = {
        type: payload.type || 'song',
        title: payload.title || '',
        artist: payload.artist || '',
        album: payload.album || '',
        year: payload.year || '',
        lyricist: payload.lyricist || '',
        composer: payload.composer || '',
        arranger: payload.arranger || '',
        duration: payload.duration || '',
        lrc_text: payload.lrc_text || '',
        video_url: payload.video_url || ''
      };

      const { data, error } = await supabase
        .from('submissions')
        .insert([{
          id: 'sub' + Date.now(),
          user_name: payload.submitter_name || '匿名',
          user_email: payload.submitter_email || '',
          song_data: songData,
          status: 'pending',
          created_at: new Date().toISOString()
        }])
        .select();
      if (error) throw error;
      return data?.[0] || null;
    },

    // 评论 (使用 comments 表，支持楼中楼+身份标识+口令验证)
    async getComments(songId) {
      try {
        const { data, error } = await supabase
          .from('comments')
          .select('*')
          .eq('song_id', songId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true });
        if (error) return [];

        // 查询所有贡献者（含口令哈希），用于身份标识匹配
        const { data: contributors } = await supabase
          .from('contributors')
          .select('id, name, is_owner, avatar, tags, verify_code_hash');
        const contributorMap = {};
        (contributors || []).forEach(c => {
          contributorMap[c.name.toLowerCase()] = c;
        });

        // 为每条评论附加贡献者信息
        return (data || []).map(c => {
          const matched = contributorMap[(c.author || '').toLowerCase()];
          return {
            ...c,
            contributor: matched || null,
            is_owner: matched?.is_owner || false,
            is_contributor: !!matched
          };
        });
      } catch (e) {
        return [];
      }
    },

    async addComment(songId, content, author = '匿名', email = '', parentId = null, rootId = null) {
      const { data, error } = await supabase
        .from('comments')
        .insert([{
          id: 'cmt' + Date.now() + Math.random().toString(36).slice(2, 6),
          song_id: songId,
          author,
          email,
          parent_id: parentId,
          root_id: rootId || parentId, // 回复时自动关联根评论
          content,
          created_at: new Date().toISOString()
        }])
        .select();
      if (error) throw error;
      return data?.[0] || null;
    },

    // 验证口令：检查昵称+口令哈希是否匹配
    async verifyContributor(name, verifyCode) {
      try {
        const hash = await this.sha256(verifyCode);
        const { data, error } = await supabase
          .from('contributors')
          .select('id, name, is_owner, avatar, tags')
          .ilike('name', name)
          .eq('verify_code_hash', hash);
        if (error || !data || data.length === 0) return null;
        return data[0];
      } catch (e) {
        return null;
      }
    },

    // 修改口令（验证通过后，贡献者可自行修改）
    async changeVerifyCode(contributorId, oldCode, newCode) {
      try {
        const oldHash = await this.sha256(oldCode);
        const newHash = await this.sha256(newCode);
        // 先验证旧口令
        const { data: verify } = await supabase
          .from('contributors')
          .select('id')
          .eq('id', contributorId)
          .eq('verify_code_hash', oldHash);
        if (!verify || verify.length === 0) {
          return { success: false, error: '旧口令不正确' };
        }
        // 更新为新口令
        const { error } = await supabase
          .from('contributors')
          .update({ verify_code_hash: newHash })
          .eq('id', contributorId);
        if (error) throw error;
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    // SHA-256 哈希函数
    async sha256(str) {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // 删除评论（软删除）
    async deleteComment(id) {
      const { error } = await supabase
        .from('comments')
        .update({ is_deleted: true })
        .eq('id', id);
      if (error) throw error;
      return true;
    },

    // 获取所有赞助者（按金额降序）
    async getSponsors() {
      const { data, error } = await supabase
        .from('sponsors')
        .select('*')
        .order('amount', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    // ============= 文章 (articles) =============

    // 获取文章列表（按类型/状态过滤）
    async getArticles(options = {}) {
      const { status = 'published', limit, includeDrafts = false } = options;
      let query = supabase.from('articles').select('*');
      if (!includeDrafts) {
        query = query.eq('status', status);
      }
      query = query.order('sort', { ascending: true }).order('created_at', { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    // 按 slug 获取单篇文章
    async getArticleBySlug(slug) {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .single();
      if (error) throw error;
      // 增加浏览量（使用简单的自增，非原子）
      try {
        await supabase.from('articles').update({ views: (data.views || 0) + 1 }).eq('id', data.id);
      } catch (e) { /* 忽略 */ }
      return data;
    },

    // 按 id 获取单篇文章
    async getArticle(id) {
      const { data, error } = await supabase.from('articles').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    // ============= 贡献者 (contributors) =============

    // 获取贡献者（带歌曲数时使用数据库RPC，避免全量拉取）
    async getContributors(options = {}) {
      if (options.limit) {
        // 使用数据库RPC函数，GROUP BY + COUNT，只返回limit条
        const { data, error } = await supabase.rpc('get_top_contributors', { limit_count: options.limit });
        if (error) throw error;
        return data || [];
      }

      // 无limit时走普通查询（用于列表页等场景）
      const { data, error } = await supabase
        .from('contributors')
        .select('id, name, avatar, bio, public_bio, contact_value, public_contact, is_owner, created_at, sort, tags')
        .order('sort');
      if (error) throw error;
      return data || [];
    },

    // 获取单个贡献者
    async getContributor(id) {
      const { data, error } = await supabase
        .from('contributors')
        .select('id, name, avatar, bio, public_bio, contact_value, public_contact, tags, is_owner, created_at, sort')
        .eq('id', id).single();
      if (error) throw error;
      if (data) {
        // 动态计算该贡献者的歌曲数
        const { count } = await supabase
          .from('songs')
          .select('id', { count: 'exact', head: true })
          .eq('contributor_id', id)
          .eq('status', 'published');
        data.song_count = count || 0;
      }
      return data;
    },

    // 获取某贡献者的所有作品（优先使用 songs 表的 contributor_id 关联）
    async getContributorWorks(contributorId) {
      // 1. 优先从 songs 表获取（已发布的歌词）
      const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select('id, title, artist_ids, created_at')
        .eq('contributor_id', contributorId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      
      if (!songsError && songs && songs.length > 0) {
        // 批量查询艺术家信息
        const allArtistIds = new Set();
        songs.forEach(s => {
          (s.artist_ids || []).forEach(id => allArtistIds.add(id));
        });

        const artistMap = {};
        if (allArtistIds.size > 0) {
          const { data: artistsData } = await supabase
            .from('artists')
            .select('id, name')
            .in('id', Array.from(allArtistIds));
          (artistsData || []).forEach(ar => {
            artistMap[ar.id] = ar.name;
          });
        }

        return songs.map(s => {
          const names = (s.artist_ids || []).map(id => artistMap[id] || '').filter(Boolean);
          return {
            id: s.id,
            title: s.title,
            artist: names.join(' / ') || '',
            type: 'song',
            created_at: s.created_at
          };
        });
      }
      
      // 2. 如果 songs 表没有数据，回退到 submissions 表（按提交者名模糊匹配）
      // 注意：只 select 必要字段，避免 song_data 里的歌词内容造成响应过大
      const contributor = await this.getContributor(contributorId);
      if (contributor?.name) {
        const { data: submissions } = await supabase
          .from('submissions')
          .select('id, created_at, song_data->title, song_data->artist, song_data->type')
          .eq('status', 'approved')
          .ilike('user_name', `%${contributor.name}%`)
          .order('created_at', { ascending: false });
        
        return (submissions || []).map(s => ({
          id: s.id,
          title: s['song_data->title'] || s.title || '',
          artist: s['song_data->artist'] || s.artist || '',
          type: s['song_data->type'] || 'song',
          created_at: s.created_at
        }));
      }
      
      return [];
    },

    // ============= 友链分类 (friend_categories) =============

    async getFriendCategories() {
      const { data, error } = await supabase
        .from('friend_categories')
        .select('*')
        .order('sort', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    // ============= 友链 (friends) =============

    async getFriends() {
      // 先获取分类
      const categories = await this.getFriendCategories();
      const catMap = {};
      categories.forEach(c => { catMap[c.id] = c; });

      // 获取友链并关联分类
      const { data, error } = await supabase
        .from('friends')
        .select('*')
        .order('sort', { ascending: true }).order('created_at', { ascending: false });
      if (error) throw error;

      // 合并分类信息
      return (data || []).map(f => ({
        ...f,
        category: f.category_id ? catMap[f.category_id] : null
      }));
    },

    // ============= 投稿扩展 =============

    // 投稿时附带贡献者公开选项
    async submitSubmissionV2(payload) {
      const songData = {
        type: payload.type || 'song',
        title: payload.title || '',
        artist: payload.artist || '',
        album: payload.album || '',
        year: payload.year || '',
        lyricist: payload.lyricist || '',
        composer: payload.composer || '',
        arranger: payload.arranger || '',
        duration: payload.duration || '',
        lrc_text: payload.lrc_text || '',
        video_url: payload.video_url || ''
      };

      const { data, error } = await supabase
        .from('submissions')
        .insert([{
          id: 'sub' + Date.now(),
          user_name: payload.submitter_name || '匿名',
          user_email: payload.submitter_email || '',
          contact_value: payload.contact_value || {},
          submitter_public_contact: !!payload.submitter_public_contact,
          // 投稿人选择的贡献者关联 & 操作标记
          contributor_id: payload.contributor_id || null,
          submitter_request_update: !!payload.submitter_request_update,
          submitter_request_clear:  !!payload.submitter_request_clear,
          submitter_bio: payload.submitter_bio,
          song_data: songData,
          status: 'pending',
          created_at: new Date().toISOString()
        }])
        .select();
      if (error) throw error;
      return data?.[0] || null;
    }
  };

  // 统一给所有 async API 方法包一层 waitForClient，避免 CDN 加载竞态
  (function wrapAsync() {
    Object.keys(window.LRCSHAPE_API).forEach(key => {
      const fn = window.LRCSHAPE_API[key];
      if (typeof fn === 'function' && fn.constructor.name === 'AsyncFunction') {
        window.LRCSHAPE_API[key] = async function(...args) {
          await waitForClient();
          return fn.apply(this, args);
        };
      }
    });
  })();
})();
