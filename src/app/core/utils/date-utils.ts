export function toDateValue(val: any): Date | undefined {
  if (val === undefined || val === null) return undefined;
  if (val instanceof Date) return val;
  if (val && typeof val.toDate === 'function') {
    try { return val.toDate(); } catch (e) { /* fallthrough */ }
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d;
  }
  if (val && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000));
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}
