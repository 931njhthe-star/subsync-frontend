// Supabase Auth 공개 설정
// 배포 전 아래 두 값을 실제 Supabase 프로젝트 값으로 교체한다.
(function () {
  const root = globalThis;
  const SubSync = (root.__SubSync = root.__SubSync || {});

  const configured = root.__SUBSYNC_AUTH_CONFIG__ && typeof root.__SUBSYNC_AUTH_CONFIG__ === "object"
    ? root.__SUBSYNC_AUTH_CONFIG__
    : {};
  const supabaseUrl = String(configured.supabaseUrl || "https://YOUR_PROJECT_REF.supabase.co");
  const supabasePublishableKey = String(
    configured.supabasePublishableKey || "YOUR_SUPABASE_PUBLISHABLE_KEY"
  );

  function isConfigured() {
    return (
      /^https:\/\/[^/]+$/i.test(supabaseUrl) &&
      !supabaseUrl.includes("YOUR_PROJECT_REF") &&
      Boolean(supabasePublishableKey) &&
      !supabasePublishableKey.includes("YOUR_SUPABASE_PUBLISHABLE_KEY")
    );
  }

  SubSync.authConfig = {
    supabaseUrl,
    supabasePublishableKey,
    oauthRedirectPath: "supabase",
    isConfigured,
    getConfigurationError() {
      return "Supabase URL과 publishable key를 src/services/auth_config.js에 설정해주세요.";
    }
  };

  root.SubSyncAuthConfig = SubSync.authConfig;
})();
