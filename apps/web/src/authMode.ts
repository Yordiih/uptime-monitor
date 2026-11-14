// "/login?mode=register" opens the registration form directly
export function authModeFromSearch(search: string): "login" | "register" {
  return new URLSearchParams(search).get("mode") === "register" ? "register" : "login";
}
