import assert from 'node:assert/strict';
import { parseNotices } from '../lib/school-notices.ts';
assert.deepEqual(parseNotices('<a href="#" onclick="article.view(\'123\')"><strong>공지 &amp; 안내</strong></a>', 'pcu'), [{id:'123',title:'공지 & 안내',url:'https://www.pcu.ac.kr/kor/article/Notify_1/123'}]);
const kmu='<a href="https://www.kmu.ac.kr/uni/main/page.jsp?parm_bod_uid=42&amp;mnu_uid=144">학사 공지</a>';
assert.equal(parseNotices(kmu+kmu,'kmu').length,1);
assert.equal(parseNotices('<a href="https://evil.test/?parm_bod_uid=42">위조 링크</a>','kmu').length,0);
assert.equal(parseNotices('<a href="javascript:alert(1)">악성 링크</a>','kmu').length,0);
assert.deepEqual(parseNotices('<h1>점검 중</h1>','pcu'),[]);
console.log('Notice parser checks passed: extraction, decoding, duplicates, foreign URL and malformed HTML.');
