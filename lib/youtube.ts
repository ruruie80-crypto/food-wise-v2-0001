/** 検索語から、読み仮名やかっこの補足を外す。 */
export function youtubeSearchName(dishName: string): string {
  return dishName.replace(/（[^）]*）|\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

/** YouTubeの検索を開くだけ。APIキーも、動画の保存もしない。 */
export function youtubeCookUrl(dishName: string): string {
  const query = `${youtubeSearchName(dishName)} 作り方`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
