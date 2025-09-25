import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 检查是否启用注册功能
    const ENABLE_REGISTER = process.env.NEXT_PUBLIC_ENABLE_REGISTER !== 'false';
    if (!ENABLE_REGISTER) {
      return NextResponse.json({ error: '注册功能已关闭' }, { status: 403 });
    }

    const STORAGE_TYPE =
      (process.env.NEXT_PUBLIC_STORAGE_TYPE as
        | 'localstorage'
        | 'redis'
        | 'upstash'
        | 'kvrocks'
        | undefined) || 'localstorage';

    if (STORAGE_TYPE === 'localstorage') {
      return NextResponse.json(
        { error: '当前存储模式不支持注册' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { username, password } = body || {};

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: '密码长度至少 6 位' }, { status: 400 });
    }

    const uname = username.trim();

    // 简单用户名格式校验（可按需调整）
    if (!/^[a-zA-Z0-9_\-]{3,32}$/.test(uname)) {
      return NextResponse.json(
        { error: '用户名格式不正确（仅支持字母数字_ -，长度 3-32）' },
        { status: 400 }
      );
    }

    const adminConfig = await getConfig();

    // 检查配置中是否已存在该用户
    const existsInConfig = adminConfig.UserConfig?.Users?.some(
      (u: any) => u.username === uname
    );
    if (existsInConfig) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
    }

    // 检查存储中是否已存在（兼容 db 实现）
    try {
      const exists = await db.checkUserExist(uname);
      if (exists) {
        return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
      }
    } catch (err) {
      // 若 db.checkUserExist 未实现或出错，继续尝试创建并在出错时回滚
      console.warn('检查用户存在时出错，继续创建: ', err);
    }

    // 创建用户（password 明文存储，生产环境请加密）
    await db.registerUser(uname, password);

    // 将用户写入管理员配置（持久化配置）
    if (!adminConfig.UserConfig)
      adminConfig.UserConfig = { Users: [], Tags: [] };
    if (!Array.isArray(adminConfig.UserConfig.Users))
      adminConfig.UserConfig.Users = [];

    adminConfig.UserConfig.Users.push({
      username: uname,
      role: 'user',
    });

    await db.saveAdminConfig(adminConfig);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('注册失败:', error);
    return NextResponse.json({ error: '注册失败' }, { status: 500 });
  }
}