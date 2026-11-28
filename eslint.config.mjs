import next from 'eslint-config-next/core-web-vitals';

// `.kilo/worktrees` contains separate git worktrees of this repository, not
// part of the application source. Linting them duplicates the project's own
// results (and their .git/info/exclude is not honoured by ESLint).
const config = [
  {
    ignores: ['.kilo/**'],
  },
  ...next,
];

export default config;
