/**
 * 굿프랜드유아체육연구소 & 이벤트 — 홈페이지 문의 접수
 *
 * 하는 일
 *   1) 홈페이지 문의 폼이 보낸 내용을 구글 시트에 한 줄로 쌓는다
 *   2) 대표님 메일로 알림을 보낸다
 *
 * 배포 방법 (형님이 직접 하셔야 합니다 — 구글 계정이 필요)
 *   1. script.google.com → 새 프로젝트 → 이 코드를 통째로 붙여넣기
 *   2. 프로젝트 이름: 굿프랜드-문의
 *   3. 왼쪽 톱니(프로젝트 설정) → 스크립트 속성에 아래 2개 추가
 *        SHEET_ID   : 접수 내용을 쌓을 구글 시트 주소의 가운데 긴 문자열
 *        NOTIFY_TO  : 알림 받을 메일 주소 (예: goodfriend4769@naver.com)
 *   4. 저장 → 배포 → 새 배포 → 유형 「웹 앱」
 *        실행 사용자 : 나
 *        액세스 권한 : 【모든 사용자】   ← 꼭 이것. 「구글 계정이 있는 모든 사용자」는 403 납니다
 *   5. 배포하면 나오는 /exec 로 끝나는 주소를 클대리에게 알려주세요
 *   6. 나중에 코드를 고치면 「새 배포」가 아니라
 *        배포 관리 → 연필(수정) → 버전: 새 버전 → 배포
 *      로 해야 주소가 안 바뀝니다
 */

var 시트이름 = '문의';

function doPost(e) {
  try {
    var 내용 = JSON.parse(e.postData.contents);
    저장(내용);
    알림(내용);
    return 응답({ ok: true });
  } catch (err) {
    console.error(err);
    return 응답({ ok: false, error: String(err) });
  }
}

/** 브라우저에서 주소를 바로 열었을 때 (살아있는지 확인용) */
function doGet() {
  return 응답({ ok: true, msg: '굿프랜드 문의 접수 서버입니다.' });
}

function 응답(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function 저장(내용) {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) return;

  var ss = SpreadsheetApp.openById(id);
  var sh = ss.getSheetByName(시트이름);
  if (!sh) {
    sh = ss.insertSheet(시트이름);
    sh.appendRow([
      '접수시각', '기관·단체명', '담당자', '연락처', '행사종류',
      '희망날짜', '장소', '예상인원', '유입경로', '남긴말씀', '페이지'
    ]);
    sh.setFrozenRows(1);
  }

  sh.appendRow([
    new Date(),
    내용.org || '', 내용.name || '', 내용.phone || '', 내용.kind || '',
    내용.date || '', 내용.place || '', 내용.people || '', 내용.from || '',
    내용.memo || '', 내용.page || ''
  ]);
}

function 알림(내용) {
  var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_TO');
  if (!to) return;

  var 줄 = [
    ['기관·단체명', 내용.org],
    ['담당자', 내용.name],
    ['연락처', 내용.phone],
    ['행사 종류', 내용.kind],
    ['희망 날짜', 내용.date],
    ['장소', 내용.place],
    ['예상 인원', 내용.people],
    ['유입 경로', 내용.from],
    ['남긴 말씀', 내용.memo]
  ];

  var 본문 = '홈페이지로 행사 문의가 들어왔습니다.\n\n';
  줄.forEach(function (r) {
    if (r[1]) 본문 += r[0] + ' : ' + r[1] + '\n';
  });
  본문 += '\n접수 시각 : ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  본문 += '\n바로 전화 : ' + (내용.phone || '-');

  MailApp.sendEmail({
    to: to,
    subject: '[굿프랜드 문의] ' + (내용.org || '기관명 없음') + ' · ' + (내용.kind || ''),
    body: 본문
  });
}

/** 배포 전에 이걸 한 번 실행해 보면 시트와 메일이 되는지 확인됩니다 */
function 시험() {
  var 샘플 = {
    org: '시험 유치원', name: '홍길동', phone: '010-0000-0000',
    kind: '운동회 · 체육대회', date: '2026-10-20', place: '광양 ○○체육관 (실내)',
    people: '100명', from: '네이버 검색', memo: '[시험] 접수 시험입니다.',
    page: '/'
  };
  저장(샘플);
  알림(샘플);
}
