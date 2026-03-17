import type { Config } from 'release-it';

const config: Config = {
  git: {
    commit: true,
    commitMessage: 'chore(release): v${version}',
    tag: true,
    tagName: 'v${version}',
    push: true,
    requireCleanWorkingDir: true,
    requireBranch: ['main'],
  },
  github: {
    release: true,
  },
  npm: {
    publish: false,
  },
  plugins: {
    '@release-it/conventional-changelog': {
      infile: 'CHANGELOG.md',
      preset: {
        name: 'conventionalcommits',
      },
    },
  },
};

export default config;
