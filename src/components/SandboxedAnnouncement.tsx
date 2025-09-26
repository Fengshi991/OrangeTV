'use client';

import { useEffect, useRef } from 'react';

interface SandboxedAnnouncementProps {
  content: string;
  onClose: () => void;
}

export default function SandboxedAnnouncement({ content, onClose }: SandboxedAnnouncementProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current || !content) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) return;

    // 解析 Vue 和 JavaScript 代码
    let htmlContent = content;
    let scriptContent = '';
    
    // 提取 script 标签中的内容
    const scriptMatches = content.match(/<script>([\s\S]*?)<\/script>/gi);
    if (scriptMatches) {
      scriptContent = scriptMatches.map(match => 
        match.replace(/<\/?script>/gi, '')
      ).join('\n');
      
      // 移除 script 标签，保留 HTML 内容
      htmlContent = content.replace(/<script>[\s\S]*?<\/script>/gi, '');
    }

    // 创建沙箱环境的HTML内容
    const iframeContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/element-ui@2.15.14/lib/theme-chalk/index.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/vue@2.6.14/dist/vue.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/element-ui@2.15.14/lib/index.js"></script>
        <style>
          body {
            margin: 0;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #fff;
            color: #333;
          }
          @media (prefers-color-scheme: dark) {
            body {
              background-color: #111827;
              color: #e5e7eb;
            }
          }
          .dark body {
            background-color: #111827;
            color: #e5e7eb;
          }
          .container {
            max-width: 100%;
          }
          /* 隐藏 Element UI 的关闭按钮，防止 XSS */
          .el-message__closeBtn, .el-notification__closeBtn {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div id="app" class="container">
          ${htmlContent}
        </div>
        <script>
          // 安全处理：移除所有可能的危险元素和属性
          (function() {
            // 移除所有 script 标签（防止嵌套）
            const scripts = document.querySelectorAll('script:not([src])');
            scripts.forEach(script => script.remove());
            
            // 移除所有事件处理器属性
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
              const attributes = el.getAttributeNames();
              attributes.forEach(attr => {
                if (attr.toLowerCase().startsWith('on')) {
                  el.removeAttribute(attr);
                }
              });
            });
            
            // 移除 javascript: 和 data: 协议的链接
            const links = document.querySelectorAll('[href], [src]');
            links.forEach(link => {
              const href = link.getAttribute('href');
              const src = link.getAttribute('src');
              if (href && (href.toLowerCase().startsWith('javascript:') || href.toLowerCase().startsWith('data:'))) {
                link.removeAttribute('href');
              }
              if (src && (src.toLowerCase().startsWith('javascript:') || src.toLowerCase().startsWith('data:'))) {
                link.removeAttribute('src');
              }
            });
          })();
          
          // 初始化 Vue（如果内容中包含 Vue 相关代码）
          document.addEventListener('DOMContentLoaded', function() {
            try {
              // 如果用户提供了自定义脚本，则执行
              if (${scriptContent ? 'true' : 'false'}) {
                const userScript = ${scriptContent ? JSON.stringify(scriptContent) : '""'};
                if (userScript && typeof Vue !== 'undefined') {
                  // 创建一个安全的执行环境
                  const script = document.createElement('script');
                  script.textContent = userScript;
                  document.head.appendChild(script);
                  document.head.removeChild(script);
                }
              }
              
              // 查找可能的 Vue 实例挂载点
              const appDiv = document.getElementById('app');
              if (appDiv && typeof Vue !== 'undefined') {
                // 自动初始化 Vue 实例
                new Vue({
                  el: '#app'
                });
              }
            } catch (e) {
              console.warn('Vue initialization failed in sandbox:', e);
            }
          });
        </script>
      </body>
      </html>
    `;

    iframeDoc.open();
    iframeDoc.write(iframeContent);
    iframeDoc.close();

    // 监听 iframe 内部的点击事件，处理关闭按钮
    const handleIframeLoad = () => {
      try {
        const iframeWindow = iframe.contentWindow;
        if (iframeWindow) {
          // 添加一个消息监听器，允许 iframe 内容通过 postMessage 与父页面通信
          iframeWindow.addEventListener('message', (event) => {
            if (event.data.type === 'CLOSE_ANNOUNCEMENT') {
              onClose();
            }
          });
        }
      } catch (e) {
        console.warn('无法访问 iframe 内容', e);
      }
    };

    iframe.addEventListener('load', handleIframeLoad);

    return () => {
      iframe.removeEventListener('load', handleIframeLoad);
    };
  }, [content, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm dark:bg-black/70 p-4 transition-opacity duration-300">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl dark:bg-gray-900 transform transition-all duration-300 hover:shadow-2xl overflow-hidden flex flex-col h-[80vh]">
        <div className="flex justify-between items-center mb-0 p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold tracking-tight text-gray-800 dark:text-white">
            站点公告
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-white transition-colors"
            aria-label="关闭"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-grow">
          <iframe
            ref={iframeRef}
            title="公告内容"
            sandbox="allow-same-origin allow-scripts"
            className="w-full h-full border-0"
          />
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-white font-medium shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-800 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 transition-all duration-300 transform hover:-translate-y-0.5"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}