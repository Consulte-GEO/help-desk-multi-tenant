/** Canonical UTC instants shared by API and UI. No Date rounding during comparisons.
 * Existing millisecond strings stay valid; six fractional digits preserve PostgreSQL precision.
 * Deliberately restricted to Gregorian years 0001–9999, UTC Z, and 3 or 6 digits.
 */
export function isCanonicalInstant(value) {
 if(typeof value!=='string'||value.length!==24&&value.length!==27
  ||! /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:\d{3})?Z$/.test(value)) return false;
 const milliseconds=value.slice(0,23)+'Z';
 const time=Date.parse(milliseconds);
 // Reject rollovers (February 30, hour 24, leap seconds), not just an accepted Date.parse.
 return Number.isFinite(time)&&new Date(time).toISOString()===milliseconds;
}
function key(value) {
 if(!isCanonicalInstant(value))throw new TypeError('Invalid canonical instant');
 return value.length===24?value.slice(0,23)+'000Z':value;
}
/** Orders exact instants, so .123Z == .123000Z < .123001Z. */
export function compareInstants(a,b) {
 const left=key(a),right=key(b);
 return left===right?0:left<right?-1:1;
}
/** Normalizes losslessly. Never fabricates microseconds after a Date has truncated them. */
export function canonicalInstant(value) {
 if(value instanceof Date) {
  if(!Number.isFinite(value.getTime()))throw new TypeError('Invalid canonical instant');
  value=value.toISOString();
 }
 if(!isCanonicalInstant(value))throw new TypeError('Invalid canonical instant');
 return value.length===27&&value.slice(23,26)==='000'?value.slice(0,23)+'Z':value;
}
