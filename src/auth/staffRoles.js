export const staffRoles = ["admin", "pharmacist", "fulfillment", "customer_support", "delivery_operations"];

export function getRoleNames(user) {
  const roles = user?.staffRoles || user?.roles || [];
  return roles.map((role) => typeof role === "string" ? role : role.code || role.name).filter(Boolean);
}

export function canAccessStaffPortal(user, allowedRoles = staffRoles) {
  return getRoleNames(user).some((role) => allowedRoles.includes(role));
}
