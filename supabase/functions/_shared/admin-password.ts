const LOCAL_ADMIN_PASSWORD = "admin-local-123";

const isLocalSupabase = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  return (
    supabaseUrl.includes("://kong:") ||
    supabaseUrl.includes("://localhost") ||
    supabaseUrl.includes("://127.0.0.1")
  );
};

export const getAdminPassword = () => {
  const configuredPassword = Deno.env.get("ADMIN_PASSWORD");
  if (configuredPassword) return configuredPassword;
  return isLocalSupabase() ? LOCAL_ADMIN_PASSWORD : "";
};

export const isValidAdminPassword = (password: unknown) =>
  typeof password === "string" &&
  password.length > 0 &&
  password === getAdminPassword();
