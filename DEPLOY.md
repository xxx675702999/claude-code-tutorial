# 🚀 GitHub 部署指南

## ✅ 项目已准备完成

新仓库已创建在：`C:\Users\Ken\Private\Code\claude-code-tutorial`

包含内容：
- ✅ 23 章完整教程（中英双语）
- ✅ VitePress 配置
- ✅ GitHub Actions 工作流
- ✅ Git 仓库初始化
- ✅ 首次提交完成

## 📤 部署到 GitHub

### 第一步：创建 GitHub 仓库

1. 访问 [GitHub](https://github.com/new)
2. 创建新仓库：`claude-code-tutorial`
3. **不要**初始化 README、.gitignore 或 license
4. 点击"Create repository"

### 第二步：推送代码

```bash
# 进入项目目录
cd C:\Users\Ken\Private\Code\claude-code-tutorial

# 添加远程仓库（替换 xxx675702999）
git remote add origin https://github.com/xxx675702999/claude-code-tutorial.git

# 推送代码
git push -u origin main
```

### 第三步：启用 GitHub Pages

1. 进入仓库页面
2. 点击 **Settings** → **Pages**
3. **Source** 选择：**GitHub Actions**
4. 点击 **Save**

### 第四步：等待部署完成

1. 点击 **Actions** 标签页
2. 等待 "Deploy" 工作流完成（约 2-3 分钟）
3. 看到绿色的 ✅ 表示成功

### 第五步：访问网站

部署成功后，访问：
```
https://xxx675702999.github.io/claude-code-tutorial/
```

## 🎨 自定义配置

### 更新仓库信息

在以下文件中替换 `your-username`：

1. **`.github/workflows/deploy.yml`**
   ```yaml
   # 不需要修改，会自动使用你的仓库
   ```

2. **`docs/.vitepress/config.ts`**
   ```typescript
   // 修改这部分
   link: 'https://github.com/xxx675702999/claude-code-tutorial'
   ```

3. **`README.md`**
   ```markdown
   // 更新所有链接
   your-username/claude-code-tutorial
   ```

### 修改后提交

```bash
git add .
git commit -m "chore: 更新仓库信息"
git push
```

## 🔧 本地开发

### 安装依赖

```bash
cd C:\Users\Ken\Private\Code\claude-code-tutorial
npm install
```

### 启动开发服务器

```bash
npm run docs:dev
```

访问：http://localhost:5173

### 本地构建

```bash
npm run docs:build
```

### 预览构建结果

```bash
npm run docs:preview
```

## 📝 添加新内容

### 添加新章节

1. 在 `docs/cn/` 或 `docs/en/` 添加新 Markdown 文件
2. 更新 `docs/.vitepress/config.ts` 的侧边栏配置
3. 提交并推送

```bash
git add .
git commit -m "docs: 添加新章节"
git push
```

### 修改现有内容

1. 直接编辑 Markdown 文件
2. 保存后自动重新构建（开发模式）
3. 提交更改

## 🎯 后续优化建议

### 1. 添加自定义域名

在 `docs/` 添加 `CNAME` 文件：
```
your-custom-domain.com
```

### 2. 添加评论系统

在 `docs/.vitepress/config.ts` 添加：
```typescript
comment: {
  provider: 'giscus',
  repo: 'xxx675702999/claude-code-tutorial',
  // ... 其他配置
}
```

### 3. 添加分析

```typescript
analytics: {
  provider: 'google',
  id: 'G-XXXXXXXXXX'
}
```

### 4. 自定义主题

创建 `docs/.vitepress/theme/` 目录添加自定义样式。

## 🐛 常见问题

### 部署失败

**检查**：
- GitHub Actions 是否启用
- Pages 设置是否为 "GitHub Actions"
- 仓库是否为公开仓库

### 构建错误

**解决**：
```bash
# 清除缓存
rm -rf node_modules docs/.vitepress/cache
npm install
npm run docs:build
```

### 样式问题

**检查**：
- VitePress 版本是否正确
- 浏览器缓存是否清除

## 📚 相关资源

- [VitePress 官方文档](https://vitepress.dev/)
- [GitHub Pages 文档](https://docs.github.com/en/pages)
- [GitHub Actions 文档](https://docs.github.com/en/actions)

---

**准备好部署了吗？按照上面的步骤，几分钟内就能让你的教程网站上线！** 🚀
