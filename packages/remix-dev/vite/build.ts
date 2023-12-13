import type * as Vite from "vite";
import path from "node:path";
import colors from "picocolors";

import type {
  ResolvedRemixVitePluginConfig,
  ServerBuildConfig,
} from "./plugin";
import type { ConfigRoute, RouteManifest } from "../config/routes";
import invariant from "../invariant";

async function extractRemixPluginConfig({
  configFile,
  mode,
  root,
}: {
  configFile?: string;
  mode?: string;
  root: string;
}): Promise<ResolvedRemixVitePluginConfig> {
  let vite = await import("vite");

  // Leverage the Vite config as a way to configure the entire multi-step build
  // process so we don't need to have a separate Remix config
  let viteConfig = await vite.resolveConfig(
    { mode, configFile, root },
    "build"
  );

  let pluginConfig = viteConfig[
    "__remixPluginResolvedConfig" as keyof typeof viteConfig
  ] as ResolvedRemixVitePluginConfig | undefined;
  if (!pluginConfig) {
    console.error(colors.red("Remix Vite plugin not found in Vite config"));
    process.exit(1);
  }

  return pluginConfig;
}

function getLeafRoutes(routes: RouteManifest): ConfigRoute[] {
  let parentIds = new Set<string>();
  for (let id in routes) {
    let { parentId } = routes[id];
    if (typeof parentId === "string") {
      parentIds.add(parentId);
    }
  }

  let leafRoutes = [];
  for (let id in routes) {
    if (!parentIds.has(id)) {
      leafRoutes.push(routes[id]);
    }
  }

  return leafRoutes;
}

function getRouteMatches(routes: RouteManifest, routeId: string) {
  let result: ConfigRoute[] = [];
  let currentRouteId: string | undefined = routeId;

  while (currentRouteId) {
    invariant(routes[currentRouteId], `Missing route for ${currentRouteId}`);
    result.push(routes[currentRouteId]);
    currentRouteId = routes[currentRouteId].parentId;
  }

  return result.reverse();
}

function computeServerBuilds({
  routes,
  serverBuildDirectory,
  serverBundleDirectory,
}: ResolvedRemixVitePluginConfig): ServerBuildConfig[] {
  if (!serverBundleDirectory) {
    return [{ routes, serverBuildDirectory }];
  }

  let serverBuilds = new Map<string, ServerBuildConfig>();

  for (let route of getLeafRoutes(routes)) {
    let matches = getRouteMatches(routes, route.id);
    let directory = path.join(
      serverBuildDirectory,
      serverBundleDirectory({ route, matches })
    );

    let serverBuild = serverBuilds.get(directory);

    if (!serverBuild) {
      serverBuild = { routes: {}, serverBuildDirectory: directory };
      serverBuilds.set(directory, serverBuild);
    }

    for (let match of matches) {
      serverBuild.routes[match.id] = match;
    }
  }

  return Array.from(serverBuilds.values());
}

export interface ViteBuildOptions {
  assetsInlineLimit?: number;
  clearScreen?: boolean;
  config?: string;
  emptyOutDir?: boolean;
  force?: boolean;
  logLevel?: Vite.LogLevel;
  minify?: Vite.BuildOptions["minify"];
  mode?: string;
}

export async function build(
  root: string,
  {
    assetsInlineLimit,
    clearScreen,
    config: configFile,
    emptyOutDir,
    force,
    logLevel,
    minify,
    mode,
  }: ViteBuildOptions
) {
  let pluginConfig = await extractRemixPluginConfig({ configFile, mode, root });

  let vite = await import("vite");

  async function viteBuild(serverBuildConfig?: ServerBuildConfig) {
    let ssr = Boolean(serverBuildConfig);
    await vite.build({
      root,
      mode,
      configFile,
      build: { assetsInlineLimit, emptyOutDir, minify, ssr },
      optimizeDeps: { force },
      clearScreen,
      logLevel,
      ...(serverBuildConfig
        ? { __remixServerBuildConfig: serverBuildConfig }
        : {}),
    });
  }

  // Client build
  await viteBuild();

  let serverBuilds = computeServerBuilds(pluginConfig);
  await Promise.all(serverBuilds.map(viteBuild));
}
