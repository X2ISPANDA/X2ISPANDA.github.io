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
    return window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  const supabase = initSupabase();

  // 统计某艺术家的总作品数（演唱+作词+作曲+编曲）
  async function getArtistWorkCount(artistId) {
    const { data, error } = await supabase
      .from('songs')
      .select('id, artist_ids, lyricist, composer, arranger')
      .eq('status', 'published');
    if (error) return 0;
    // 使用 split 精确匹配ID，避免子串误匹配
    const containsId = (field, targetId) => {
      if (!field) return false;
      return field.split(',').map(x => x.trim()).includes(targetId);
    };
    return (data || []).filter(s => {
      // artist_ids 数组包含该艺术家
      if (s.artist_ids && Array.isArray(s.artist_ids) && s.artist_ids.includes(artistId)) return true;
      if (containsId(s.lyricist, artistId)) return true;
      if (containsId(s.composer, artistId)) return true;
      if (containsId(s.arranger, artistId)) return true;
      return false;
    }).length;
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

  // API 辅助函数（与前端 fetch API 兼容的格式）
  window.LRCSHAPE_API = {
    supabase,

    // 获取所有艺术家，可选获取作品数
    async getArtists(includeCount = false) {
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .order('name');
      if (error) throw error;

      if (includeCount && data.length > 0) {
        const counts = await Promise.all(data.map(a => getArtistWorkCount(a.id)));
        const artists = data.map((a, i) => ({ ...a, song_count: counts[i] }));
        // 排序：sort>0 的置顶（数字越小越靠前），sort=0 的按作品数降序
        artists.sort((a, b) => {
          const sa = a.sort || 0;
          const sb = b.sort || 0;
          if (sa > 0 && sb > 0) return sa - sb;       // 都是置顶，按sort升序
          if (sa > 0) return -1;                        // a置顶，排前面
          if (sb > 0) return 1;                         // b置顶，排前面
          return b.song_count - a.song_count || a.name.localeCompare(b.name);  // 都不置顶，按作品数降序
        });
        return artists;
      }
      return data;
    },

    // 获取单个艺术家
    async getArtist(id) {
      const { data, error } = await supabase.from('artists').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    // 获取艺术家的作品
    async getArtistSongs(artistId) {
      // 先获取所有已发布歌曲
      const { data, error } = await supabase
        .from('songs')
        .select('*, albums(name, year)')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // 过滤出包含该艺术家的歌曲（artist_ids 数组或 lyricist/composer/arranger 字段）
      const containsId = (field, targetId) => {
        if (!field) return false;
        return field.split(',').map(x => x.trim()).includes(targetId);
      };

      const filtered = (data || []).filter(s => {
        // artist_ids 数组匹配
        if (s.artist_ids && Array.isArray(s.artist_ids) && s.artist_ids.includes(artistId)) return true;
        // 其他贡献者字段匹配
        if (containsId(s.lyricist, artistId)) return true;
        if (containsId(s.composer, artistId)) return true;
        if (containsId(s.arranger, artistId)) return true;
        return false;
      });

      return filtered.map(s => ({
        ...s,
        album_name: s.albums?.name || '',
        album_year: s.albums?.year || ''
      }));
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

      // 批量查询艺术家信息
      const artistMap = {};
      if (allArtistIds.size > 0) {
        const { data: artistsData } = await supabase
          .from('artists')
          .select('id, name, is_show')
          .in('id', Array.from(allArtistIds));
        (artistsData || []).forEach(ar => {
          artistMap[ar.id] = ar;
        });
      }

      const albums = (data || []).map(a => {
        const ids = a.artist_ids || [];
        const names = ids.map(id => artistMap[id]?.name || '').filter(Boolean);
        return {
          ...a,
          artist_name: names.join(' / ') || '未知',
          artists: ids.map(id => artistMap[id]).filter(Boolean)
        };
      });

      if (includeCount && albums.length > 0) {
        const counts = await Promise.all(albums.map(a =>
          supabase
            .from('songs')
            .select('id', { count: 'exact' })
            .eq('album_id', a.id)
            .eq('status', 'published')
            .then(r => r.count || 0)
        ));
        return albums.map((a, i) => ({ ...a, song_count: counts[i] }));
      }
      return albums;
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
    async getSongs() {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist_ids, album_id, lyricist, composer, arranger, duration, status, is_hidden, created_at, albums(name)')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
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

    // 评论 (使用歌曲表的备注字段或单独 comments 表)
    async getComments(songId) {
      // 如果有 comments 表则使用 comments 表，否则返回空数组
      try {
        const { data, error } = await supabase
          .from('comments')
          .select('*')
          .eq('song_id', songId)
          .order('created_at', { ascending: true });
        return error ? [] : (data || []);
      } catch (e) {
        return [];
      }
    },

    async addComment(songId, content, author = '匿名') {
      const { data, error } = await supabase
        .from('comments')
        .insert([{
          id: 'cmt' + Date.now(),
          song_id: songId,
          author,
          content,
          created_at: new Date().toISOString()
        }])
        .select();
      if (error) throw error;
      return data?.[0] || null;
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

    // 获取所有贡献者
    async getContributors(options = {}) {
      let query = supabase
        .from('contributors')
        .select('id, name, avatar, bio, public_bio, contact_value, public_contact, is_owner, created_at, sort, tags');
      const { data, error } = await query;
      if (error) throw error;
      
      // 动态计算每个贡献者的歌曲数（从 songs 表按 contributor_id 统计）
      if (data && data.length > 0) {
        // 一次性查询所有贡献者的歌曲数
        const contributorIds = data.map(c => c.id);
        const { data: songsData } = await supabase
          .from('songs')
          .select('contributor_id')
          .in('contributor_id', contributorIds)
          .eq('status', 'published');
        
        // 统计每个贡献者的歌曲数
        const songCountMap = {};
        (songsData || []).forEach(s => {
          if (s.contributor_id) {
            songCountMap[s.contributor_id] = (songCountMap[s.contributor_id] || 0) + 1;
          }
        });
        
        // 把歌曲数合并到贡献者数据中
        data.forEach(c => {
          c.song_count = songCountMap[c.id] || 0;
        });
        
        // 排序逻辑：
        // 1. sort > 0 的置顶贡献者，按 sort 值升序（越小越靠前）
        // 2. sort = 0 的普通贡献者，按歌曲数降序，歌曲数相同按创建时间
        data.sort((a, b) => {
          const aPinned = a.sort > 0;
          const bPinned = b.sort > 0;
          
          if (aPinned && bPinned) {
            return a.sort - b.sort;
          }
          if (aPinned) return -1;
          if (bPinned) return 1;
          
          // 都不是置顶，按歌曲数降序
          if (b.song_count !== a.song_count) return b.song_count - a.song_count;
          // 歌曲数相同，按创建时间
          return new Date(a.created_at) - new Date(b.created_at);
        });
      }
      
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
          submitter_contact: payload.submitter_contact || '',
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
})();
