// Skills shown in the About Me section.
// `iconUrl` points to an SVG in /public/SVG (raw URL, no Astro import needed because they're static).
// `techUrl` is the external link to the technology's site (opens in a new tab).

export type Skill = {
  name: string;
  iconUrl: string;
  techUrl: string;
};

export const skills: Skill[] = [
  {
    name: 'React',
    iconUrl: '/SVG/react.svg',
    techUrl: 'https://react.dev',
  },
  {
    name: 'TypeScript',
    iconUrl: '/SVG/typescript.svg',
    techUrl: 'https://www.typescriptlang.org',
  },
  {
    name: 'Three.js',
    iconUrl: '/SVG/threejs.svg',
    techUrl: 'https://threejs.org',
  },
  {
    name: 'JavaScript',
    iconUrl: '/SVG/javascript.svg',
    techUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
  },
  {
    name: 'Python',
    iconUrl: '/SVG/python.svg',
    techUrl: 'https://www.python.org',
  },
  {
    name: 'Tailwind',
    iconUrl: '/SVG/tailwind.svg',
    techUrl: 'https://tailwindcss.com',
  },
  {
    name: 'FastAPI',
    iconUrl: '/SVG/fastapi.svg',
    techUrl: 'https://fastapi.tiangolo.com',
  },
  {
    name: 'Django',
    iconUrl: '/SVG/django.svg',
    techUrl: 'https://www.djangoproject.com',
  },
  {
    name: 'Flask',
    iconUrl: '/SVG/flask-light.svg',
    techUrl: 'https://flask.palletsprojects.com',
  },
  {
    name: 'Git',
    iconUrl: '/SVG/git.svg',
    techUrl: 'https://git-scm.com',
  },
  {
    name: 'GitHub',
    iconUrl: '/SVG/github.svg',
    techUrl: 'https://github.com',
  },
  {
    name: 'PostgreSQL',
    iconUrl: '/SVG/postgresql.svg',
    techUrl: 'https://www.postgresql.org',
  },
  {
    name: 'SQLite',
    iconUrl: '/SVG/sqlite.svg',
    techUrl: 'https://www.sqlite.org',
  },
  {
    name: 'Firebase',
    iconUrl: '/SVG/firebase.svg',
    techUrl: 'https://firebase.google.com',
  },
  {
    name: 'Vite',
    iconUrl: '/SVG/vitejs.svg',
    techUrl: 'https://vitejs.dev',
  },
  {
    name: 'HTML5',
    iconUrl: '/SVG/html5.svg',
    techUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML',
  },
  {
    name: 'CSS',
    iconUrl: '/SVG/css.svg',
    techUrl: 'https://developer.mozilla.org/en-US/docs/Web/CSS',
  },
  {
    name: 'Bootstrap',
    iconUrl: '/SVG/bootstrap.svg',
    techUrl: 'https://getbootstrap.com',
  },
];
