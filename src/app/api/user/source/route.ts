/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// 支持的操作类型
type Action = 'disable' | 'enable' | 'list';

interface BaseBody {
  action?: Action;
}

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行配置',
      },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as BaseBody & Record<string, any>;
    const { action } = body;

    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const username = authInfo.username;

    // 基础校验
    const ACTIONS: Action[] = ['disable', 'enable', 'list'];
    if (!username || !action || !ACTIONS.includes(action)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 获取配置与存储
    const adminConfig = await getConfig();

    // 权限与身份校验 - 任何登录用户都可以操作
    const userEntry = adminConfig.UserConfig.Users.find(
      (u) => u.username === username
    );
    if (!userEntry || userEntry.banned) {
      return NextResponse.json({ error: '权限不足' }, { status: 401 });
    }

    switch (action) {
      case 'disable': {
        const { name } = body as { name?: string };
        if (!name)
          return NextResponse.json({ error: '缺少 name 参数' }, { status: 400 });
        
        // 初始化用户enabledApis数组
        if (!userEntry.enabledApis) {
          // 获取所有当前启用的源作为基础
          userEntry.enabledApis = adminConfig.SourceConfig
            .filter(s => !s.disabled)
            .map(s => s.key);
        }
        
        // 移除指定名称的源
        const sourceToDisable = adminConfig.SourceConfig.find(s => s.name === name);
        if (sourceToDisable) {
          userEntry.enabledApis = userEntry.enabledApis.filter(key => key !== sourceToDisable.key);
        }
        
        break;
      }
      case 'enable': {
        const { name } = body as { name?: string };
        if (!name)
          return NextResponse.json({ error: '缺少 name 参数' }, { status: 400 });
        
        // 初始化用户enabledApis数组
        if (!userEntry.enabledApis) {
          // 获取所有当前启用的源作为基础
          userEntry.enabledApis = adminConfig.SourceConfig
            .filter(s => !s.disabled)
            .map(s => s.key);
        }
        
        // 添加指定名称的源
        const sourceToEnable = adminConfig.SourceConfig.find(s => s.name === name);
        if (sourceToEnable && !userEntry.enabledApis.includes(sourceToEnable.key)) {
          userEntry.enabledApis.push(sourceToEnable.key);
        }
        
        break;
      }
      case 'list': {
        // 初始化用户enabledApis数组
        if (!userEntry.enabledApis) {
          // 获取所有当前启用的源作为基础
          userEntry.enabledApis = adminConfig.SourceConfig
            .filter(s => !s.disabled)
            .map(s => s.key);
        }
        
        // 返回用户当前禁用的源列表（通过排除法）
        const allEnabledSources = adminConfig.SourceConfig
          .filter(s => !s.disabled)
          .map(s => s.name);
          
        const userEnabledSources = adminConfig.SourceConfig
          .filter(s => userEntry.enabledApis?.includes(s.key) && !s.disabled)
          .map(s => s.name);
          
        const userDisabledSources = allEnabledSources
          .filter(name => !userEnabledSources.includes(name));
          
        return NextResponse.json(
          { 
            disabledSources: userDisabledSources,
            enabledSources: userEnabledSources
          },
          {
            headers: {
              'Cache-Control': 'no-store',
            },
          }
        );
      }
      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

    // 持久化到存储
    await db.saveAdminConfig(adminConfig);

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('用户视频源管理操作失败:', error);
    return NextResponse.json(
      {
        error: '用户视频源管理操作失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}