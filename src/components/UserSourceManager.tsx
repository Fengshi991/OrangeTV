'use client';

import { useEffect, useState } from 'react';
import { Check, X, Loader2, Plus, Minus } from 'lucide-react';

interface Source {
  key: string;
  name: string;
  api: string;
  detail?: string;
  disabled?: boolean;
}

export const UserSourceManager: React.FC = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [userDisabledSources, setUserDisabledSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number} | null>(null);

  useEffect(() => {
    fetchUserSources();
  }, []);

  const fetchUserSources = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 获取所有可用的源
      const sourcesResponse = await fetch('/api/admin/source');
      if (!sourcesResponse.ok) {
        throw new Error('获取视频源列表失败');
      }
      
      const sourcesData = await sourcesResponse.json();
      const allSources: Source[] = sourcesData.sources || [];
      
      // 获取用户禁用的源列表
      const userSourcesResponse = await fetch('/api/user/source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'list' }),
      });
      
      if (!userSourcesResponse.ok) {
        throw new Error('获取用户视频源设置失败');
      }
      
      const userData = await userSourcesResponse.json();
      const disabledSources: string[] = userData.disabledSources || [];
      
      setSources(allSources);
      setUserDisabledSources(disabledSources);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = async (sourceName: string, currentlyDisabled: boolean) => {
    try {
      setUpdating(sourceName);
      setError(null);
      
      const action = currentlyDisabled ? 'enable' : 'disable';
      
      const response = await fetch('/api/user/source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action,
          name: sourceName
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `操作失败: ${action === 'disable' ? '禁用' : '启用'}源失败`);
      }
      
      // 更新本地状态
      if (action === 'disable') {
        setUserDisabledSources(prev => [...prev, sourceName]);
      } else {
        setUserDisabledSources(prev => prev.filter(name => name !== sourceName));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setUpdating(null);
    }
  };

  const toggleSelectSource = (sourceName: string) => {
    setSelectedSources(prev => {
      if (prev.includes(sourceName)) {
        return prev.filter(name => name !== sourceName);
      } else {
        return [...prev, sourceName];
      }
    });
  };

  const selectAllSources = () => {
    const allSourceNames = sources
      .filter(source => !source.disabled)
      .map(source => source.name);
    setSelectedSources(allSourceNames);
  };

  const deselectAllSources = () => {
    setSelectedSources([]);
  };

  const batchToggleSources = async (disable: boolean) => {
    try {
      const action = disable ? 'disable' : 'enable';
      setUpdating(action === 'disable' ? '批量禁用' : '批量启用');
      setError(null);
      
      // 初始化进度
      setBatchProgress({ current: 0, total: selectedSources.length });
      
      // 批量处理选中的源
      for (let i = 0; i < selectedSources.length; i++) {
        const sourceName = selectedSources[i];
        const response = await fetch('/api/user/source', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            action,
            name: sourceName
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `批量操作失败`);
        }
        
        // 更新进度
        setBatchProgress({ current: i + 1, total: selectedSources.length });
      }
      
      // 更新本地状态
      if (disable) {
        setUserDisabledSources(prev => {
          const newDisabled = [...prev];
          selectedSources.forEach(name => {
            if (!newDisabled.includes(name)) {
              newDisabled.push(name);
            }
          });
          return newDisabled;
        });
      } else {
        setUserDisabledSources(prev => 
          prev.filter(name => !selectedSources.includes(name))
        );
      }
      
      // 清空选择
      setSelectedSources([]);
      setIsSelecting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量操作失败');
    } finally {
      setUpdating(null);
      setBatchProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <button 
          onClick={fetchUserSources}
          className="mt-2 px-3 py-1 text-sm bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 rounded transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          在这里可以管理您个人的视频源设置。您可以禁用不想使用的源，这些设置仅对您个人生效，不影响其他用户。
        </p>
      </div>
      
      {/* 批量操作进度条 */}
      {batchProgress && (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700 dark:text-gray-300">
              {updating}中...
            </span>
            <span className="text-gray-700 dark:text-gray-300">
              {batchProgress.current} / {batchProgress.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ 
                width: `${(batchProgress.current / batchProgress.total) * 100}%` 
              }}
            ></div>
          </div>
        </div>
      )}
      
      {sources.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          暂无可用的视频源
        </div>
      ) : (
        <>
          {/* 多选操作栏 */}
          {isSelecting ? (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                已选择 {selectedSources.length} 项
              </span>
              <button
                onClick={deselectAllSources}
                className="text-sm px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
              >
                取消选择
              </button>
              <button
                onClick={selectAllSources}
                className="text-sm px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
              >
                全选
              </button>
              <div className="flex-grow"></div>
              <button
                onClick={() => batchToggleSources(true)}
                disabled={selectedSources.length === 0 || !!updating}
                className="flex items-center gap-1 text-sm px-3 py-1 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/50 text-red-700 dark:text-red-300 rounded transition-colors disabled:opacity-50"
              >
                {updating === '批量禁用' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Minus className="w-4 h-4" />
                )}
                <span>批量禁用</span>
              </button>
              <button
                onClick={() => batchToggleSources(false)}
                disabled={selectedSources.length === 0 || !!updating}
                className="flex items-center gap-1 text-sm px-3 py-1 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-800/50 text-green-700 dark:text-green-300 rounded transition-colors disabled:opacity-50"
              >
                {updating === '批量启用' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>批量启用</span>
              </button>
              <button
                onClick={() => setIsSelecting(false)}
                className="text-sm px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
              >
                完成
              </button>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={() => setIsSelecting(true)}
                className="flex items-center gap-1 text-sm px-3 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>批量操作</span>
              </button>
            </div>
          )}
          
          {/* 视频源列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sources
              .filter(source => !source.disabled) // 只显示启用的源
              .map((source) => {
                const isUserDisabled = userDisabledSources.includes(source.name);
                const isUpdating = updating === source.name;
                const isSelected = selectedSources.includes(source.name);
                
                return (
                  <div 
                    key={source.key}
                    className={`p-4 rounded-lg border transition-colors relative ${
                      isUserDisabled 
                        ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    } ${
                      isSelected 
                        ? 'ring-2 ring-blue-500 border-blue-500' 
                        : ''
                    }`}
                  >
                    {isSelecting && (
                      <button
                        onClick={() => toggleSelectSource(source.name)}
                        className={`absolute top-2 right-2 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        aria-label={isSelected ? '取消选择' : '选择'}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </button>
                    )}
                    
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-8">
                        <h3 className={`font-medium truncate ${
                          isUserDisabled 
                            ? 'text-gray-500 dark:text-gray-400' 
                            : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {source.name}
                        </h3>
                        {source.detail && (
                          <p className={`text-xs mt-1 truncate ${
                            isUserDisabled 
                              ? 'text-gray-400 dark:text-gray-500' 
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {source.detail}
                          </p>
                        )}
                      </div>
                      
                      {!isSelecting && (
                        <button
                          onClick={() => toggleSource(source.name, isUserDisabled)}
                          disabled={isUpdating}
                          className={`ml-3 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                            isUserDisabled
                              ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-500'
                              : 'bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-800/50 text-green-600 dark:text-green-400'
                          } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          aria-label={isUserDisabled ? '启用源' : '禁用源'}
                        >
                          {isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isUserDisabled ? (
                            <X className="w-4 h-4" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                    
                    {isUserDisabled && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        已禁用 - 该源不会在搜索结果中显示
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
};