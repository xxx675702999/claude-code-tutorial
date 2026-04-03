import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Claude Code 源码教学指南',
  description: '从零到一掌握 Claude Code 插件开发',

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
      { text: '中文教程', link: '/cn/第01章-快速开始' },
      { text: 'English', link: '/en/chapter01-quick-start' },
      {
        text: 'GitHub',
        link: 'https://github.com/your-username/claude-code-tutorial'
      }
    ],

    sidebar: {
      '/cn/': [
        {
          text: '入门篇',
          collapsible: true,
          items: [
            { text: '第1章 - 快速开始', link: '/cn/第01章-快速开始' },
            { text: '第2章 - Claude Code 架构', link: '/cn/第02章-Claude-Code架构-CN' }
          ]
        },
        {
          text: '核心篇',
          collapsible: true,
          items: [
            { text: '第3章 - Hooks 系统详解', link: '/cn/第03章-Hooks系统详解-CN' },
            { text: '第4章 - 自定义工具', link: '/cn/第04章-自定义工具-CN' },
            { text: '第5章 - 插件系统', link: '/cn/第05章-插件系统-CN' },
            { text: '第6章 - 错误处理', link: '/cn/第06章-错误处理-CN' },
            { text: '第7章 - 性能优化', link: '/cn/第07章-性能优化-CN' }
          ]
        },
        {
          text: '进阶篇',
          collapsible: true,
          items: [
            { text: '第8章 - Ink 框架', link: '/cn/第08章-Ink框架-CN' },
            { text: '第9章 - 桥接系统', link: '/cn/第09章-桥接系统-CN' },
            { text: '第10章 - API 集成', link: '/cn/第10章-API集成-CN' },
            { text: '第11章 - 平台差异', link: '/cn/第11章-平台差异-CN' }
          ]
        },
        {
          text: '实战篇',
          collapsible: true,
          items: [
            { text: '第12章 - 综合实战', link: '/cn/第12章-综合实战-CN' },
            { text: '第13章 - 调试实战', link: '/cn/第13章-调试实战-CN' }
          ]
        }
      ],
      '/en/': [
        {
          text: 'Getting Started',
          collapsible: true,
          items: [
            { text: 'Chapter 1 - Quick Start', link: '/en/chapter01-quick-start' },
            { text: 'Chapter 2 - Claude Code Architecture', link: '/en/chapter02-architecture' }
          ]
        },
        {
          text: 'Core Concepts',
          collapsible: true,
          items: [
            { text: 'Chapter 3 - Hooks System', link: '/en/chapter03-hooks-system' },
            { text: 'Chapter 4 - Custom Tools', link: '/en/chapter04-custom-tools' },
            { text: 'Chapter 5 - Plugin System', link: '/en/chapter05-plugin-system' },
            { text: 'Chapter 6 - Error Handling', link: '/en/chapter06-error-handling' },
            { text: 'Chapter 7 - Performance', link: '/en/chapter07-performance' }
          ]
        },
        {
          text: 'Advanced',
          collapsible: true,
          items: [
            { text: 'Chapter 8 - Ink Framework', link: '/en/chapter08-ink-framework' },
            { text: 'Chapter 9 - Bridge System', link: '/en/chapter09-bridge-system' },
            { text: 'Chapter 10 - API Integration', link: '/en/chapter10-api-integration' },
            { text: 'Chapter 11 - Platform Differences', link: '/en/chapter11-platforms' }
          ]
        },
        {
          text: 'Practice',
          collapsible: true,
          items: [
            { text: 'Chapter 12 - Comprehensive Project', link: '/en/chapter12-project' },
            { text: 'Chapter 13 - Debugging', link: '/en/chapter13-debugging' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/your-username/claude-code-tutorial' }
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
      pattern: 'https://github.com/your-username/claude-code-tutorial/edit/main/docs/:path',
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

  vite: {
    build: {
      chunkSizeWarningLimit: 1000
    }
  }
})
