/** How a role is named on screen: Administrator → Admin, Instructor → Recruiter, Account Manager / Manager → Manager. Others keep their name. */
export function roleLabel(name: string): string {
  if (/^(admin|administrator)$/i.test(name)) return 'Admin';
  if (/^instructor$/i.test(name)) return 'Recruiter';
  if (/^(account )?manager$/i.test(name)) return 'Manager';
  return name;
}

/** The roles an account can be given: Admin, Recruiter and Manager, one entry each (an exact "Manager" wins over "Account Manager"). */
export function assignableRoles<T extends { name: string }>(roles: T[] | undefined): T[] {
  const pick = (test: RegExp) => (roles ?? []).find((role) => test.test(role.name));
  return [pick(/^administrator$/i) ?? pick(/^admin$/i), pick(/^instructor$/i), pick(/^manager$/i) ?? pick(/^account manager$/i)].filter((role): role is T => Boolean(role));
}
