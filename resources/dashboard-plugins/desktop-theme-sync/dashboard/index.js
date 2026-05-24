(function() {
  "use strict";

  var DESKTOP_THEME_MAP = {
    claude: "claude",
    apple:  "apple",
    warp:   "warp",
  };

  function setDashboardTheme(name) {
    var sdk = window.__HERMES_PLUGIN_SDK__;
    if (sdk && sdk.api && typeof sdk.api.setTheme === "function") {
      sdk.api.setTheme(name).catch(function() {});
      return;
    }

    var basePath = window.__HERMES_BASE_PATH__ || "";
    var token = window.__HERMES_SESSION_TOKEN__ || "";
    fetch(basePath + "/api/dashboard/theme", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Hermes-Session-Token": token,
      },
      body: JSON.stringify({ name: name }),
    }).catch(function() {});
  }

  window.addEventListener("message", function(event) {
    if (!event.data || event.data.type !== "hermes-theme-sync") return;

    var themeName = event.data.dashboardTheme || DESKTOP_THEME_MAP[event.data.desktopTheme];
    if (!themeName) return;

    setDashboardTheme(themeName);
  });

  // Register a minimal component so the plugin system considers us loaded.
  if (window.__HERMES_PLUGINS__ && typeof window.__HERMES_PLUGINS__.register === "function") {
    window.__HERMES_PLUGINS__.register("desktop-theme-sync", function() { return null; });
  }
})();
