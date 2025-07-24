// 临时内存存储（用于 KV 存储未申请时的测试）
const tempStorage = {
  users: new Map(),
  posts: new Map()
};

// 预设测试账号
tempStorage.users.set('admin', {
  username: 'admin',
  email: 'admin@bugdex.com',
  password: 'admin123',
  bio: '管理员账号 - 用于测试所有功能',
  created_at: new Date().toISOString()
});

tempStorage.users.set('test', {
  username: 'test',
  email: 'test@bugdex.com',
  password: 'test123',
  bio: '测试用户 - 用于功能测试',
  created_at: new Date().toISOString()
});

export async function onRequest({ request, env }) {
  const { pathname } = new URL(request.url);
  
  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  
  if (pathname === '/api/user/profile' && request.method === 'GET') {
    try {
      const { searchParams } = new URL(request.url);
      const username = searchParams.get('username');
      
      if (!username) {
        return new Response(JSON.stringify({
          success: false,
          message: '用户名不能为空'
        }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // 优先从临时存储获取用户信息
      let user = tempStorage.users.get(username);
      
      // 如果临时存储中没有，尝试从 KV 获取
      if (!user && env.bugdex_kv) {
        const userKey = `user:${username}`;
        user = await env.bugdex_kv.get(userKey, { type: 'json' });
      }
      
      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          message: '用户不存在'
        }), {
          status: 404,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // 获取用户的帖子
      let posts = Array.from(tempStorage.posts.values())
        .filter(post => post.username === username);
      
      // 如果临时存储中没有，尝试从 KV 获取
      if (posts.length === 0 && env.bugdex_kv) {
        posts = [];
        let cursor;
        
        do {
          const result = await env.bugdex_kv.list({ prefix: 'post:', cursor });
          for (const key of result.keys) {
            const post = await env.bugdex_kv.get(key.key, { type: 'json' });
            if (post && post.username === username) {
              posts.push(post);
            }
          }
          cursor = result.cursor;
        } while (!result.complete);
      }
      
      return new Response(JSON.stringify({
        username: user.username,
        bio: user.bio,
        posts
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: '获取用户信息失败'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  if (pathname === '/api/user/profile' && request.method === 'PUT') {
    try {
      const { username, bio } = await request.json();
      
      // 获取用户信息
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({
          success: false,
          message: '请先登录'
        }), {
          status: 401,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      const token = authHeader.replace('Bearer ', '');
      const userData = JSON.parse(atob(token));
      
      // 更新用户信息
      let user = tempStorage.users.get(userData.username);
      
      // 如果临时存储中没有，尝试从 KV 获取
      if (!user && env.bugdex_kv) {
        const userKey = `user:${userData.username}`;
        user = await env.bugdex_kv.get(userKey, { type: 'json' });
      }
      
      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          message: '用户不存在'
        }), {
          status: 404,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // 更新用户信息
      user.username = username;
      user.bio = bio;
      
      // 保存到临时存储
      tempStorage.users.set(userData.username, user);
      
      // 如果 KV 可用，也保存到 KV
      if (env.bugdex_kv) {
        const userKey = `user:${userData.username}`;
        await env.bugdex_kv.put(userKey, JSON.stringify(user));
      }
      
      return new Response(JSON.stringify({
        username: user.username,
        bio: user.bio
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: '更新用户信息失败'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  if (pathname === '/api/weekly' && request.method === 'GET') {
    try {
      // 获取每周排行榜
      const userStats = {};
      
      // 统计每个用户的发帖数
      let posts = Array.from(tempStorage.posts.values());
      
      // 如果临时存储中没有，尝试从 KV 获取
      if (posts.length === 0 && env.bugdex_kv) {
        posts = [];
        let cursor;
        
        do {
          const result = await env.bugdex_kv.list({ prefix: 'post:', cursor });
          for (const key of result.keys) {
            const post = await env.bugdex_kv.get(key.key, { type: 'json' });
            if (post) {
              posts.push(post);
            }
          }
          cursor = result.cursor;
        } while (!result.complete);
      }
      
      for (const post of posts) {
        const username = post.username;
        userStats[username] = (userStats[username] || 0) + 1;
      }
      
      // 转换为数组并排序
      const ranking = Object.entries(userStats)
        .map(([username, count]) => ({ username, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // 只取前10名
      
      return new Response(JSON.stringify(ranking), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: '获取排行榜失败'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  // 搜索用户
  if (pathname.startsWith('/api/search/users') && request.method === 'GET') {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    let users = Array.from(tempStorage.users.values());
    if (users.length === 0 && env.bugdex_kv) {
      users = [];
      let cursor;
      do {
        const result = await env.bugdex_kv.list({ prefix: 'user:', cursor });
        for (const key of result.keys) {
          const user = await env.bugdex_kv.get(key.key, { type: 'json' });
          if (user) users.push(user);
        }
        cursor = result.cursor;
      } while (!result.complete);
    }
    const lower = keyword.toLowerCase();
    const filtered = users.filter(user =>
      (user.username && user.username.toLowerCase().includes(lower)) ||
      (user.bio && user.bio.toLowerCase().includes(lower))
    );
    return new Response(JSON.stringify({
      data: filtered
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  
  return new Response(JSON.stringify({
    success: false,
    message: '接口不存在'
  }), {
    status: 404,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
} 