import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "底値ごはん",
    short_name: "底値ごはん",
    description: "公開用の試作。見本の相場と端末内の値札から、予算内の献立と買い物リストを作る。",
    start_url: "/",
    display: "standalone",
    background_color: "#f4efe4",
    theme_color: "#1b6b43",
    lang: "ja",
  };
}
