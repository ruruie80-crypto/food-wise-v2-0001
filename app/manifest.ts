import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "底値ごはん",
    short_name: "底値ごはん",
    description: "値札から生活圏の底値を学び、予算内の献立と買い物リストを作る。",
    start_url: "/",
    display: "standalone",
    background_color: "#f4efe4",
    theme_color: "#1b6b43",
    lang: "ja",
  };
}
