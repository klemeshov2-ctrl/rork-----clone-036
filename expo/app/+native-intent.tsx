export function redirectSystemPath({
  _path,
  _initial,
}: { _path: string; _initial: boolean }): string {
  if (!_initial && _path && _path.includes('auth')) {
    return '';
  }
  return '/';
}
