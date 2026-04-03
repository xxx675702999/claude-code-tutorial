import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Claude Code 源码教学指南',
  description: '从零到一掌握 Claude Code 插件开发',
  base: '/claude-code-tutorial/',

  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN'
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      title: 'Claude Code Source Code Tutorial',
      description: 'Master Claude Code Plugin Development from Scratch'
    }
  },

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '中文教程', link: '/cn/第1章-项目概述-CN' },
      { text: 'English', link: '/en/chapter1-introduction-EN' },
      {
        text: 'GitHub',
        link: 'https://github.com/xxx675702999/claude-code-tutorial'
      }
    ],

    sidebar: {
      '/cn/': [
        {
          text: '入门篇',
          collapsible: true,
          items: [
            { text: '第1章 - 项目概述', link: '/cn/第1章-项目概述-CN' },
            { text: '第2章 - 环境搭建', link: '/cn/第2章-环境搭建-CN' }
          ]
        },
        {
          text: '核心概念',
          collapsible: true,
          items: [
            { text: '第3章 - 核心概念进阶', link: '/cn/第3章-核心概念-CN' },
            { text: '第4章 - 第一个应用', link: '/cn/第4章-第一个应用-CN' },
            { text: '第5章 - QueryEngine详解', link: '/cn/第5章-QueryEngine详解-CN' },
            { text: '第6章 - BashTool详解', link: '/cn/第6章-BashTool详解-CN' },
            { text: '第7章 - 工具系统', link: '/cn/第7章-工具系统-CN' }
          ]
        },
        {
          text: '进阶功能',
          collapsible: true,
          items: [
            { text: '第8章 - 权限系统', link: '/cn/第8章-权限系统-CN' },
            { text: '第9章 - 上下文管理', link: '/cn/第9章-上下文管理-CN' },
            { text: '第10章 - MCP集成', link: '/cn/第10章-MCP集成-CN' },
            { text: '第11章 - 代理系统', link: '/cn/第11章-代理系统-CN' }
          ]
        },
        {
          text: '高级主题',
          collapsible: true,
          items: [
            { text: '第12章 - 状态管理', link: '/cn/第12章-状态管理-CN' },
            { text: '第13章 - 性能优化', link: '/cn/第13章-性能优化-CN' },
            { text: '第14章 - 自定义工具', link: '/cn/第14章-自定义工具-CN' },
            { text: '第15章 - 插件系统', link: '/cn/第15章-插件系统-CN' }
          ]
        },
        {
          text: '工程实践',
          collapsible: true,
          items: [
            { text: '第16章 - 错误处理', link: '/cn/第16章-错误处理-CN' },
            { text: '第17章 - 安全实践', link: '/cn/第17章-安全实践-CN' },
            { text: '第18章 - Ink框架', link: '/cn/第18章-Ink框架-CN' },
            { text: '第19章 - 桥接系统', link: '/cn/第19章-桥接系统-CN' }
          ]
        },
        {
          text: '项目实战',
          collapsible: true,
          items: [
            { text: '第20章 - API集成', link: '/cn/第20章-API集成-CN' },
            { text: '第21章 - 平台差异', link: '/cn/第21章-平台差异-CN' },
            { text: '第22章 - 综合实战', link: '/cn/第22章-综合实战-CN' },
            { text: '第23章 - 调试实战', link: '/cn/第23章-调试实战-CN' }
          ]
        }
      ],
      '/en/': [
        {
          text: 'Getting Started',
          collapsible: true,
          items: [
            { text: 'Chapter 1 - Introduction', link: '/en/chapter1-introduction-EN' },
            { text: 'Chapter 2 - Setup', link: '/en/chapter2-setup-EN' }
          ]
        },
        {
          text: 'Core Concepts',
          collapsible: true,
          items: [
            { text: 'Chapter 3 - Concepts', link: '/en/chapter3-concepts-EN' },
            { text: 'Chapter 4 - First App', link: '/en/chapter4-first-app-EN' },
            { text: 'Chapter 5 - QueryEngine', link: '/en/chapter5-queryengine-EN' },
            { text: 'Chapter 6 - BashTool', link: '/en/chapter6-bashtool-EN' },
            { text: 'Chapter 7 - Tool System', link: '/en/chapter7-tool-system-EN' }
          ]
        },
        {
          text: 'Advanced Features',
          collapsible: true,
          items: [
            { text: 'Chapter 8 - Permissions', link: '/en/chapter8-permissions-EN' },
            { text: 'Chapter 9 - Context', link: '/en/chapter9-context-EN' },
            { text: 'Chapter 10 - MCP', link: '/en/chapter10-mcp-EN' },
            { text: 'Chapter 11 - Agents', link: '/en/chapter11-agent-EN' }
          ]
        },
        {
          text: 'Advanced Topics',
          collapsible: true,
          items: [
            { text: 'Chapter 12 - State', link: '/en/chapter12-state-EN' },
            { text: 'Chapter 13 - Performance', link: '/en/chapter13-performance-EN' },
            { text: 'Chapter 14 - Custom Tools', link: '/en/chapter14-custom-tools-EN' },
            { text: 'Chapter 15 - Plugins', link: '/en/chapter15-plugins-EN' }
          ]
        },
        {
          text: 'Engineering Practice',
          collapsible: true,
          items: [
            { text: 'Chapter 16 - Error Handling', link: '/en/chapter16-error-handling-EN' },
            { text: 'Chapter 17 - Security', link: '/en/chapter17-security-EN' },
            { text: 'Chapter 18 - Ink Framework', link: '/en/chapter18-ink-EN' },
            { text: 'Chapter 19 - Bridge', link: '/en/chapter19-bridge-EN' }
          ]
        },
        {
          text: 'Project Practice',
          collapsible: true,
          items: [
            { text: 'Chapter 20 - API Integration', link: '/en/chapter20-api-EN' },
            { text: 'Chapter 21 - Platforms', link: '/en/chapter21-platforms-EN' },
            { text: 'Chapter 22 - Comprehensive Project', link: '/en/chapter22-project-EN' },
            { text: 'Chapter 23 - Debugging', link: '/en/chapter23-debugging-EN' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/xxx675702999/claude-code-tutorial' }
    ],

    footer: {
      message: '基于 MIT 许可发布',
      copyright: 'Copyright © 2026 Claude Code Team'
    },

    search: {
      provider: 'local',
      options: {
        locales: {
          zh: {
            placeholder: '搜索文档',
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档'
              },
              modal: {
                noResultsText: '无法找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换'
                }
              }
            }
          }
        }
      }
    },

    editLink: {
      pattern: 'https://github.com/xxx675702999/claude-code-tutorial/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },

    lastUpdated: {
      text: '最后更新',
      formatOptions: {
        dateStyle: 'full',
        timeStyle: 'short'
      }
    }
  },

  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  },

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'author', content: 'Claude Code Team' }],
    ['meta', { property: 'og:title', content: 'Claude Code 源码教学指南' }],
    ['meta', { property: 'og:description', content: '从零到一掌握 Claude Code 插件开发' }],
    ['meta', { property: 'og:type', content: 'website' }]
  ],

  // 禁用死链接检查
  ignoreDeadLinks: true,
  lastUpdated: true,

  vite: {
    build: {
      chunkSizeWarningLimit: 1000
    }
  }
})
