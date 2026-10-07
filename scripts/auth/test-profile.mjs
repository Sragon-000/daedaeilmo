import assert from 'node:assert/strict';
import { parseSchoolUser, schoolProfileFromUser } from '../../lib/school-profile.ts';
const user = { USER_NM: '테스트학생', USER_ID: '20260001' };
for (const html of [
  `var gv_sessionUser = ${JSON.stringify(user)};`,
  `var gv_sessionUser = ${JSON.stringify(JSON.stringify(user))};`,
  `var gv_sessionUser = '${JSON.stringify(user)}';`,
  `var gv_sessionUser = JSON.parse(${JSON.stringify(JSON.stringify(user))});`,
  `var gv_sessionUser = null; gv_sessionUser = JSON.parse(${JSON.stringify(JSON.stringify(user))});`,
  `var gv_sessionUser = decodeURIComponent('${encodeURIComponent(JSON.stringify(user))}');`,
  `var gv_sessionUser = JSON.parse(atob('${Buffer.from(JSON.stringify(user)).toString('base64')}'));`,
]) {
  assert.deepEqual(schoolProfileFromUser(parseSchoolUser(html)), { name: '테스트학생', studentId: '20260001' });
}
assert.equal(parseSchoolUser('var gv_sessionUser = runArbitraryCode();'), null);
assert.equal(schoolProfileFromUser({ USER_NM: '<script>', USER_ID: '1234' }), null);
assert.equal(schoolProfileFromUser({ USER_NM: '학생' }), null);
assert.equal(schoolProfileFromUser(null), null);
console.log('Passed: profile decoding without JavaScript execution, required school fields, unsafe-value rejection.');
