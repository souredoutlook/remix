import { test, expect } from "@playwright/test";

import {
  createAppFixture,
  createFixture,
  js,
  css,
} from "./helpers/create-fixture.js";
import type { Fixture, AppFixture } from "./helpers/create-fixture.js";
import { PlaywrightFixture } from "./helpers/playwright-fixture.js";

const TEST_PADDING_VALUE = "20px";

test.describe("Vite CSS build", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;

  test.beforeAll(async () => {
    fixture = await createFixture({
      compiler: "vite",
      files: {
        "remix.config.js": js`
          throw new Error("Remix should not access remix.config.js when using Vite");
          export default {};
        `,
        "vite.config.ts": js`
          import { defineConfig } from "vite";
          import { unstable_vitePlugin as remix } from "@remix-run/dev";

          export default defineConfig({
            plugins: [remix()],
          });
        `,

        "app/components/SharedCssTest/BundledStyles/BundledStyles.tsx": js`
          import "./BundledStyles.css";
          
          export const BundledStyles = ({ children }) => {
            return <div data-css-bundled className="BundledStyles">{children}</div>;
          }
        `,
        "app/components/SharedCssTest/BundledStyles/BundledStyles.css": css`
          .BundledStyles {
            background: papayawhip;
            padding: ${TEST_PADDING_VALUE};
          }
        `,

        "app/components/SharedCssTest/LinkedStyles/LinkedStyles.tsx": js`
          import href from "./LinkedStyles.css?url";
          
          export const links = [{ rel: "stylesheet", href }];

          export const LinkedStyles = ({ children }) => {
            return <div data-css-linked className="LinkedStyles">{children}</div>;
          }
        `,
        "app/components/SharedCssTest/LinkedStyles/LinkedStyles.css": css`
          .LinkedStyles {
            background: salmon;
            padding: ${TEST_PADDING_VALUE};
          }
        `,

        "app/components/SharedCssTest/CssModuleStyles/CssModuleStyles.tsx": js`
          import styles from "./CssModuleStyles.module.css";
          
          export const CssModuleStyles = ({ children }) => {
            return <div data-css-modules className={styles.CssModuleStyles}>{children}</div>;
          }
        `,
        "app/components/SharedCssTest/CssModuleStyles/CssModuleStyles.module.css": css`
          .CssModuleStyles {
            background: peachpuff;
            padding: ${TEST_PADDING_VALUE};
          }
        `,

        "app/components/SharedCssTest/SharedCssTest.tsx": js`
          import { BundledStyles } from "./BundledStyles/BundledStyles";
          import { LinkedStyles, links as linkedStylesLinks } from "./LinkedStyles/LinkedStyles";
          import { CssModuleStyles } from "./CssModuleStyles/CssModuleStyles";

          export const links = linkedStylesLinks;

          export const SharedCssTest = ({ routeName }) => {
            if (!routeName) throw new Error("routeName prop is required on SharedCssTest");

            return (
              <CssModuleStyles>
                <LinkedStyles>
                  <BundledStyles>
                    <h2>Shared CSS Test (Used in "{routeName}" route)</h2>
                  </BundledStyles>
                </LinkedStyles>
              </CssModuleStyles>
            );
          }
        `,

        "app/root.tsx": js`
          import { Links, Meta, Outlet, Scripts } from "@remix-run/react";
          import { SharedCssTest, links as sharedCssTestLinks } from "./components/SharedCssTest/SharedCssTest";
          
          export function links() {
            return sharedCssTestLinks;
          }
          
          export default function Root() {
            return (
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <div id="root">
                    <SharedCssTest routeName="root" />
                  </div>
                  <Outlet />
                  <Scripts />
                </body>
              </html>
            );
          }
        `,
        "app/routes/_index/route.tsx": js`
          import { SharedCssTest, links as sharedCssTestLinks } from "../../components/SharedCssTest/SharedCssTest";

          export function links() {
            return sharedCssTestLinks;
          }

          export default function IndexRoute() {
            return (
              <div id="index">
                <SharedCssTest routeName="index" />
              </div>
            );
          }
        `,
      },
    });

    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(() => {
    appFixture.close();
  });

  test("renders styles", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    await expect(page.locator("#root [data-css-modules]")).toHaveCSS(
      "padding",
      TEST_PADDING_VALUE
    );
    await expect(page.locator("#root [data-css-linked]")).toHaveCSS(
      "padding",
      TEST_PADDING_VALUE
    );
    await expect(page.locator("#root [data-css-bundled]")).toHaveCSS(
      "padding",
      TEST_PADDING_VALUE
    );

    await expect(page.locator("#index [data-css-modules]")).toHaveCSS(
      "padding",
      TEST_PADDING_VALUE
    );
    await expect(page.locator("#index [data-css-linked]")).toHaveCSS(
      "padding",
      TEST_PADDING_VALUE
    );
    await expect(page.locator("#index [data-css-bundled]")).toHaveCSS(
      "padding",
      TEST_PADDING_VALUE
    );
  });
});
