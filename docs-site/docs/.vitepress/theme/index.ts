import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { h } from "vue";
import HomePage from "./HomePage.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout() {
    // index.md declares `layout: home` with no `features`, so everything below
    // the hero is rendered from here.
    return h(DefaultTheme.Layout, null, {
      "home-hero-after": () => h(HomePage),
    });
  },
} satisfies Theme;
