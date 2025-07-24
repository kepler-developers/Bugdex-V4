/**
 * BugDex 论坛 - 路由系统重构
 * 
 * 重构后的路由系统包含以下模块：
 * 
 * 1. Router 类 - 核心路由管理器
 *    - 路由注册和管理
 *    - 中间件系统
 *    - 导航状态管理
 *    - 错误处理
 * 
 * 2. MiddlewareManager 类 - 中间件管理器
 *    - 认证中间件
 *    - 权限中间件
 *    - 日志中间件
 *    - 性能监控中间件
 * 
 * 3. NavigationController 类 - 导航控制器
 *    - 事件监听器管理
 *    - 搜索功能集成
 *    - 程序化导航
 * 
 * 使用示例：
 * 
 * // 基本导航
 * router.navigate('home');
 * router.navigate('user', { username: 'john' });
 * 
 * // 添加自定义中间件
 * router.addMiddleware((context) => {
 *   console.log('自定义中间件:', context);
 *   return true; // 返回 false 阻止导航
 * });
 * 
 * // 程序化导航
 * navigationController.navigateTo('settings');
 * navigationController.goBack();
 * 
 * // 兼容性调用（保持向后兼容）
 * goTo('home');
 * 
 * 优势：
 * - 模块化设计，易于维护和扩展
 * - 中间件系统支持灵活的权限控制
 * - 统一的错误处理和日志记录
 * - 性能监控和调试支持
 * - 向后兼容，不影响现有代码
 */

// 全局数据
let posts = [];
let userProfile = {
  username: 'CurrentUser',
  bio: '这是你的个人简介，可以在"用户中心"编辑。',
  posts: []
};
let weeklyRanking = [];

// 管理员相关全局变量
let homeClickCount = 0;
let weeklyClickCount = 0;
let adminUnlocked = false;
const ADMIN_PASSWORD = 'admin123'; // 可自定义

// 语言相关全局变量
let currentLang = localStorage.getItem('lang') || 'zh';
const langDict = {
  zh: {
    home: '首页',
    user: '用户中心',
    weekly: '每周排行',
    settings: '设置',
    login: '登录/注册',
    logout: '退出',
    lang: '🌐中',
    noPosts: '暂无帖子',
    noComments: '暂无评论',
    comment: '评论',
    commentPlaceholder: '写下你的评论...',
    submitComment: '提交评论',
    userTitle: '的个人中心',
    nickname: '昵称：',
    bio: '简介：',
    edit: '编辑',
    save: '保存',
    cancel: '取消',
    newPost: '发布新帖子',
    postPlaceholder: '分享你的想法...',
    publish: '发布',
    uploadImg: '上传图片',
    uploadCode: '上传代码',
    downloadCode: '下载',
    myPosts: '的帖子',
    weeklyTitle: '每周排行榜',
    post: '帖子',
    delete: '删除',
    settingsTitle: '设置',
    theme: '主题：',
    dark: '深色',
    light: '浅色',
    language: '语言：',
    zh: '中文',
    en: 'English',
    moreSettings: '更多设置功能开发中...'
  },
  en: {
    home: 'Home',
    user: 'Profile',
    weekly: 'Ranking',
    settings: 'Settings',
    login: 'Login/Register',
    logout: 'Logout',
    lang: '🌐En',
    noPosts: 'No posts yet',
    noComments: 'No comments yet',
    comment: 'Comment',
    commentPlaceholder: 'Write your comment...',
    submitComment: 'Submit',
    userTitle: "'s Profile",
    nickname: 'Nickname: ',
    bio: 'Bio: ',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    newPost: 'New Post',
    postPlaceholder: 'Share your thoughts...',
    publish: 'Publish',
    uploadImg: 'Upload Image',
    uploadCode: 'Upload Code',
    downloadCode: 'Download',
    myPosts: "'s Posts",
    weeklyTitle: 'Weekly Ranking',
    post: 'posts',
    delete: 'Delete',
    settingsTitle: 'Settings',
    theme: 'Theme: ',
    dark: 'Dark',
    light: 'Light',
    language: 'Language: ',
    zh: '中文',
    en: 'English',
    moreSettings: 'More settings coming soon...'
  }
};

// 获取所有帖子
async function fetchPosts(page=1, pageSize=10) {
  try {
    const response = await fetch(`/api/posts?page=${page}&size=${pageSize}`);
    if (response.ok) {
      const res = await response.json();
      posts = res.data;
      window._totalPosts = res.total;
      window._currentPage = page;
      window._pageSize = pageSize;
    }
  } catch (error) {
    console.error('获取帖子失败:', error);
  }
}

// 获取用户信息
async function fetchUserProfile(username) {
  try {
    const response = await fetch(`/api/user/profile?username=${encodeURIComponent(username)}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
  }
  return null;
}

// 获取排行榜
async function fetchWeeklyRanking() {
  try {
    const response = await fetch('/api/weekly');
    if (response.ok) {
      weeklyRanking = await response.json();
    }
  } catch (error) {
    console.error('获取排行榜失败:', error);
  }
}

// 清除导航高亮
function clearActiveNav() {
  // 清除Bootstrap导航栏链接
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
}

// 路由函数：根据 section 渲染不同视图
async function goTo(section) {
  if (section === 'home') {
    if (!adminUnlocked) {
      homeClickCount++;
      if (homeClickCount > 3) homeClickCount = 1;
      weeklyClickCount = 0;
    }
  } else if (section === 'weekly') {
    if (!adminUnlocked && homeClickCount === 3) {
      weeklyClickCount++;
      if (weeklyClickCount > 3) weeklyClickCount = 1;
      if (weeklyClickCount === 3) {
        // 弹出密码输入框
        setTimeout(() => {
          const pwd = prompt('请输入管理员密码：');
          if (pwd === ADMIN_PASSWORD) {
            adminUnlocked = true;
            alert('验证成功，进入管理后台！');
            oldGoTo('admin');
          } else {
            alert('密码错误！');
            homeClickCount = 0;
            weeklyClickCount = 0;
          }
        }, 200);
        return;
      }
    } else {
      homeClickCount = 0;
      weeklyClickCount = 0;
    }
  } else if (section !== 'admin') {
    homeClickCount = 0;
    weeklyClickCount = 0;
  }
  if (section === 'admin' && !adminUnlocked) {
    alert('无权访问管理后台！');
    return;
  }
  clearActiveNav();
  const btn = document.querySelector(`.nav-button[data-section="${section}"]`);
  if (btn) btn.classList.add('active');

  const container = document.getElementById('posts-container');
  container.innerHTML = '';

  // 根据页面类型获取数据
  switch (section) {
    case 'user':
      await fetchUserProfile(userProfile.username);
      renderUserCenter(container);
      break;
    case 'weekly':
      await fetchWeeklyRanking();
      renderWeeklyRanking(container);
      break;
    case 'admin':
      await fetchPosts();
      renderAdminPanel(container);
      break;
    default:
      await fetchPosts();
      renderPosts(container);
  }
}

// 渲染帖子列表（首页）
function renderPosts(container) {
  // 先插入首页横幅
  const banner = document.createElement('div');
  banner.className = 'home-banner';
  banner.innerHTML = '<span>Who is the trouble maker?</span>';
  container.appendChild(banner);
  
  if (posts.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.textContent = langDict[currentLang].noPosts;
    emptyDiv.style.textAlign = 'center';
    emptyDiv.style.padding = '20px';
    emptyDiv.style.color = '#888';
    container.appendChild(emptyDiv);
    return;
  }
  
  posts.forEach((post, index) => {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.addEventListener('click', () => goToDetail(post.id || index));

    const userDiv = document.createElement('div');
    userDiv.className = 'username';
    userDiv.textContent = post.user ? post.user.username : post.username;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    contentDiv.textContent = post.content;

    postDiv.appendChild(userDiv);
    postDiv.appendChild(contentDiv);
    container.appendChild(postDiv);
  });
  // 分页按钮
  const total = window._totalPosts || posts.length;
  const pageSize = window._pageSize || 10;
  const page = window._currentPage || 1;
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages > 1) {
    const pager = document.createElement('div');
    pager.style.textAlign = 'center';
    pager.style.margin = '16px 0';
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.className = 'comment-submit-btn';
      if (i === page) btn.style.fontWeight = 'bold';
      btn.onclick = async () => {
        await fetchPosts(i, pageSize);
        renderPosts(container);
      };
      pager.appendChild(btn);
    }
    container.appendChild(pager);
  }
}

// 渲染帖子详情（弹窗形式）
async function goToDetail(postId) {
  // 从本地数据中获取帖子详情
  let post;
  
  // 如果是数字索引，从posts数组中获取
  if (typeof postId === 'number' && posts[postId]) {
    post = posts[postId];
    } else {
    // 如果是字符串ID，查找匹配的帖子
    post = posts.find(p => p.id === postId);
  }
  
  if (!post) {
    console.error('帖子不存在:', postId);
    alert('帖子不存在或已被删除');
    return;
  }

  // 构建弹窗内容
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = '';

  const content = document.createElement('div');
  content.className = 'post-detail-content';

  // 帖子头部（头像、用户名、时间）
  const header = document.createElement('div');
  header.className = 'modal-post-header';
  // 头像（首字母圆形）
  const avatar = document.createElement('div');
  avatar.className = 'modal-avatar';
  const username = post.user ? post.user.username : post.username;
  avatar.textContent = username ? username[0].toUpperCase() : '?';
  header.appendChild(avatar);
  // 用户名和时间
  const userInfo = document.createElement('div');
  const usernameSpan = document.createElement('span');
  usernameSpan.className = 'modal-username';
  usernameSpan.textContent = username;
  userInfo.appendChild(usernameSpan);
  const timeSpan = document.createElement('span');
  timeSpan.className = 'modal-time';
  timeSpan.textContent = new Date(post.created_at).toLocaleString();
  userInfo.appendChild(timeSpan);
  header.appendChild(userInfo);
  content.appendChild(header);

  // 帖子内容
  const postContentDiv = document.createElement('div');
  postContentDiv.className = 'modal-post-content';
  postContentDiv.textContent = post.content;
  content.appendChild(postContentDiv);

  // 图片展示
  if (post.image_url) {
    const imgWrap = document.createElement('div');
    imgWrap.style.margin = '12px 0 8px 0';
    imgWrap.style.display = 'flex';
    imgWrap.style.justifyContent = 'flex-start';
    
    const img = document.createElement('img');
    img.src = post.image_url;
    img.className = 'img-preview-thumb';
    img.style.maxWidth = '180px';
    img.style.maxHeight = '180px';
    imgWrap.appendChild(img);
    content.appendChild(imgWrap);
  }

  // 代码文件下载
  if (post.codefile_url) {
    const codeWrap = document.createElement('div');
    codeWrap.className = 'codefile-preview';
    
    const icon = document.createElement('span');
    icon.className = 'codefile-icon';
    icon.textContent = '💾';
    codeWrap.appendChild(icon);
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = post.codefile_name || '代码文件';
    codeWrap.appendChild(nameSpan);
    
    const downloadBtn = document.createElement('a');
    downloadBtn.href = post.codefile_url;
    downloadBtn.download = post.codefile_name || 'codefile';
    downloadBtn.className = 'upload-btn';
    downloadBtn.style.padding = '4px 16px';
    downloadBtn.style.fontSize = '0.98em';
    downloadBtn.style.marginLeft = '8px';
    downloadBtn.textContent = langDict[currentLang].downloadCode;
    codeWrap.appendChild(downloadBtn);
    content.appendChild(codeWrap);
  }

  // 点赞按钮和数量
  const likeBtn = document.createElement('button');
  likeBtn.className = 'like-btn';
  likeBtn.innerHTML = `<span class="like-icon">👍</span>${langDict[currentLang].comment} <span>(${post.likes_count || 0})</span>`;
  likeBtn.onclick = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('请先登录');
        return;
      }
      
      const res = await fetch(`/api/posts/${post.id}/like`, { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        post.likes_count = data.likes_count;
        likeBtn.innerHTML = `<span class="like-icon">👍</span>${langDict[currentLang].comment} <span>(${post.likes_count})</span>`;
      } else {
        const error = await res.json();
        alert(error.error || '点赞失败');
      }
    } catch (error) {
      console.error('点赞失败:', error);
      alert('点赞失败');
    }
  };
  content.appendChild(likeBtn);

  // 评论区
  const commentsSection = document.createElement('div');
  commentsSection.className = 'comments-section';
  const commentsTitle = document.createElement('div');
  commentsTitle.className = 'comments-title';
  commentsTitle.textContent = langDict[currentLang].comment;
  commentsSection.appendChild(commentsTitle);

  const commentList = document.createElement('ul');
  commentList.className = 'comment-list';
  function renderComments() {
    commentList.innerHTML = '';
    if (post.comments && post.comments.length > 0) {
      post.comments.forEach(c => {
        const li = document.createElement('li');
        // 用户名
        const userSpan = document.createElement('span');
        userSpan.className = 'comment-user';
        userSpan.textContent = c.User ? c.User.username : c.username;
        li.appendChild(userSpan);
        // 内容
        const contentSpan = document.createElement('span');
        contentSpan.textContent = c.content;
        li.appendChild(contentSpan);
        // 时间
        if (c.created_at) {
          const timeSpan = document.createElement('span');
          timeSpan.className = 'comment-time';
          timeSpan.textContent = `  ${new Date(c.created_at).toLocaleString()}`;
          li.appendChild(timeSpan);
        }
        commentList.appendChild(li);
      });
    } else {
      const emptyLi = document.createElement('li');
      emptyLi.textContent = langDict[currentLang].noComments;
      emptyLi.style.textAlign = 'center';
      emptyLi.style.color = '#888';
      emptyLi.style.fontStyle = 'italic';
      commentList.appendChild(emptyLi);
    }
  }
  renderComments();
  commentsSection.appendChild(commentList);

  // 评论输入框
  const commentInput = document.createElement('textarea');
  commentInput.className = 'comment-input';
  commentInput.placeholder = langDict[currentLang].commentPlaceholder;
  commentsSection.appendChild(commentInput);

  // 提交评论按钮
  const submitBtn = document.createElement('button');
  submitBtn.className = 'comment-submit-btn';
  submitBtn.textContent = langDict[currentLang].submitComment;
  submitBtn.onclick = async () => {
    const content = commentInput.value.trim();
    if (!content) return;
    
    const token = localStorage.getItem('token');
    if (!token) {
      alert('请先登录');
      return;
    }
    
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });
      
      if (res.ok) {
        const newComment = await res.json();
        if (!post.comments) post.comments = [];
        post.comments.unshift(newComment);
        // 动画：评论飞走
        commentInput.classList.add('fly-up');
        setTimeout(() => {
          commentInput.value = '';
          commentInput.classList.remove('fly-up');
          renderComments();
        }, 700);
      } else {
        const error = await res.json();
        alert(error.error || '评论失败');
      }
    } catch (error) {
      console.error('评论失败:', error);
      alert('评论失败');
    }
  };
  commentsSection.appendChild(submitBtn);

  content.appendChild(commentsSection);

  modalBody.appendChild(content);

  // 显示Bootstrap modal
  const modal = document.getElementById('modal');
  const modalInstance = new bootstrap.Modal(modal);
  
  modalInstance.show();
  
  // 强制设置弹窗宽度 - 使用setTimeout确保在Bootstrap初始化后执行
  setTimeout(() => {
    const modalDialog = modal.querySelector('.modal-dialog');
    if (modalDialog) {
      modalDialog.style.maxWidth = '95vw';
      modalDialog.style.width = '95vw';
      console.log('强制设置帖子详情弹窗宽度:', modalDialog.style.maxWidth);
    }
  }, 100);
}

// 渲染用户中心
function renderUserCenter(container) {
  container.innerHTML = '';
  
  // 创建主容器
  const mainContainer = document.createElement('div');
  mainContainer.className = 'row';
  
  // 左侧个人信息卡片
  const profileCol = document.createElement('div');
  profileCol.className = 'col-lg-4 mb-4';
  
  const profileCard = document.createElement('div');
  profileCard.className = 'card bg-dark text-light h-100';
  profileCard.innerHTML = `
    <div class="card-header border-secondary">
      <h3 class="mb-0">👤 个人信息</h3>
    </div>
    <div class="card-body">
      <div class="text-center mb-4">
        <img src="${userProfile.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(userProfile.username)}" 
             alt="avatar" class="rounded-circle mb-3" style="width:80px;height:80px;background:#333;border:3px solid var(--fun-accent);">
        <h4 class="text-primary">${userProfile.username}</h4>
        <p class="text-muted">${userProfile.bio}</p>
      </div>
      
      <div class="mb-3">
        <label class="form-label">📝 昵称</label>
        <div class="input-group">
          <input type="text" class="form-control bg-dark text-light border-secondary" id="edit-username" value="${userProfile.username}" readonly>
          <button class="btn btn-outline-primary" id="edit-name-btn">编辑</button>
        </div>
      </div>
      
      <div class="mb-3">
        <label class="form-label">💬 个人简介</label>
        <div class="input-group">
          <textarea class="form-control bg-dark text-light border-secondary" id="edit-bio" rows="3" readonly>${userProfile.bio}</textarea>
          <button class="btn btn-outline-primary" id="edit-bio-btn">编辑</button>
        </div>
      </div>
      
      <div class="d-grid gap-2" id="save-cancel-buttons" style="display: none;">
        <button class="btn btn-success" id="save-profile-btn">💾 保存更改</button>
        <button class="btn btn-secondary" id="cancel-edit-btn">❌ 取消</button>
      </div>
    </div>
  `;
  
  profileCol.appendChild(profileCard);
  mainContainer.appendChild(profileCol);
  
  // 右侧设置卡片
  const settingsCol = document.createElement('div');
  settingsCol.className = 'col-lg-8 mb-4';
  
  const settingsCard = document.createElement('div');
  settingsCard.className = 'card bg-dark text-light h-100';
  settingsCard.innerHTML = `
    <div class="card-header border-secondary">
      <h3 class="mb-0">⚙️ 个人设置</h3>
    </div>
    <div class="card-body">
      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">🎨 主题设置</label>
          <select class="form-select bg-dark text-light border-secondary" id="theme-select">
            <option value="dark">🌙 深色主题</option>
            <option value="light">☀️ 浅色主题</option>
          </select>
        </div>
        
        <div class="col-md-6 mb-3">
          <label class="form-label">🌐 语言设置</label>
          <select class="form-select bg-dark text-light border-secondary" id="lang-select">
            <option value="zh">🇨🇳 中文</option>
            <option value="en">🇺🇸 English</option>
          </select>
        </div>
      </div>
      
      <hr class="border-secondary">
      
      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">🔔 通知设置</label>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="email-notifications" checked>
            <label class="form-check-label" for="email-notifications">
              邮件通知
            </label>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="push-notifications" checked>
            <label class="form-check-label" for="push-notifications">
              推送通知
            </label>
          </div>
        </div>
        
        <div class="col-md-6 mb-3">
          <label class="form-label">🔒 隐私设置</label>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="profile-public" checked>
            <label class="form-check-label" for="profile-public">
              公开个人资料
            </label>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="show-email" checked>
            <label class="form-check-label" for="show-email">
              显示邮箱地址
            </label>
          </div>
        </div>
      </div>
      
      <hr class="border-secondary">
      
      <div class="d-grid gap-2">
        <button class="btn btn-primary" id="save-settings-btn">💾 保存设置</button>
        <button class="btn btn-outline-warning" id="reset-settings-btn">🔄 重置为默认</button>
      </div>
    </div>
  `;
  
  settingsCol.appendChild(settingsCard);
  mainContainer.appendChild(settingsCol);
  
  // 发布新帖子卡片
  const newPostCol = document.createElement('div');
  newPostCol.className = 'col-12 mb-4';
  
  const newPostCard = document.createElement('div');
  newPostCard.className = 'card bg-dark text-light';
  newPostCard.innerHTML = `
    <div class="card-header border-secondary">
      <h3 class="mb-0">📝 发布新帖子</h3>
    </div>
    <div class="card-body">
      <div class="mb-3">
        <textarea class="form-control bg-dark text-light border-secondary" id="new-post-content" rows="4" placeholder="分享你的想法..."></textarea>
      </div>
      
      <div class="row mb-3">
        <div class="col-md-6">
          <label class="form-label">🖼️ 上传图片</label>
          <input type="file" class="form-control bg-dark text-light border-secondary" id="img-upload-input" accept="image/*">
        </div>
        <div class="col-md-6">
          <label class="form-label">📄 上传代码文件</label>
          <input type="file" class="form-control bg-dark text-light border-secondary" id="code-upload-input" accept=".js,.py,.java,.txt,.ts,.cpp,.c,.json,.html,.css">
        </div>
      </div>
      
      <div class="d-grid">
        <button class="btn btn-success" id="publish-post-btn">🚀 发布帖子</button>
      </div>
    </div>
  `;
  
  newPostCol.appendChild(newPostCard);
  mainContainer.appendChild(newPostCol);
  
  // 我的帖子卡片
  const postsCol = document.createElement('div');
  postsCol.className = 'col-12';
  
  const postsCard = document.createElement('div');
  postsCard.className = 'card bg-dark text-light';
  postsCard.innerHTML = `
    <div class="card-header border-secondary">
      <h3 class="mb-0">📚 我的帖子</h3>
    </div>
    <div class="card-body" id="my-posts-container">
      ${userProfile.posts.length === 0 ? '<p class="text-muted text-center">暂无帖子</p>' : ''}
    </div>
  `;
  
  postsCol.appendChild(postsCard);
  mainContainer.appendChild(postsCol);
  
  container.appendChild(mainContainer);
  
  // 设置初始值
  document.getElementById('theme-select').value = localStorage.getItem('theme') || 'dark';
  document.getElementById('lang-select').value = localStorage.getItem('lang') || 'zh';
  
  // 绑定事件
  setupUserCenterEvents();
  
  // 渲染我的帖子
  renderMyPosts();
}

// 渲染每周排行
function renderWeeklyRanking(container) {
  const title = document.createElement('h2');
  title.textContent = langDict[currentLang].weeklyTitle;
  container.appendChild(title);

  const list = document.createElement('ol');
  list.className = 'ranking-list';
  // 固定10个槽位
  const topTen = weeklyRanking.slice(0, 10);
  for (let idx = 0; idx < 10; idx++) {
    const item = topTen[idx];
    const li = document.createElement('li');
    li.style.position = 'relative';
    if (item) {
    const rankSpan = document.createElement('span');
    rankSpan.className = 'rank';
    rankSpan.textContent = idx + 1;
    const userSpan = document.createElement('span');
    userSpan.className = 'username';
    userSpan.textContent = item.username;
    const countSpan = document.createElement('span');
    countSpan.className = 'count';
    countSpan.textContent = `${item.count} ${langDict[currentLang].post}`;
    li.append(rankSpan, userSpan, countSpan);
    } else {
      // 空槽
      li.style.opacity = '0.4';
      li.style.fontStyle = 'italic';
      li.style.color = '#888';
      li.innerHTML = `<span class="rank">${idx + 1}</span> <span class="username">（空）</span> <span class="count"></span>`;
    }
    list.appendChild(li);
  }
  // 不再添加分割线和省略号
  container.appendChild(list);
}

// 管理后台页面
function renderAdminPanel(container) {
  const title = document.createElement('h2');
  title.textContent = '管理后台 - 帖子管理';
  container.appendChild(title);

  // 帖子列表
  posts.forEach((post, index) => {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.style.position = 'relative';

    const userDiv = document.createElement('div');
    userDiv.className = 'username';
    userDiv.textContent = post.username;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    contentDiv.textContent = post.content;
    postDiv.appendChild(userDiv);
    postDiv.appendChild(contentDiv);

    // 删除按钮
    const delBtn = document.createElement('button');
    delBtn.textContent = langDict[currentLang].delete;
    delBtn.className = 'comment-submit-btn delete-btn';
    delBtn.style.position = 'absolute';
    delBtn.style.top = '16px';
    delBtn.style.right = '16px';
    delBtn.style.background = 'linear-gradient(90deg, #e53935 60%, #ff7043 100%)';
    delBtn.style.fontWeight = 'bold';
    delBtn.onclick = async () => {
      if (!confirm('确定要删除这条帖子吗？')) return;
      // 预留后端接口
      /*
      await fetch(`/api/posts/${index}`, { method: 'DELETE' });
      */
      const delUser = post.username;
      posts.splice(index, 1);
      const rankUser = weeklyRanking.find(item => item.username === delUser);
      if (rankUser) {
        rankUser.count--;
        if (rankUser.count <= 0) {
          const idx = weeklyRanking.indexOf(rankUser);
          if (idx !== -1) weeklyRanking.splice(idx, 1);
        }
      }
      showAdminPanelModal();
    };
    postDiv.appendChild(delBtn);

    container.appendChild(postDiv);
  });
}

// 管理后台弹窗
function showAdminPanelModal() {
  // 创建弹窗遮罩
  let modal = document.getElementById('admin-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'admin-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.65)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '2000';
    document.body.appendChild(modal);
  }
  modal.innerHTML = '';
  modal.style.display = 'flex';

  // 弹窗内容
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.minWidth = '420px';
  content.style.maxWidth = '600px';
  content.style.width = '90vw';
  content.style.maxHeight = '85vh';
  content.style.overflowY = 'auto';
  content.style.position = 'relative';

  // 关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => { modal.style.display = 'none'; };
  content.appendChild(closeBtn);

  // 标题
  const title = document.createElement('h2');
  title.textContent = '管理后台 - 帖子管理';
  content.appendChild(title);

  // 帖子列表
  posts.forEach((post, index) => {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.style.position = 'relative';

    const userDiv = document.createElement('div');
    userDiv.className = 'username';
    userDiv.textContent = post.username;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    contentDiv.textContent = post.content;
    postDiv.appendChild(userDiv);
    postDiv.appendChild(contentDiv);

    // 删除按钮
    const delBtn = document.createElement('button');
    delBtn.textContent = langDict[currentLang].delete;
    delBtn.className = 'comment-submit-btn delete-btn';
    delBtn.style.position = 'absolute';
    delBtn.style.top = '16px';
    delBtn.style.right = '16px';
    delBtn.style.background = 'linear-gradient(90deg, #e53935 60%, #ff7043 100%)';
    delBtn.style.fontWeight = 'bold';
    delBtn.onclick = async () => {
      if (!confirm('确定要删除这条帖子吗？')) return;
      // 预留后端接口
      /*
      await fetch(`/api/posts/${index}`, { method: 'DELETE' });
      */
      // 1. 先找到被删帖子的用户名
      const delUser = post.username;
      // 2. 从posts数组移除
      posts.splice(index, 1);
      // 3. 同步更新排行榜数据
      const rankUser = weeklyRanking.find(item => item.username === delUser);
      if (rankUser) {
        rankUser.count--;
        if (rankUser.count <= 0) {
          // 帖子数为0则移除该用户
          const idx = weeklyRanking.indexOf(rankUser);
          if (idx !== -1) weeklyRanking.splice(idx, 1);
        }
      }
      // 4. 重新渲染弹窗内容
      showAdminPanelModal();
    };
    postDiv.appendChild(delBtn);

    content.appendChild(postDiv);
  });

  modal.appendChild(content);
  // 点击遮罩关闭弹窗
  modal.onclick = function(e) {
    if (e.target === modal) modal.style.display = 'none';
  };
}

// 用户帖子详情弹窗
function showUserPostDetailModal(idx) {
  const post = userProfile.posts[idx];
  let modal = document.getElementById('modal');
  modal.innerHTML = '';
  modal.style.display = 'flex';
  const content = document.createElement('div');
  content.className = 'modal-content';
  // 关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => { modal.style.display = 'none'; };
  content.appendChild(closeBtn);
  // 标题
  const title = document.createElement('h2');
  title.textContent = '我的帖子详情';
  content.appendChild(title);
  // 内容
  const postContent = document.createElement('div');
  postContent.className = 'modal-post-content';
  postContent.textContent = post.content;
  content.appendChild(postContent);
  // 操作按钮区
  const actions = document.createElement('div');
  actions.className = 'post-actions';
  // 删除按钮（叉icon+Delete文字）
  const delBtn = document.createElement('button');
  delBtn.innerHTML = '✖️ ' + langDict[currentLang].delete;
  delBtn.className = 'comment-submit-btn delete-btn icon-btn';
  delBtn.setAttribute('aria-label', '删除');
  delBtn.onclick = async () => {
    if (!confirm('确定要删除这条帖子吗？')) return;
    // 预留后端接口
    /*
    await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    */
    userProfile.posts.splice(idx, 1);
    const globalIdx = posts.findIndex(p => p.username === userProfile.username && p.content === post.content);
    if (globalIdx !== -1) {
      posts.splice(globalIdx, 1);
      const rankUser = weeklyRanking.find(item => item.username === userProfile.username);
      if (rankUser) {
        rankUser.count--;
        if (rankUser.count <= 0) {
          const idx = weeklyRanking.indexOf(rankUser);
          if (idx !== -1) weeklyRanking.splice(idx, 1);
        }
      }
    }
    modal.style.display = 'none';
    renderUserCenter(document.getElementById('posts-container'));
  };
  actions.appendChild(delBtn);
  content.appendChild(actions);
  modal.appendChild(content);
  // 点击遮罩关闭弹窗
  modal.onclick = function(e) {
    if (e.target === modal) modal.style.display = 'none';
  };
}

// 渲染设置页


// 主题切换实现
function setTheme(theme) {
  if (theme === 'light') {
    document.body.style.background = '#f5f5f5';
    document.body.style.color = '#222';
  } else {
    document.body.style.background = '#121212';
    document.body.style.color = '#e0e0e0';
  }
}
// 页面加载时自动应用主题
setTheme(localStorage.getItem('theme') || 'dark');

// 语言切换实现（简单示例，实际可扩展为多语言字典）
function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.getElementById('lang-switch-btn').textContent = langDict[lang].lang;
  
  // Bootstrap 导航栏
  document.querySelector('.nav-link[data-section="home"]').innerHTML = `<span style="margin-right: 5px;">🏠</span>${langDict[lang].home}`;
  document.querySelector('.nav-link[data-section="user"]').innerHTML = `<span style="margin-right: 5px;">👤</span>${langDict[lang].user}`;
  document.querySelector('.nav-link[data-section="weekly"]').innerHTML = `<span style="margin-right: 5px;">🏆</span>${langDict[lang].weekly}`;
  
  // 登录/注册/退出
  document.getElementById('loginRegisterBtn').textContent = langDict[lang].login;
  document.getElementById('logoutBtn').textContent = langDict[lang].logout;
  
  // 动态渲染内容请用 langDict[currentLang].xxx
}
setLang(localStorage.getItem('lang') || 'zh');

// ========== 登录/注册相关 ==========
// Supabase相关代码已移除，如需实现注册/登录功能，请在此处接入你自己的后端API。

const loginRegisterBtn = document.getElementById('loginRegisterBtn');
const authModal = document.getElementById('authModal');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginFormElement = document.getElementById('loginFormElement');
const registerFormElement = document.getElementById('registerFormElement');
const authError = document.getElementById('authError');
const userInfo = document.getElementById('userInfo');
const userAvatar = document.getElementById('userAvatar');
const userNickname = document.getElementById('userNickname');
const logoutBtn = document.getElementById('logoutBtn');

// Bootstrap Modal 实例
let authModalInstance = null;

function showAuthModal() {
  if (!authModalInstance) {
    authModalInstance = new bootstrap.Modal(authModal);
  }
  
  authModalInstance.show();
  
  // 强制设置弹窗宽度 - 使用setTimeout确保在Bootstrap初始化后执行
  setTimeout(() => {
    const modalDialog = authModal.querySelector('.modal-dialog');
    if (modalDialog) {
      modalDialog.style.maxWidth = '95vw';
      modalDialog.style.width = '95vw';
      console.log('强制设置登录弹窗宽度:', modalDialog.style.maxWidth);
    }
  }, 100);
  
  authError.style.display = 'none';
  authError.textContent = '';
}

function hideAuthModal() {
  if (authModalInstance) {
    authModalInstance.hide();
  }
  loginFormElement.reset();
  registerFormElement.reset();
  authError.style.display = 'none';
  authError.textContent = '';
}

loginRegisterBtn.onclick = showAuthModal;

// 切换登录/注册标签页
loginTab.onclick = () => {
  loginTab.classList.add('active');
  registerTab.classList.remove('active');
  authError.style.display = 'none';
  authError.textContent = '';
  authError.className = 'auth-error';
};

registerTab.onclick = () => {
  registerTab.classList.add('active');
  loginTab.classList.remove('active');
  authError.style.display = 'none';
  authError.textContent = '';
  authError.className = 'auth-error';
};

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('switch-tab')) {
  e.preventDefault();
    const targetTab = e.target.getAttribute('data-tab');
    if (targetTab === 'register') {
      registerTab.click();
    } else if (targetTab === 'login') {
      loginTab.click();
    }
  }
});

// ========== 注册逻辑（接入后端API） ==========
registerFormElement.onsubmit = async e => {
  e.preventDefault();
  const email = registerFormElement.registerEmail.value.trim();
  const password = registerFormElement.registerPassword.value;
  const confirm = registerFormElement.registerConfirm.value;
  
  if (!email || !password || !confirm) {
    showAuthError('请填写所有字段', 'error');
    return;
  }
  if (password !== confirm) {
    showAuthError('两次密码不一致', 'error');
    return;
  }
  
  try {
    // 先发送验证码
    const codeRes = await fetch('/api/send_email_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    if (!codeRes.ok) {
      const error = await codeRes.json();
      showAuthError(error.message || '发送验证码失败', 'error');
      return;
    }
    
    const codeData = await codeRes.json();
    if (!codeData.success) {
      showAuthError(codeData.message || '发送验证码失败', 'error');
      return;
    }
    
    // 显示验证码输入提示
    const code = prompt('验证码已发送到您的邮箱，请输入验证码：');
    if (!code) {
      showAuthError('请输入验证码', 'error');
    return;
  }
    
    // 注册用户
    const registerRes = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: email.split('@')[0], // 使用邮箱前缀作为用户名
        email, 
        password, 
        code 
      })
    });
    
    const registerData = await registerRes.json();
    if (registerData.success) {
      showAuthSuccess('注册成功！请登录');
      setTimeout(() => {
        loginTab.click(); // 切换到登录标签
      }, 2000);
    } else {
      showAuthError(registerData.message || '注册失败', 'error');
    }
  } catch (error) {
    console.error('注册失败:', error);
    showAuthError('注册失败，请稍后重试', 'error');
  }
};

// ========== 登录逻辑（接入后端API） ==========
loginFormElement.onsubmit = async e => {
  e.preventDefault();
  const usernameOrEmail = loginFormElement.loginUsername.value.trim();
  const password = loginFormElement.loginPassword.value;
  
  if (!usernameOrEmail || !password) {
    showAuthError('请输入用户名/邮箱和密码', 'error');
    return;
  }
  
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: usernameOrEmail, // 支持用户名或邮箱
        password 
      })
    });
    
    const data = await res.json();
    if (data.success) {
      // 保存token和用户信息
      localStorage.setItem('token', data.token);
      localStorage.setItem('userInfo', JSON.stringify(data.user));
      
      // 更新UI
      setUserInfo(data.user);
      hideAuthModal();
      showAuthSuccess('登录成功！');
      
      // 刷新页面数据
      if (router && router.currentRoute === 'home') {
        await fetchPosts();
        renderPosts(document.getElementById('posts-container'));
      }
    } else {
      showAuthError(data.message || '登录失败', 'error');
    }
  } catch (error) {
    console.error('登录失败:', error);
    showAuthError('登录失败，请稍后重试', 'error');
  }
};

// ========== 登出逻辑（接入后端API） ==========
logoutBtn.onclick = async () => {
  try {
    // 清除本地存储
  localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    
    // 更新UI
  userInfo.style.display = 'none';
  loginRegisterBtn.style.display = '';
    
    // 刷新页面数据
    if (router && router.currentRoute === 'home') {
      await fetchPosts();
      renderPosts(document.getElementById('posts-container'));
    }
    
    showAlert('已退出登录', 'success');
  } catch (error) {
    console.error('登出失败:', error);
    showAlert('登出失败，请稍后重试', 'danger');
  }
};

// ========== 获取当前用户（接入后端API） ==========
async function fetchUserInfo() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  try {
    // 从token中解析用户信息（简化版）
    const payload = JSON.parse(atob(token.split('.')[0]));
    if (payload.exp && Date.now() > payload.exp) {
      // token已过期
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      return null;
    }
    
    // 获取用户详细信息
    const res = await fetch(`/api/user/profile?username=${encodeURIComponent(payload.username)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
      const userData = await res.json();
      setUserInfo(userData);
      return userData;
    } else {
      // 如果获取失败，使用token中的基本信息
      const userData = { username: payload.username, bio: '用户' };
      setUserInfo(userData);
      return userData;
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
}

// ========== 设置用户信息显示 ==========
function setUserInfo(user) {
  if (!user) {
    userInfo.style.display = 'none';
    loginRegisterBtn.style.display = '';
    return;
  }
  
  userInfo.style.display = '';
  loginRegisterBtn.style.display = 'none';
  userNickname.textContent = user.username;
  userAvatar.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.username)}`;
  
  // 更新全局用户信息
  userProfile = {
    username: user.username,
    bio: user.bio || '这是你的个人简介，可以在"用户中心"编辑。',
    posts: user.posts || []
  };
}

// ========== 会话监听（如需） ==========
// TODO: 如需监听登录状态变化，可在此实现

// 页面加载时自动获取用户
fetchUserInfo();

// ========== 路由配置 ==========
const ROUTE_CONFIG = {
  home: {
    path: 'home',
    title: '首页',
    requiresAuth: false,
    icon: '🏠'
  },
  user: {
    path: 'user',
    title: '用户中心',
    requiresAuth: true,
    icon: '👤'
  },
  weekly: {
    path: 'weekly',
    title: '每周排行',
    requiresAuth: false,
    icon: '🏆'
  },
  admin: {
    path: 'admin',
    title: '管理后台',
    requiresAuth: true,
    requiresAdmin: true,
    icon: '🔧'
  }
};

// ========== 路由管理器模块 ==========
class Router {
  constructor() {
    this.routes = new Map();
    this.middlewares = [];
    this.currentRoute = null;
    this.container = null;
    
    // 初始化容器
    this.container = document.getElementById('posts-container');
    
    // 注册路由
    this.registerRoutes();
  }

  /**
   * 注册所有路由
   */
  registerRoutes() {
    // 使用配置常量注册路由
    Object.entries(ROUTE_CONFIG).forEach(([key, config]) => {
      this.routes.set(key, {
        handler: this[`handle${key.charAt(0).toUpperCase() + key.slice(1)}`].bind(this),
        ...config
      });
    });
  }

  /**
   * 添加中间件
   */
  addMiddleware(middleware) {
    this.middlewares.push(middleware);
  }

  /**
   * 执行中间件链
   */
  async executeMiddlewares(context) {
    for (const middleware of this.middlewares) {
      const result = await middleware(context);
      if (result === false) {
        return false; // 中间件阻止继续执行
      }
    }
    return true;
  }

  /**
   * 导航到指定页面
   */
  async navigate(section, params = {}) {
    console.log(`🚀 导航到: ${section}`, params);
    
    const route = this.routes.get(section);
    if (!route) {
      console.error(`❌ 路由不存在: ${section}`);
      return false;
    }

    // 构建上下文
    const context = {
      section,
      route,
      params,
      container: this.container,
      user: this.getCurrentUser()
    };

    // 执行中间件
    const shouldContinue = await this.executeMiddlewares(context);
    if (!shouldContinue) {
      console.log(`⚠️ 中间件阻止导航到: ${section}`);
      return false;
    }

    try {
      // 更新导航状态
      this.updateNavigation(section);
      
      // 清空容器
      this.clearContainer();
      
      // 执行路由处理器
      await route.handler(context);
      
      // 更新当前路由
      this.currentRoute = section;
      
      console.log(`✅ 成功导航到: ${section}`);
      return true;
    } catch (error) {
      console.error(`❌ 导航失败: ${section}`, error);
      this.showError('页面加载失败，请稍后重试');
      return false;
    }
  }

  /**
   * 更新导航状态
   */
  updateNavigation(section) {
    // 清除所有导航链接的激活状态
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    
    // 激活当前导航链接（Bootstrap 导航栏）
    const link = document.querySelector(`.nav-link[data-section="${section}"]`);
    if (link) {
      link.classList.add('active');
    }
  }

  /**
   * 清空容器
   */
  clearContainer() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * 获取当前用户信息
   */
  getCurrentUser() {
  const token = localStorage.getItem('token');
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[0]));
      return {
        username: payload.username,
        token
      };
    } catch (error) {
      console.error('解析用户token失败:', error);
      return null;
    }
  }

  /**
   * 显示错误信息
   */
  showError(message) {
    if (this.container) {
      this.container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #ff6b6b;">
          <h3>😔 出错了</h3>
          <p>${message}</p>
          <button onclick="router.navigate('home')" class="fancy-btn">返回首页</button>
        </div>
      `;
    }
  }

  // ========== 路由处理器 ==========
  
  /**
   * 处理首页
   */
  async handleHome(context) {
    console.log('🏠 渲染首页');
    
    // 处理管理员解锁逻辑
    if (!adminUnlocked) {
      homeClickCount++;
      if (homeClickCount > 3) homeClickCount = 1;
      weeklyClickCount = 0;
    }

    // 获取帖子数据
  await fetchPosts();
    
    // 渲染页面
    renderPosts(context.container);
  }

  /**
   * 处理用户中心
   */
  async handleUser(context) {
    console.log('👤 渲染用户中心');
    
    // 重置计数器
    homeClickCount = 0;
    weeklyClickCount = 0;

    // 获取用户数据
    await fetchUserProfile(userProfile.username);
    
    // 渲染页面
    renderUserCenter(context.container);
  }

  /**
   * 处理每周排行
   */
  async handleWeekly(context) {
    console.log('🏆 渲染每周排行');
    
    // 处理管理员解锁逻辑
    if (!adminUnlocked && homeClickCount === 3) {
      weeklyClickCount++;
      if (weeklyClickCount > 3) weeklyClickCount = 1;
      if (weeklyClickCount === 3) {
        // 弹出密码输入框
                 setTimeout(() => {
           const pwd = prompt('请输入管理员密码：');
           if (pwd === ADMIN_PASSWORD) {
             adminUnlocked = true;
             alert('验证成功，进入管理后台！');
             router.navigate('admin');
           } else {
             alert('密码错误！');
             homeClickCount = 0;
             weeklyClickCount = 0;
           }
         }, 200);
        return;
      }
    } else {
      homeClickCount = 0;
      weeklyClickCount = 0;
    }

    // 获取排行榜数据
  await fetchWeeklyRanking();
    
    // 渲染页面
    renderWeeklyRanking(context.container);
  }



  /**
   * 处理管理后台
   */
  async handleAdmin(context) {
    console.log('🔧 渲染管理后台');
    
    // 检查管理员权限
    if (!adminUnlocked) {
      alert('无权访问管理后台！');
    return;
  }

    // 获取帖子数据
    await fetchPosts();
    
    // 渲染页面
    renderAdminPanel(context.container);
  }
}

// ========== 中间件模块 ==========
class MiddlewareManager {
  /**
   * 认证中间件
   */
  static authMiddleware(context) {
    if (context.route.requiresAuth && !context.user) {
      alert('请先登录');
      return false;
    }
    return true;
  }

  /**
   * 管理员权限中间件
   */
  static adminMiddleware(context) {
    if (context.route.requiresAdmin && !adminUnlocked) {
      alert('需要管理员权限');
      return false;
    }
    return true;
  }

  /**
   * 日志中间件
   */
  static logMiddleware(context) {
    console.log(`📝 访问页面: ${context.section}`, {
      user: context.user?.username || 'anonymous',
      timestamp: new Date().toISOString()
    });
    return true;
  }

  /**
   * 性能监控中间件
   */
  static performanceMiddleware(context) {
    const startTime = performance.now();
    
    // 在路由处理完成后记录性能
    setTimeout(() => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(`⏱️ 页面加载耗时: ${duration.toFixed(2)}ms`);
    }, 0);
    
    return true;
  }
}

// ========== 导航控制器 ==========
class NavigationController {
  constructor(router) {
    this.router = router;
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // Bootstrap 导航栏
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        const section = link.getAttribute('data-section');
        this.router.navigate(section);
        
        // 更新导航状态
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
    };
  });

    // 搜索功能
    this.setupSearchBar();
  }

  /**
   * 设置搜索栏
   */
  setupSearchBar() {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
    
  if (searchBtn && searchInput) {
    searchBtn.onclick = async () => {
      const keyword = searchInput.value.trim();
      if (!keyword) return;
        
      searchBtn.disabled = true;
      searchBtn.textContent = '搜索中...';
        
      try {
        // 搜索帖子
        const postsRes = await fetch(`/api/search/posts?keyword=${encodeURIComponent(keyword)}`);
        let postsData = [];
        if (postsRes.ok) {
          const res = await postsRes.json();
          postsData = res.data || [];
        }
          
        // 搜索用户
        const usersRes = await fetch(`/api/search/users?keyword=${encodeURIComponent(keyword)}`);
        let usersData = [];
        if (usersRes.ok) {
          const res = await usersRes.json();
          usersData = res.data || [];
        }
          
        renderSearchResults(postsData, usersData);
      } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = '搜索';
      }
    };
      
    searchInput.onkeydown = e => {
      if (e.key === 'Enter') searchBtn.click();
    };
  }
}

  /**
   * 程序化导航
   */
  navigateTo(section, params = {}) {
    return this.router.navigate(section, params);
  }

  /**
   * 返回上一页
   */
  goBack() {
    // 简单的返回逻辑，可以根据需要扩展
    if (this.router.currentRoute && this.router.currentRoute !== 'home') {
      this.router.navigate('home');
    }
  }
}

// ========== 初始化路由系统 ==========
let router, navigationController;

function initializeRouter() {
  console.log('🚀 初始化路由系统...');
  
  // 创建路由实例
  router = new Router();
  
  // 添加中间件
  router.addMiddleware(MiddlewareManager.logMiddleware);
  router.addMiddleware(MiddlewareManager.performanceMiddleware);
  router.addMiddleware(MiddlewareManager.authMiddleware);
  router.addMiddleware(MiddlewareManager.adminMiddleware);
  
  // 创建导航控制器
  navigationController = new NavigationController(router);
  
  console.log('✅ 路由系统初始化完成');
}

// ========== 兼容性包装函数 ==========
// 为了保持向后兼容，保留原有的 goTo 函数
async function goTo(section, params = {}) {
  if (!router) {
    console.error('❌ 路由系统未初始化');
    return false;
  }
  return await router.navigate(section, params);
}

// ========== 搜索结果显示函数 ==========
function renderSearchResults(posts, users) {
  const container = document.getElementById('posts-container');
  container.innerHTML = '';
  const resultTitle = document.createElement('h2');
  resultTitle.textContent = '搜索结果';
  container.appendChild(resultTitle);
  
  if (posts.length > 0) {
    const postTitle = document.createElement('h3');
    postTitle.textContent = '相关帖子';
    container.appendChild(postTitle);
    posts.forEach(post => {
      const postDiv = document.createElement('div');
      postDiv.className = 'post';
      postDiv.addEventListener('click', () => goToDetail(post.id));
      const userDiv = document.createElement('div');
      userDiv.className = 'username';
      userDiv.textContent = post.user ? post.user.username : post.username;
      const contentDiv = document.createElement('div');
      contentDiv.className = 'content';
      contentDiv.textContent = post.content;
      postDiv.appendChild(userDiv);
      postDiv.appendChild(contentDiv);
      container.appendChild(postDiv);
    });
  }
  
  if (users.length > 0) {
    const userTitle = document.createElement('h3');
    userTitle.textContent = '相关用户';
    container.appendChild(userTitle);
    users.forEach(user => {
      const userDiv = document.createElement('div');
      userDiv.className = 'post';
      userDiv.style.cursor = 'pointer';
      userDiv.onclick = () => {
        // 使用新的路由系统导航到用户页面
        if (router) {
          router.navigate('user', { username: user.username });
        } else {
          goTo('user');
        }
      };
      userDiv.innerHTML = `<div class="username">${user.username}</div><div class="content">${user.bio || ''}</div>`;
      container.appendChild(userDiv);
    });
  }
  
  if (posts.length === 0 && users.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.textContent = '未找到相关内容';
    emptyDiv.style.textAlign = 'center';
    emptyDiv.style.padding = '20px';
    emptyDiv.style.color = '#888';
    container.appendChild(emptyDiv);
  }
} 

// 设置用户中心事件
function setupUserCenterEvents() {
  // 编辑个人信息事件
  let editing = false;
  
  document.getElementById('edit-name-btn').onclick = () => {
    if (editing) return;
    editing = true;
    document.getElementById('edit-username').readOnly = false;
    document.getElementById('edit-bio').readOnly = false;
    document.getElementById('save-cancel-buttons').style.display = 'block';
  };
  
  document.getElementById('edit-bio-btn').onclick = () => {
    if (editing) return;
    editing = true;
    document.getElementById('edit-username').readOnly = false;
    document.getElementById('edit-bio').readOnly = false;
    document.getElementById('save-cancel-buttons').style.display = 'block';
  };
  
  document.getElementById('save-profile-btn').onclick = async () => {
    const newName = document.getElementById('edit-username').value.trim();
    const newBio = document.getElementById('edit-bio').value.trim();
    
    if (!newName) {
      alert('昵称不能为空');
      return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      alert('请先登录');
      return;
    }
    
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: newName, bio: newBio })
      });
      
      if (res.ok) {
        const data = await res.json();
        userProfile.username = data.username;
        userProfile.bio = data.bio;
        
        // 更新显示
        document.querySelector('.text-primary').textContent = data.username;
        document.querySelector('.text-muted').textContent = data.bio;
        
        // 退出编辑模式
        editing = false;
        document.getElementById('edit-username').readOnly = true;
        document.getElementById('edit-bio').readOnly = true;
        document.getElementById('save-cancel-buttons').style.display = 'none';
        
        // 显示成功消息
        showAlert('个人信息更新成功！', 'success');
      } else {
        const error = await res.json();
        showAlert(error.error || '更新失败', 'danger');
      }
    } catch (error) {
      console.error('更新失败:', error);
      showAlert('更新失败，请稍后重试', 'danger');
    }
  };
  
  document.getElementById('cancel-edit-btn').onclick = () => {
    // 恢复原值
    document.getElementById('edit-username').value = userProfile.username;
    document.getElementById('edit-bio').value = userProfile.bio;
    
    // 退出编辑模式
    editing = false;
    document.getElementById('edit-username').readOnly = true;
    document.getElementById('edit-bio').readOnly = true;
    document.getElementById('save-cancel-buttons').style.display = 'none';
  };
  
  // 设置相关事件
  document.getElementById('theme-select').onchange = function() {
    setTheme(this.value);
    localStorage.setItem('theme', this.value);
    showAlert('主题设置已保存', 'success');
  };
  
  document.getElementById('lang-select').onchange = function() {
    setLang(this.value);
    localStorage.setItem('lang', this.value);
    showAlert('语言设置已保存', 'success');
  };
  
  document.getElementById('save-settings-btn').onclick = () => {
    // 保存通知和隐私设置
    const settings = {
      emailNotifications: document.getElementById('email-notifications').checked,
      pushNotifications: document.getElementById('push-notifications').checked,
      profilePublic: document.getElementById('profile-public').checked,
      showEmail: document.getElementById('show-email').checked
    };
    
    localStorage.setItem('userSettings', JSON.stringify(settings));
    showAlert('设置已保存', 'success');
  };
  
  document.getElementById('reset-settings-btn').onclick = () => {
    if (confirm('确定要重置所有设置吗？')) {
      // 重置为默认值
      document.getElementById('email-notifications').checked = true;
      document.getElementById('push-notifications').checked = true;
      document.getElementById('profile-public').checked = true;
      document.getElementById('show-email').checked = true;
      
      document.getElementById('theme-select').value = 'dark';
      document.getElementById('lang-select').value = 'zh';
      
      setTheme('dark');
      setLang('zh');
      
      localStorage.removeItem('userSettings');
      showAlert('设置已重置为默认值', 'info');
    }
  };
  
  // 发布新帖子事件
  document.getElementById('publish-post-btn').onclick = async () => {
    const content = document.getElementById('new-post-content').value.trim();
    if (!content) {
      showAlert('请输入帖子内容', 'warning');
      return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      showAlert('请先登录', 'warning');
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('title', content.substring(0, 50));
      formData.append('content', content);
      
      const imgFile = document.getElementById('img-upload-input').files[0];
      const codeFile = document.getElementById('code-upload-input').files[0];
      
      if (imgFile) {
        formData.append('image', imgFile);
      }
      if (codeFile) {
        formData.append('codefile', codeFile);
      }
      
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (res.ok) {
        const newPost = await res.json();
        userProfile.posts.unshift(newPost);
        
        // 清空表单
        document.getElementById('new-post-content').value = '';
        document.getElementById('img-upload-input').value = '';
        document.getElementById('code-upload-input').value = '';
        
        // 重新渲染我的帖子
        renderMyPosts();
        
        showAlert('帖子发布成功！', 'success');
      } else {
        const error = await res.json();
        showAlert(error.error || '发布失败', 'danger');
      }
    } catch (error) {
      console.error('发布失败:', error);
      showAlert('发布失败，请稍后重试', 'danger');
    }
  };
}

// 渲染我的帖子
function renderMyPosts() {
  const container = document.getElementById('my-posts-container');
  if (!container) return;
  
  if (userProfile.posts.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">暂无帖子</p>';
    return;
  }
  
  container.innerHTML = '';
  userProfile.posts.forEach((post, index) => {
    const postDiv = document.createElement('div');
    postDiv.className = 'card bg-dark text-light mb-3';
    postDiv.innerHTML = `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <p class="card-text">${post.content}</p>
            <small class="text-muted">发布时间: ${new Date(post.created_at || Date.now()).toLocaleString()}</small>
          </div>
          <button class="btn btn-outline-danger btn-sm ms-2" onclick="deleteMyPost(${index})">
            🗑️ 删除
          </button>
        </div>
      </div>
    `;
    container.appendChild(postDiv);
  });
}

// 删除我的帖子
function deleteMyPost(index) {
  if (confirm('确定要删除这条帖子吗？')) {
    userProfile.posts.splice(index, 1);
    renderMyPosts();
    showAlert('帖子已删除', 'success');
  }
}

// 显示提示消息
function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
  alertDiv.style.cssText = 'top: 100px; right: 20px; z-index: 9999; min-width: 300px;';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(alertDiv);
  
  // 3秒后自动消失
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
    }
  }, 3000);
}

// 显示成功消息
function showAuthSuccess(message) {
  authError.textContent = message;
  authError.style.display = 'block';
  authError.className = 'alert alert-success mt-3';
  setTimeout(() => {
    authError.style.display = 'none';
    authError.textContent = '';
  }, 3000);
}

// 显示错误消息
function showAuthError(message, type = 'error') {
  authError.textContent = message;
  authError.style.display = 'block';
  authError.className = `alert alert-${type} mt-3`;
}

// 页面加载完成后初始化路由系统
document.addEventListener('DOMContentLoaded', async () => {
  // 添加页面加载动画
  document.body.classList.add('fade-in');
  
  // 初始化路由系统
  initializeRouter();
  
  // 初始化数据
  await fetchPosts();
  await fetchWeeklyRanking();
  
  // 默认导航到首页
  await router.navigate('home');
  
  // 添加语言切换按钮事件处理
  const langSwitchBtn = document.getElementById('lang-switch-btn');
  if (langSwitchBtn) {
    langSwitchBtn.onclick = () => {
      const newLang = currentLang === 'zh' ? 'en' : 'zh';
      setLang(newLang);
      
      // 如果当前在设置页面，重新渲染设置页面以更新语言
      if (router && router.currentRoute === 'settings') {
        router.navigate('settings');
      }
    };
  }
  
  // 添加路由系统测试（开发环境）
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.testRouter = () => {
      console.log('🧪 测试路由系统...');
      console.log('当前路由:', router.currentRoute);
      console.log('注册的路由:', Array.from(router.routes.keys()));
      console.log('中间件数量:', router.middlewares.length);
      console.log('当前用户:', router.getCurrentUser());
    };
    
    // 在控制台输出测试命令
    console.log('🔧 开发模式：使用 window.testRouter() 测试路由系统');
  }
  
  // 添加页面元素动画
  setTimeout(() => {
    const animatedElements = document.querySelectorAll('.post, .card, .search-bar');
    animatedElements.forEach((el, index) => {
      el.style.animationDelay = `${index * 0.1}s`;
      el.classList.add('fade-in');
    });
  }, 100);

  // 自动刷新首页帖子列表（每10秒刷新一次，仅在首页时生效）
  setInterval(async () => {
    if (router && router.currentRoute === 'home') {
      await fetchPosts();
      const container = document.getElementById('posts-container');
      if (container) {
        container.innerHTML = ''; // 清空容器，避免重复
        renderPosts(container);
      }
    }
  }, 10000); // 10000毫秒=10秒
}); 