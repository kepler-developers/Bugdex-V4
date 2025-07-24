// 临时内存存储（用于 KV 存储未申请时的测试）
const tempStorage = {
  posts: new Map(),
  likes: new Map(),
  comments: new Map()
};

// 添加测试帖子数据
const testPosts = [
  {
    id: 'post_1',
    title: '欢迎来到BugDex论坛',
    content: '这是一个测试帖子，欢迎大家在这里分享想法和讨论问题！',
    username: 'admin',
    likes_count: 5,
    created_at: new Date(Date.now() - 86400000).toISOString() // 1天前
  },
  {
    id: 'post_2',
    title: '关于前端开发的思考',
    content: '最近在学习React和Vue，发现它们各有优势。React更灵活，Vue更易上手。大家觉得呢？',
    username: 'test',
    likes_count: 3,
    created_at: new Date(Date.now() - 43200000).toISOString() // 12小时前
  },
  {
    id: 'post_3',
    title: '后端API设计经验分享',
    content: '在设计RESTful API时，我发现遵循统一的命名规范和错误处理机制非常重要。',
    username: 'user',
    likes_count: 2,
    created_at: new Date(Date.now() - 21600000).toISOString() // 6小时前
  },
  {
    id: 'post_4',
    title: '数据库优化技巧',
    content: '使用索引、避免N+1查询、合理设计表结构，这些都是提升数据库性能的关键。',
    username: 'admin',
    likes_count: 4,
    created_at: new Date(Date.now() - 7200000).toISOString() // 2小时前
  },
  {
    id: 'post_5',
    title: '云原生架构实践',
    content: '微服务、容器化、CI/CD，云原生技术正在改变我们的开发方式。',
    username: 'test',
    likes_count: 1,
    created_at: new Date(Date.now() - 3600000).toISOString() // 1小时前
  }
];

// 将测试帖子添加到临时存储
testPosts.forEach(post => {
  tempStorage.posts.set(post.id, post);
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
  
  if (pathname === '/api/posts' && request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const page = Number(url.searchParams.get('page')) || 1;
      const size = Number(url.searchParams.get('size')) || 10;
      let posts = Array.from(tempStorage.posts.values());
      if (posts.length === 0 && env.bugdex_kv) {
        posts = [];
        let cursor;
        do {
          const result = await env.bugdex_kv.list({ prefix: 'post:', cursor });
          for (const key of result.keys) {
            const post = await env.bugdex_kv.get(key.key, { type: 'json' });
            if (post) posts.push(post);
          }
          cursor = result.cursor;
        } while (!result.complete);
      }
      posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const pagedPosts = posts.slice((page-1)*size, page*size);
      return new Response(JSON.stringify({
        total: posts.length,
        data: pagedPosts
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: '获取帖子失败'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
  
  // 帖子POST支持multipart/form-data
  if (pathname === '/api/posts' && request.method === 'POST') {
    try {
      let title, content, image_url, codefile_url, codefile_name;
      let isMultipart = request.headers.get('content-type') && request.headers.get('content-type').includes('multipart/form-data');
      if (isMultipart) {
        const form = await request.formData();
        title = form.get('title');
        content = form.get('content');
        // 处理图片
        const image = form.get('image');
        if (image && image.size > 0) {
          // 添加文件安全检查
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          const maxSize = 5 * 1024 * 1024; // 5MB
          
          if (!allowedTypes.includes(image.type)) {
            return new Response(JSON.stringify({
              success: false,
              message: '不支持的图片格式，请上传 JPG、PNG、GIF 或 WebP 格式'
            }), {
              status: 400,
              headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
          
          if (image.size > maxSize) {
            return new Response(JSON.stringify({
              success: false,
              message: '图片文件过大，请上传小于 5MB 的图片'
            }), {
              status: 400,
              headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
          
          // 这里应保存到对象存储或EdgeOne File API，示例直接生成URL
          image_url = `/uploads/${Date.now()}_${image.name}`;
          // 实际应保存文件到存储
        }
        // 处理代码文件
        const codefile = form.get('codefile');
        if (codefile && codefile.size > 0) {
          // 添加代码文件安全检查
          const allowedExtensions = ['.js', '.py', '.java', '.txt', '.ts', '.cpp', '.c', '.json', '.html', '.css'];
          const maxSize = 2 * 1024 * 1024; // 2MB
          
          const fileName = codefile.name.toLowerCase();
          const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
          
          if (!hasValidExtension) {
            return new Response(JSON.stringify({
              success: false,
              message: '不支持的代码文件格式，请上传支持的文件类型'
            }), {
              status: 400,
              headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
          
          if (codefile.size > maxSize) {
            return new Response(JSON.stringify({
              success: false,
              message: '代码文件过大，请上传小于 2MB 的文件'
            }), {
              status: 400,
              headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
          
          codefile_url = `/uploads/${Date.now()}_${codefile.name}`;
          codefile_name = codefile.name;
        }
      } else {
        const body = await request.json();
        title = body.title;
        content = body.content;
        image_url = body.image_url;
        codefile_url = body.codefile_url;
        codefile_name = body.codefile_name;
      }
      
      // 获取用户信息（从 token）
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
      
      // 创建帖子
      const postId = `post_${Date.now()}`;
      const post = {
        id: postId,
        title,
        content,
        image_url,
        codefile_url,
        username: userData.username,
        likes_count: 0,
        created_at: new Date().toISOString()
      };
      
      // 保存到临时存储
      tempStorage.posts.set(postId, post);
      
      // 如果 KV 可用，也保存到 KV
      if (env.bugdex_kv) {
        await env.bugdex_kv.put(`post:${postId}`, JSON.stringify(post));
      }
      
      return new Response(JSON.stringify(post), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: '发布帖子失败'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  if (pathname.startsWith('/api/posts/') && pathname.endsWith('/like') && request.method === 'POST') {
    try {
      const postId = pathname.split('/')[3];
      
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
      
      // 检查是否已经点赞
      const likeKey = `${postId}:${userData.username}`;
      const existingLike = tempStorage.likes.get(likeKey);
      
      if (existingLike) {
        return new Response(JSON.stringify({
          success: false,
          message: '已经点赞过了'
        }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // 添加点赞记录
      const likeData = {
        post_id: postId,
        username: userData.username,
        created_at: new Date().toISOString()
      };
      
      tempStorage.likes.set(likeKey, likeData);
      
      // 如果 KV 可用，也保存到 KV
      if (env.bugdex_kv) {
        await env.bugdex_kv.put(`like:${likeKey}`, JSON.stringify(likeData));
      }
      
      // 更新帖子点赞数
      let post = tempStorage.posts.get(postId);
      if (!post && env.bugdex_kv) {
        post = await env.bugdex_kv.get(`post:${postId}`, { type: 'json' });
      }
      
      if (post) {
        post.likes_count = (post.likes_count || 0) + 1;
        tempStorage.posts.set(postId, post);
        
        if (env.bugdex_kv) {
          await env.bugdex_kv.put(`post:${postId}`, JSON.stringify(post));
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        likes_count: post.likes_count
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: '点赞失败'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  if (pathname.startsWith('/api/posts/') && pathname.endsWith('/comments') && request.method === 'POST') {
    try {
      const postId = pathname.split('/')[3];
      const { content } = await request.json();
      
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
      
      // 创建评论
      const commentId = `comment_${Date.now()}`;
      const comment = {
        id: commentId,
        post_id: postId,
        username: userData.username,
        content,
        created_at: new Date().toISOString()
      };
      
      // 保存到临时存储
      tempStorage.comments.set(commentId, comment);
      
      // 如果 KV 可用，也保存到 KV
      if (env.bugdex_kv) {
        await env.bugdex_kv.put(`comment:${commentId}`, JSON.stringify(comment));
      }
      
      return new Response(JSON.stringify(comment), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: '发表评论失败'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  if (pathname.match(/^\/api\/posts\/[\w-]+\/comments$/) && request.method === 'GET') {
    try {
      const postId = pathname.split('/')[3];
      const url = new URL(request.url);
      const page = Number(url.searchParams.get('page')) || 1;
      const size = Number(url.searchParams.get('size')) || 10;
      let comments = Array.from(tempStorage.comments.values()).filter(c => c.post_id === postId);
      comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const pagedComments = comments.slice((page-1)*size, page*size);
      return new Response(JSON.stringify({
        total: comments.length,
        data: pagedComments
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: '获取评论失败'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
  
  // 搜索帖子
  if (pathname.startsWith('/api/search/posts') && request.method === 'GET') {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    let posts = Array.from(tempStorage.posts.values());
    if (posts.length === 0 && env.bugdex_kv) {
      posts = [];
      let cursor;
      do {
        const result = await env.bugdex_kv.list({ prefix: 'post:', cursor });
        for (const key of result.keys) {
          const post = await env.bugdex_kv.get(key.key, { type: 'json' });
          if (post) posts.push(post);
        }
        cursor = result.cursor;
      } while (!result.complete);
    }
    const lower = keyword.toLowerCase();
    const filtered = posts.filter(post =>
      (post.title && post.title.toLowerCase().includes(lower)) ||
      (post.content && post.content.toLowerCase().includes(lower))
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