import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../components/**/*.stories.@(ts|tsx)', '../src/**/*.stories.@(ts|tsx)'],
  // NOTE: @storybook/addon-a11y removed — it's v10 but the project pins
  // storybook core to 8.6.x, causing "Could not resolve storybook/manager-api"
  // at build. Re-add once versions are aligned to 10.x (FE-2 follow-up).
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
  docs: {
    autodocs: 'tag',
  },
};

export default config;
