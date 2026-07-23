/** Primary navigation — order and labels from the design's site chrome. */
export const NAV = [
  { href: "/", label: "Home" },
  { href: "/heritage", label: "Heritage" },
  { href: "/academics", label: "Academics" },
  { href: "/admissions", label: "Admissions" },
  { href: "/gallery", label: "Campus" },
  { href: "/contact", label: "Contact" },
] as const;

/**
 * Real school photography, hotlinked from the live site per the design brief.
 * The Img component falls back to a maroon crest panel if any image 404s.
 */
export const IMG = {
  campus:
    "https://www.srigujaratividhyalaya.com/wp-content/themes/gujarati/images/gujarati-school.jpg",
  a1: "https://www.srigujaratividhyalaya.com/wp-content/themes/gujarati/images/progrm.jpg",
  a2: "https://www.srigujaratividhyalaya.com/wp-content/uploads/2023/07/4-13-555x472.jpg",
  faculty: "https://www.srigujaratividhyalaya.com/wp-content/themes/gujarati/images/Faculty_.jpg",
  program: "https://www.srigujaratividhyalaya.com/wp-content/themes/gujarati/images/progrm.jpg",
  principal: "https://www.srigujaratividhyalaya.com/wp-content/uploads/2023/05/vimala-jayaraj.jpg",
  n1: "https://www.srigujaratividhyalaya.com/wp-content/uploads/2023/05/n1.jpg",
  n2: "https://www.srigujaratividhyalaya.com/wp-content/uploads/2023/05/n2.jpg",
  news_plusone:
    "https://www.srigujaratividhyalaya.com/wp-content/uploads/2024/06/plusone-555x555.jpeg",
  news1: "https://www.srigujaratividhyalaya.com/wp-content/uploads/2023/05/news1-555x472.jpg",
  news_mla: "https://www.srigujaratividhyalaya.com/wp-content/uploads/2023/07/1-31-555x472.jpg",
  news_yoga: "https://www.srigujaratividhyalaya.com/wp-content/uploads/2023/07/4-13-555x472.jpg",
  news_ocean: "https://www.srigujaratividhyalaya.com/wp-content/uploads/2023/07/3-18-555x472.jpg",
  news_env: "https://www.srigujaratividhyalaya.com/wp-content/uploads/2023/07/2-21-555x472.jpg",
} as const;
