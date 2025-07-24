const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 模拟数据存储
const tempStorage = {
  users: new Map(),
  posts: new Map(),
  likes: new Map(),
  comments: new Map(),
  codes: new Map()
};

// 添加测试用户数据
tempStorage.users.set('admin', {
  username: 'admin',
  email: 'admin@test.com',
  password: 'admin123',
  bio: '管理员账号'
});

tempStorage.users.set('test', {
  username: 'test',
  email: 'test@test.com',
  password: 'test123',
  bio: '测试账号'
});

tempStorage.users.set('user', {
  username: 'user',
  email: 'user@test.com',
  password: 'user123',
  bio: '普通用户账号'
});

// 添加测试帖子数据
const testPosts = [
  {
    id: 'post_1',
    title: '欢迎来到BugDex论坛',
    content: '这是一个测试帖子，欢迎大家在这里分享想法和讨论问题！',
    username: 'admin',
    likes_count: 5,
    created_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'post_2',
    title: '关于前端开发的思考',
    content: '最近在学习React和Vue，发现它们各有优势。React更灵活，Vue更易上手。大家觉得呢？',
    username: 'test',
    likes_count: 3,
    created_at: new Date(Date.now() - 43200000).toISOString()
  },
  {
    id: 'post_3',
    title: '后端API设计经验分享',
    content: '在设计RESTful API时，我发现遵循统一的命名规范和错误处理机制非常重要。',
    username: 'user',
    likes_count: 2,
    created_at: new Date(Date.now() - 21600000).toISOString()
  },
  {
    id: 'post_4',
    title: '数据库优化技巧',
    content: '使用索引、避免N+1查询、合理设计表结构，这些都是提升数据库性能的关键。',
    username: 'admin',
    likes_count: 4,
    created_at: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 'post_5',
    title: '云原生架构实践',
    content: '微服务、容器化、CI/CD，云原生技术正在改变我们的开发方式。',
    username: 'test',
    likes_count: 1,
    created_at: new Date(Date.now() - 3600000).toISOString()
  }
];

testPosts.forEach(post => {
  tempStorage.posts.set(post.id, post);
});

// API路由

// 测试接口
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API 正常工作',
    timestamp: new Date().toISOString(),
    pathname: req.path,
    method: req.method
  });
});

// 登录接口
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = tempStorage.users.get(username);
    
    if (user && user.password === password) {
      // 生成简单的token
      const payload = { 
        username, 
        exp: Date.now() + 86400000,
        iat: Date.now(),
        iss: 'bugdex-forum'
      };
      const token = Buffer.from(JSON.stringify(payload)).toString('base64') + '.' + Buffer.from(Date.now().toString()).toString('base64');
      
      res.json({
        success: true,
        token,
        user: { username: user.username, bio: user.bio }
      });
    } else {
      res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '请求格式错误'
    });
  }
});

// 发送邮箱验证码
app.post('/api/send_email_code', (req, res) => {
  try {
    const { email } = req.body;
    
    // 生成验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = Date.now() + 5 * 60 * 1000; // 5分钟过期
    
    tempStorage.codes.set(email, {
      code,
      expires_at
    });
    
    res.json({
      success: true,
      message: '验证码已发送到您的邮箱',
      debug: '本地开发模式，验证码：' + code
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '发送验证码失败'
    });
  }
});

// 注册接口
app.post('/api/register', (req, res) => {
  try {
    const { username, email, password, code } = req.body;
    
    // 验证邮箱验证码
    const codeData = tempStorage.codes.get(email);
    
    if (!codeData || codeData.code !== code) {
      return res.status(400).json({
        success: false,
        message: '验证码错误或已过期'
      });
    }
    
    // 检查验证码是否过期
    if (Date.now() > codeData.expires_at) {
      return res.status(400).json({
        success: false,
        message: '验证码已过期'
      });
    }
    
    // 检查用户是否已存在
    if (tempStorage.users.has(username)) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }
    
    // 创建新用户
    const newUser = {
      username,
      email,
      password,
      bio: '新用户',
      created_at: new Date().toISOString()
    };
    
    tempStorage.users.set(username, newUser);
    
    // 清除验证码
    tempStorage.codes.delete(email);
    
    res.json({
      success: true,
      message: '注册成功',
      user: { username: newUser.username, bio: newUser.bio }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '注册失败'
    });
  }
});

// 获取帖子列表
app.get('/api/posts', (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const size = Number(req.query.size) || 10;
    
    const posts = Array.from(tempStorage.posts.values());
    posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    const pagedPosts = posts.slice((page-1)*size, page*size);
    
    res.json({
      total: posts.length,
      data: pagedPosts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取帖子失败'
    });
  }
});

// 创建帖子
app.post('/api/posts', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: '请先登录'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
    
    const { title, content } = req.body;
    
    const postId = `post_${Date.now()}`;
    const post = {
      id: postId,
      title,
      content,
      username: payload.username,
      likes_count: 0,
      created_at: new Date().toISOString()
    };
    
    tempStorage.posts.set(postId, post);
    
    res.json(post);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '发布帖子失败'
    });
  }
});

// 点赞帖子
app.post('/api/posts/:id/like', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: '请先登录'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
    
    const postId = req.params.id;
    const post = tempStorage.posts.get(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: '帖子不存在'
      });
    }
    
    // 检查是否已经点赞
    const likeKey = `${postId}:${payload.username}`;
    if (tempStorage.likes.has(likeKey)) {
      return res.status(400).json({
        success: false,
        message: '已经点赞过了'
      });
    }
    
    // 添加点赞记录
    tempStorage.likes.set(likeKey, {
      post_id: postId,
      username: payload.username,
      created_at: new Date().toISOString()
    });
    
    // 更新帖子点赞数
    post.likes_count++;
    
    res.json({
      likes_count: post.likes_count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '点赞失败'
    });
  }
});

// 发表评论
app.post('/api/posts/:id/comments', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: '请先登录'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
    
    const postId = req.params.id;
    const { content } = req.body;
    
    const commentId = `comment_${Date.now()}`;
    const comment = {
      id: commentId,
      post_id: postId,
      username: payload.username,
      content,
      created_at: new Date().toISOString()
    };
    
    tempStorage.comments.set(commentId, comment);
    
    res.json(comment);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '发表评论失败'
    });
  }
});

// 获取用户信息
app.get('/api/user/profile', (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }
    
    const user = tempStorage.users.get(username);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 获取用户的帖子
    const posts = Array.from(tempStorage.posts.values())
      .filter(post => post.username === username);
    
    res.json({
      username: user.username,
      bio: user.bio,
      posts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
});

// 更新用户信息
app.put('/api/user/profile', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: '请先登录'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
    
    const { username, bio } = req.body;
    
    const user = tempStorage.users.get(payload.username);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 更新用户信息
    user.username = username;
    user.bio = bio;
    
    res.json({
      username: user.username,
      bio: user.bio
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新用户信息失败'
    });
  }
});

// 获取排行榜
app.get('/api/weekly', (req, res) => {
  try {
    const userStats = {};
    
    // 统计每个用户的发帖数
    const posts = Array.from(tempStorage.posts.values());
    
    for (const post of posts) {
      const username = post.username;
      userStats[username] = (userStats[username] || 0) + 1;
    }
    
    // 转换为数组并排序
    const ranking = Object.entries(userStats)
      .map(([username, count]) => ({ username, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // 只取前10名
    
    res.json(ranking);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取排行榜失败'
    });
  }
});

// 搜索帖子
app.get('/api/search/posts', (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const posts = Array.from(tempStorage.posts.values());
    
    const lower = keyword.toLowerCase();
    const filtered = posts.filter(post =>
      (post.title && post.title.toLowerCase().includes(lower)) ||
      (post.content && post.content.toLowerCase().includes(lower))
    );
    
    res.json({
      data: filtered
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '搜索失败'
    });
  }
});

// 搜索用户
app.get('/api/search/users', (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const users = Array.from(tempStorage.users.values());
    
    const lower = keyword.toLowerCase();
    const filtered = users.filter(user =>
      (user.username && user.username.toLowerCase().includes(lower)) ||
      (user.bio && user.bio.toLowerCase().includes(lower))
    );
    
    res.json({
      data: filtered
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '搜索失败'
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 本地API服务器运行在 http://localhost:${PORT}`);
  console.log(`📝 主页面: http://localhost:${PORT}`);
  console.log(`🧪 API测试页面: http://localhost:${PORT}/test-api.html`);
  console.log(`\n📋 测试账号:`);
  console.log(`   - 管理员: admin / admin123`);
  console.log(`   - 测试用户: test / test123`);
  console.log(`   - 普通用户: user / user123`);
}); 