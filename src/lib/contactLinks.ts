// Contact links rendered as an infinite horizontal marquee in the Contact section.
// `iconSvg` is the inline SVG markup (string) used inside the card. Using inline
// SVG keeps everything self-contained and lets us color the icons via `currentColor`.

export type ContactLink = {
  label: string;
  href: string;
  iconSvg: string;
};

const githubIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M12 .5C5.73.5.78 5.45.78 11.72c0 4.96 3.22 9.16 7.69 10.65.56.1.77-.24.77-.54v-1.9c-3.13.68-3.79-1.51-3.79-1.51-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.42.11-2.97 0 0 .94-.3 3.09 1.15.9-.25 1.86-.37 2.81-.38.95.01 1.91.13 2.81.38 2.15-1.45 3.09-1.15 3.09-1.15.61 1.55.23 2.69.11 2.97.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.28-5.14 5.55.4.35.76 1.03.76 2.08v3.08c0 .3.21.65.78.54 4.46-1.49 7.68-5.69 7.68-10.65C23.22 5.45 18.27.5 12 .5Z"/>
</svg>`;

const linkedinIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z"/>
</svg>`;

const emailIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M12 13.06 22.4 4H1.6L12 13.06Zm0 2.94L0 6.25V20h24V6.25L12 16Z"/>
</svg>`;

const twitterIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M18.244 2H21.5l-7.5 8.57L22.5 22h-6.93l-5.43-7.13L3.9 22H.64l8.04-9.19L1 2h7.1l4.9 6.45L18.24 2Zm-1.22 18h1.92L7.06 4H5.02l11.99 16Z"/>
</svg>`;

export const contactLinks: ContactLink[] = [
  {
    label: 'GitHub',
    href: 'https://github.com/jjhbotache',
    iconSvg: githubIcon,
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/jjhbotache',
    iconSvg: linkedinIcon,
  },
  {
    label: 'Email',
    href: 'mailto:contact@example.com',
    iconSvg: emailIcon,
  },
  {
    label: 'X (Twitter)',
    href: 'https://x.com/jjhbotache',
    iconSvg: twitterIcon,
  },
];
