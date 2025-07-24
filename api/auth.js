// 临时内存存储（用于 KV 存储未申请时的测试）
const tempStorage = {
  users: new Map(),
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
  
  // 邮件发送函数
  async function sendEmail(to, subject, content) {
    // 优先使用 SendGrid
    if (env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL) {
      try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: env.SENDGRID_FROM_EMAIL },
            subject: subject,
            content: [{ type: 'text/html', value: content }],
          }),
        });
        
        if (response.ok) {
          return { success: true };
        }
      } catch (error) {
        console.error('SendGrid error:', error);
      }
    }
    
    // 备用方案：Resend
    if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: env.RESEND_FROM_EMAIL,
            to: [to],
            subject: subject,
            html: content,
          }),
        });
        
        if (response.ok) {
          return { success: true };
        }
      } catch (error) {
        console.error('Resend error:', error);
      }
    }
    
    return { success: false, error: 'No email service configured' };
  }
  
  if (pathname === '/api/login' && request.method === 'POST') {
    try {
      const { username, password } = await request.json();
      
      // 优先从临时存储获取用户信息（测试账号）
      let user = tempStorage.users.get(username);
      
      // 如果临时存储中没有，尝试从 KV 获取
      if (!user && env.bugdex_kv) {
        const userKey = `user:${username}`;
        user = await env.bugdex_kv.get(userKey, { type: 'json' });
      }
      
      if (user && user.password === password) {
        // 改进JWT token生成（简化版，生产环境应使用真正的JWT库）
        const payload = { 
          username, 
          exp: Date.now() + 86400000,
          iat: Date.now(),
          iss: 'bugdex-forum'
        };
        const token = btoa(JSON.stringify(payload)) + '.' + btoa(Date.now().toString());
        
        return new Response(JSON.stringify({
          success: true,
          token,
          user: { username: user.username, bio: user.bio }
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      return new Response(JSON.stringify({
        success: false,
        message: '用户名或密码错误'
      }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: '请求格式错误'
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  if (pathname === '/api/register' && request.method === 'POST') {
    try {
      const { username, email, password, code } = await request.json();
      
      // 验证邮箱验证码
      let codeData = tempStorage.codes.get(email);
      
      // 如果临时存储中没有，尝试从 KV 获取
      if (!codeData && env.bugdex_kv) {
        const codeKey = `email_code:${email}`;
        codeData = await env.bugdex_kv.get(codeKey, { type: 'json' });
      }
      
      if (!codeData || codeData.code !== code) {
        return new Response(JSON.stringify({
          success: false,
          message: '验证码错误或已过期'
        }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // 检查验证码是否过期（5分钟）
      if (Date.now() > codeData.expires_at) {
        return new Response(JSON.stringify({
          success: false,
          message: '验证码已过期'
        }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // 检查用户是否已存在
      let existingUser = tempStorage.users.get(username);
      
      // 如果临时存储中没有，尝试从 KV 获取
      if (!existingUser && env.bugdex_kv) {
        const userKey = `user:${username}`;
        existingUser = await env.bugdex_kv.get(userKey);
      }
      
      if (existingUser) {
        return new Response(JSON.stringify({
          success: false,
          message: '用户名已存在'
        }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // 保存用户信息
      const userData = {
        username,
        email,
        password,
        bio: '这是你的个人简介，可以在"用户中心"编辑。',
        created_at: new Date().toISOString()
      };
      
      // 优先保存到临时存储
      tempStorage.users.set(username, userData);
      
      // 如果 KV 可用，也保存到 KV
      if (env.bugdex_kv) {
        const userKey = `user:${username}`;
        await env.bugdex_kv.put(userKey, JSON.stringify(userData));
      }
      
      // 删除已使用的验证码
      tempStorage.codes.delete(email);
      if (env.bugdex_kv) {
        const codeKey = `email_code:${email}`;
        await env.bugdex_kv.delete(codeKey);
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: '注册成功'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: '注册失败'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  if (pathname === '/api/send_email_code' && request.method === 'POST') {
    try {
      const { email } = await request.json();
      
      // 生成验证码
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 保存验证码到临时存储
      const codeData = {
        code,
        created_at: Date.now(),
        expires_at: Date.now() + 300000 // 5分钟过期
      };
      
      tempStorage.codes.set(email, codeData);
      
      // 如果 KV 可用，也保存到 KV
      if (env.bugdex_kv) {
        await env.bugdex_kv.put(`email_code:${email}`, JSON.stringify(codeData));
      }
      
      // 发送邮件
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">BugDex 验证码</h2>
          <p>您好！</p>
          <p>您的验证码是：</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; color: #333; margin: 20px 0;">
            ${code}
          </div>
          <p>验证码有效期为 5 分钟，请尽快使用。</p>
          <p>如果这不是您的操作，请忽略此邮件。</p>
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">此邮件由 BugDex 论坛系统自动发送</p>
        </div>
      `;
      
      const emailResult = await sendEmail(email, 'BugDex 验证码', emailContent);
      
      if (emailResult.success) {
        return new Response(JSON.stringify({
          success: true,
          message: '验证码已发送到您的邮箱'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } else {
        // 如果邮件发送失败，返回模拟成功（开发阶段）
        return new Response(JSON.stringify({
          success: true,
          message: '验证码已发送（模拟）',
          debug: '邮件服务未配置，使用模拟发送',
          code: code // 临时显示验证码用于测试
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: '发送验证码失败'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
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