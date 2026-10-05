import { defineConfig, type DefaultTheme } from "vitepress";

const REPO = "https://github.com/ijry/YoYoMusic";
const RELEASES = `${REPO}/releases/latest`;
const SITE = "https://ijry.github.io/YoYoMusic/";

const nav: DefaultTheme.NavItem[] = [
  { text: "指南", link: "/guide/installation", activeMatch: "^/guide/" },
  { text: "功能", link: "/guide/features", activeMatch: "^/guide/features" },
  { text: "开发", link: "/dev/architecture", activeMatch: "^/dev/" },
  { text: "FAQ", link: "/faq" },
  { text: "下载", link: RELEASES },
];

const sidebar: DefaultTheme.Sidebar = {
  "/guide/": [
    {
      text: "开始使用",
      collapsed: false,
      items: [
        { text: "安装", link: "/guide/installation" },
        { text: "快速开始", link: "/guide/quick-start" },
      ],
    },
    {
      text: "功能详解",
      collapsed: false,
      items: [{ text: "功能总览", link: "/guide/features" }],
    },
  ],
  "/dev/": [
    {
      text: "开发",
      collapsed: false,
      items: [
        { text: "架构总览", link: "/dev/architecture" },
        { text: "发布流程", link: "/dev/release" },
      ],
    },
  ],
};

export default defineConfig({
  base: "/YoYoMusic/",
  // GitHub Pages cannot map /foo to foo.html, so clean URLs would 404 site-wide.
  cleanUrls: false,
  lastUpdated: true,
  metaChunk: true,
  srcExclude: ["README.md", "**/_*.md"],

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/YoYoMusic/logo.svg" }],
    ["meta", { name: "theme-color", content: "#07070f" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "悠悠乐听" }],
  ],

  sitemap: { hostname: SITE },

  // The product is a dark music player; a light landing page would misrepresent
  // it. force-dark also drops the light/dark switch, which the site never uses.
  // This is a site-level option — putting it under themeConfig is silently ignored.
  appearance: "force-dark",

  title: "悠悠乐听",
  titleTemplate: ":title | 悠悠乐听",
  description:
    "悠悠乐听是一款基于 Tauri 2、React 19 与 Rust 的跨平台桌面音乐播放器：本地优先、无广告、六种实时音频可视化、四套现代玻璃拟态皮肤、十段均衡器、歌词与桌面歌词窗口。以 AGPL-3.0 许可开源。",

  themeConfig: {
    logo: "/logo.svg",
    nav,
    sidebar,
    outline: { level: [2, 3], label: "本页目录" },
    docFooter: { prev: "上一页", next: "下一页" },
    editLink: {
      pattern: `${REPO}/edit/main/docs-site/docs/:path`,
      text: "在 GitHub 上编辑此页",
    },
    lastUpdated: {
      text: "最后更新于",
      formatOptions: { dateStyle: "short", timeStyle: "short" },
    },
    returnToTopLabel: "回到顶部",
    sidebarMenuLabel: "菜单",
    darkModeSwitchLabel: "外观",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",
    skipToContentLabel: "跳到主要内容",
    notFound: {
      title: "页面不存在",
      quote: "你访问的页面可能已被移动，或者从未存在过。",
      linkLabel: "返回首页",
      linkText: "返回首页",
    },
    socialLinks: [{ icon: "github", link: REPO }],
    footer: {
      message: "基于 AGPL-3.0-or-later 许可发布",
      copyright: "Copyright © 2026 xyito",
    },
    search: {
      provider: "local",
      options: {
        miniSearch: {
          options: {
            // MiniSearch splits on non-alphanumerics, which turns a whole
            // Chinese phrase into one token. Emit per-character tokens too so
            // Chinese search actually returns hits.
            tokenize: (text: string) =>
              text
                .split(/[^\p{L}\p{N}]+/u)
                .flatMap((word) => (/[\u4e00-\u9fa5]/.test(word) ? [word, ...word.split("")] : [word]))
                .filter(Boolean),
            processTerm: (term: string) => term.toLowerCase(),
          },
          searchOptions: { fuzzy: 0.2, prefix: true },
        },
        translations: {
          button: { buttonText: "搜索文档", buttonAriaLabel: "搜索文档" },
          modal: {
            displayDetails: "显示详细列表",
            resetButtonTitle: "清除查询条件",
            backButtonTitle: "关闭搜索",
            noResultsText: "无法找到相关结果",
            footer: {
              selectText: "选择",
              navigateText: "切换",
              closeText: "关闭",
            },
          },
        },
      },
    },
  },

  transformPageData(pageData) {
    const canonical = SITE + pageData.relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, ".html");

    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ["link", { rel: "canonical", href: canonical }],
      ["meta", { property: "og:url", content: canonical }],
      ["meta", { property: "og:title", content: pageData.title ?? "悠悠乐听" }],
      ["meta", { property: "og:description", content: pageData.description ?? "" }],
    );
  },
});
