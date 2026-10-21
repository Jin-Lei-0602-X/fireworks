# 像素烟花 · Pixel Fireworks

一个没有框架、没有外部依赖的像素风烟花小站。打开页面就会自动放烟花，点击或轻触夜空还能亲手点亮一朵。

![像素烟花预览](preview.png)

## 功能

- 自动升空、绽放的像素烟花
- 7 种烟花形态：牡丹、圆环、双层环、垂柳、棕榈、爱心、闪粉
- 点击 / 轻触夜空立即绽放烟花
- 可开关的 Web Audio 合成音效（无音频文件）
- 像素月亮、星空、流星、云、城市剪影和松树前景
- 响应式画布 + `image-rendering: pixelated`，桌面和手机都保持颗粒感
- 空格或右上角按钮暂停；支持键盘操作与减少动态效果偏好设置

## 本地预览

直接双击 `index.html` 即可。也可以在当前目录启动一个静态服务器：

```bash
python -m http.server 8000
```

然后打开 <http://localhost:8000>。

## 发布到 GitHub Pages

1. 新建一个 GitHub 仓库，把本目录中的文件放到仓库根目录：
   ```text
   index.html
   style.css
   app.js
   favicon.svg
   preview.png
   README.md
   .nojekyll
   ```
2. 推送到 GitHub：
   ```bash
   git add .
   git commit -m "Add pixel fireworks"
   git push
   ```
3. 打开仓库的 **Settings → Pages**。
4. 在 **Build and deployment** 中选择 **Deploy from a branch**，分支选 `main`，目录选 `/ (root)`，保存。
5. 等一两分钟，访问：
   ```text
   https://<你的用户名>.github.io/<仓库名>/
   ```

如果仓库以 `<你的用户名>.github.io` 命名，地址就是 `https://<你的用户名>.github.io/`。

## 想改点什么

- 配色：`app.js` 里的 `PALETTES`
- 烟花种类与出现权重：`app.js` 里的 `SHELL_TYPES`
- 自动发射间隔：`update()` 中的 `state.autoTimer`
- 画布颗粒大小：`buildScene()` 中的 `pixelScale`
- 所有页面样式：`style.css`

音效默认关闭，浏览器需要一次用户点击才能播放声音。手机端点击右上角的「音效」按钮即可开启。
