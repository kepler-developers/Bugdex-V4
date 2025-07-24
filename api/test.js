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
  
  // 简单的测试接口
  if (pathname === '/api/test' && request.method === 'GET') {
    return new Response(JSON.stringify({
      success: true,
      message: 'API 正常工作',
      timestamp: new Date().toISOString(),
      pathname: pathname,
      method: request.method
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // 登录测试接口
  if (pathname === '/api/test-login' && request.method === 'POST') {
    try {
      const { username, password } = await request.json();
      
      // 简单的测试账号验证
      if (username === 'admin' && password === 'admin123') {
        return new Response(JSON.stringify({
          success: true,
          message: '登录成功',
          user: { username: 'admin', bio: '测试账号' },
          token: 'test_token_' + Date.now()
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } else {
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
      }
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: '请求格式错误',
        error: error.message
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  return new Response(JSON.stringify({
    success: false,
    message: '接口不存在',
    pathname: pathname,
    method: request.method
  }), {
    status: 404,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
} 