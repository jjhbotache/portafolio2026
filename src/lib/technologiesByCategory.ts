// Technology catalogue grouped into the three marquees shown in the About Me section.
// `fullstack` and `others` are merged into a single "others" track because the
// section only renders three rows (front / back / others).
export type Technology = {
  name: string;
  svgUrl: string;
  technologyLink: string;
};

export type TechnologyCategory = {
  id: 'front' | 'back' | 'others';
  items: Technology[];
};

const front: Technology[] = [
  { name: 'JavaScript', svgUrl: '/SVG/javascript.svg', technologyLink: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' },
  { name: 'React', svgUrl: '/SVG/react.svg', technologyLink: 'https://react.dev' },
  { name: 'React Native', svgUrl: '/SVG/react native.svg', technologyLink: 'https://reactnative.dev' },
  { name: 'Redux Toolkit', svgUrl: '/SVG/redux.svg', technologyLink: 'https://redux.js.org' },
  { name: 'Styled Components', svgUrl: '/SVG/styledcomponents.svg', technologyLink: 'https://styled-components.com' },
  { name: 'React Router', svgUrl: '/SVG/reactrouter.svg', technologyLink: 'https://reactrouter.com' },
  { name: 'Framer Motion', svgUrl: '/SVG/framer.svg', technologyLink: 'https://www.framer.com/motion' },
  { name: 'Bootstrap', svgUrl: '/SVG/bootstrap.svg', technologyLink: 'https://getbootstrap.com' },
  { name: 'Expo', svgUrl: '/SVG/expo.svg', technologyLink: 'https://expo.io' },
  { name: 'Recharts', svgUrl: '/SVG/recharts.svg', technologyLink: 'https://recharts.org' },
  { name: 'Vite', svgUrl: '/SVG/vitejs.svg', technologyLink: 'https://vitejs.dev' },
  { name: 'TypeScript', svgUrl: '/SVG/typescript.svg', technologyLink: 'https://www.typescriptlang.org' },
  { name: 'Three.js', svgUrl: '/SVG/threejs.svg', technologyLink: 'https://threejs.org' },
  { name: 'React Native Elements', svgUrl: '/SVG/RNE.svg', technologyLink: 'https://reactnativeelements.com' },
  { name: 'Tailwind CSS', svgUrl: '/SVG/tailwind.svg', technologyLink: 'https://tailwindcss.com' },
];

const back: Technology[] = [
  { name: 'Firebase', svgUrl: '/SVG/firebase.svg', technologyLink: 'https://firebase.google.com' },
  { name: 'Python', svgUrl: '/SVG/python.svg', technologyLink: 'https://www.python.org' },
  { name: 'Flask', svgUrl: '/SVG/flask-light.svg', technologyLink: 'https://flask.palletsprojects.com' },
  { name: 'FastAPI', svgUrl: '/SVG/fastapi.svg', technologyLink: 'https://fastapi.tiangolo.com' },
  { name: 'phpMyAdmin', svgUrl: '/SVG/phpMyAdmin.svg', technologyLink: 'https://www.phpmyadmin.net' },
  { name: 'SQLite', svgUrl: '/SVG/sqlite.svg', technologyLink: 'https://www.sqlite.org' },
  { name: 'AWS Cognito', svgUrl: '/SVG/logos--aws-cognito.svg', technologyLink: 'https://aws.amazon.com/cognito' },
  { name: 'Beautiful Soup', svgUrl: '/SVG/beautiful soup.svg', technologyLink: 'https://www.crummy.com/software/BeautifulSoup' },
  { name: 'PyWebView', svgUrl: '/SVG/pywebview.svg', technologyLink: 'https://pywebview.flowrl.com' },
  { name: 'Selenium', svgUrl: '/SVG/selenium.svg', technologyLink: 'https://selenium-python.readthedocs.io' },
  { name: 'PostgreSQL', svgUrl: '/SVG/postgresql.svg', technologyLink: 'https://www.postgresql.org' },
];

const others: Technology[] = [
  { name: 'Django', svgUrl: '/SVG/django.svg', technologyLink: 'https://www.djangoproject.com' },
  { name: 'Git', svgUrl: '/SVG/git.svg', technologyLink: 'https://git-scm.com' },
  { name: 'GitHub', svgUrl: '/SVG/github.svg', technologyLink: 'https://github.com' },
  { name: 'GCP', svgUrl: '/SVG/google.svg', technologyLink: 'https://cloud.google.com' },
  { name: 'JWT', svgUrl: '/SVG/jwt.svg', technologyLink: 'https://jwt.io' },
  { name: 'PayPal', svgUrl: '/SVG/logos--paypal.svg', technologyLink: 'https://www.paypal.com' },
  { name: 'Cloudinary', svgUrl: '/SVG/cloudinary.svg', technologyLink: 'https://cloudinary.com' },
  { name: 'Copilot', svgUrl: '/SVG/copilot.svg', technologyLink: 'https://github.com/features/copilot' },
  { name: 'Google Gemini', svgUrl: '/SVG/gemini.svg', technologyLink: 'https://ai.google.dev/gemini-api' },
];

export const technologyCategories: readonly TechnologyCategory[] = [
  { id: 'front', items: front },
  { id: 'back', items: back },
  { id: 'others', items: others },
];