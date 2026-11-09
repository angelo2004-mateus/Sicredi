export function canAccessPage(user, pathname) {
  if (!pathname?.startsWith("/") || pathname.startsWith("//")) return false;

  const internal = !user.partner_id;
  const canReadWeighings = internal || user.permissions.read_partner_weighings;

  if (pathname === "/pesagens/nova") return user.permissions.create_weighing;
  if (pathname.startsWith("/pesagens")) return canReadWeighings;
  if (pathname.startsWith("/relatorios")) return canReadWeighings;
  if (pathname.startsWith("/parceiros")) return user.permissions.read_partners;
  if (pathname.startsWith("/usuarios")) return user.permissions.manage_users;
  if (
    ["/agencias", "/residuos", "/tipos-parceiros"].some((path) =>
      pathname.startsWith(path),
    )
  )
    return internal;

  return true;
}
