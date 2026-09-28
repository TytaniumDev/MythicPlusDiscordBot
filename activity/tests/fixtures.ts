import { test as base } from '@playwright/test';
import { stallFirestore } from './helpers/firestore';
import { mockCharacterRenders } from './helpers/renders';

export { expect } from '@playwright/test';

// Every spec imports `test` from here so external services are stubbed on
// every page without each test having to opt in.
export const test = base.extend<{ externalServices: void }>({
  externalServices: [
    async ({ page }, use) => {
      await stallFirestore(page);
      await mockCharacterRenders(page);
      await use();
    },
    { auto: true },
  ],
});
