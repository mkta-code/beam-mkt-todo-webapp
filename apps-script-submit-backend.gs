const SPREADSHEET_ID = '1EncNnZvlN-ngAEYUlsdgDlcNHK4JJPAffiWzIUQt8CQ';

function doGet(e) {
  const action = e.parameter.action || '';
  const callback = e.parameter.callback || '';

  let result;

  try {
    if (action === 'addMkt') {
      result = addMktTask_(e.parameter);
    } else if (action === 'loadMkt') {
      result = loadMktTasks_();
    } else {
      result = { ok: false, error: 'ไม่รู้จัก action นี้' };
    }
  } catch (error) {
    result = { ok: false, error: String(error && error.message ? error.message : error) };
  }

  const output = callback
    ? `${callback}(${JSON.stringify(result)})`
    : JSON.stringify(result);

  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function addMktTask_(p) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const targetTab = p.targetTab || 'Inbox';
  const sheet = ss.getSheetByName(targetTab);

  if (!sheet) throw new Error(`ไม่เจอแท็บ ${targetTab}`);
  if (!p.title) throw new Error('ยังไม่ได้ใส่ชื่องาน');

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const row = new Array(lastCol).fill('');
  const date = parseDateFromWeb_(p.date) || new Date();
  const id = createReadableId_(sheet, targetTab);

  setFirstMatch_(row, headers, ['Source ID', 'ID', 'Follow ID', 'Project ID', 'Clip ID', 'Blog ID', 'Inbox ID'], id);
  setFirstMatch_(row, headers, ['งานวันนี้', 'งาน', 'ชื่องาน', 'ชื่อ Project', 'Project', 'หัวข้อคลิป', 'หัวข้อ Blog', 'หัวข้อ', 'เรื่อง'], p.title);
  setFirstMatch_(row, headers, ['วันที่ต้องทำ', 'วันที่ต้องตาม', 'Deadline', 'Due Date', 'Post Date', 'วันที่โพสต์', 'วันที่'], date);
  setFirstMatch_(row, headers, ['ประเภท', 'Stage', 'Content Pillar', 'หมวดหมู่'], p.type || '');
  setFirstMatch_(row, headers, ['คน/ทีม', 'Owner', 'ผู้รับผิดชอบ'], p.owner || '');
  setFirstMatch_(row, headers, ['ช่องทาง', 'Channel'], p.channel || '');
  setFirstMatch_(row, headers, ['Priority'], p.priority || '');
  setFirstMatch_(row, headers, ['Status'], p.status || 'Not Started');
  setFirstMatch_(row, headers, ['Action/Link', 'Link', 'URL'], p.link || '');
  setFirstMatch_(row, headers, ['หมายเหตุ', 'Note'], p.note || '');
  setFirstMatch_(row, headers, ['ต้องทำ'], 'ต้องทำ');

  if (targetTab === 'งานคลิป') {
    setFirstMatch_(row, headers, ['Script Status', 'Shoot Status', 'Edit Status', 'Post Status'], p.status || 'Not Started');
  }

  sheet.appendRow(row);
  formatLastRowDates_(sheet, sheet.getLastRow(), headers);

  return { ok: true, id: id, tab: targetTab };
}

function loadMktTasks_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('To do วันนี้');

  if (!sheet) throw new Error('ไม่เจอแท็บ To do วันนี้');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, tasks: [] };

  const values = sheet.getRange(2, 1, lastRow - 1, 11).getDisplayValues();
  const tasks = values
    .filter(function (r) { return r[0] || r[2]; })
    .map(function (r) {
      return {
        id: r[0],
        date: r[1],
        title: r[2],
        type: r[3],
        owner: r[4],
        channel: r[5],
        priority: r[6],
        status: r[7],
        source: r[8],
        link: r[9],
        note: r[10],
      };
    });

  return { ok: true, tasks: tasks };
}

function setFirstMatch_(row, headers, names, value) {
  for (let i = 0; i < names.length; i++) {
    const index = headers.indexOf(names[i]);
    if (index !== -1) {
      row[index] = value;
      return true;
    }
  }
  return false;
}

function createReadableId_(sheet, targetTab) {
  const prefixMap = {
    'ตามงาน': 'FL',
    'Project': 'PJ',
    'งานคลิป': 'CL',
    'งาน Blog': 'BL',
    'Inbox': 'IN',
  };

  const prefix = prefixMap[targetTab] || 'IN';
  const tz = Session.getScriptTimeZone();
  const dateText = Utilities.formatDate(new Date(), tz, 'dd/MM/yy');
  const idStart = `${prefix}-${dateText}-`;
  const lastRow = sheet.getLastRow();
  let count = 0;

  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    ids.forEach(function (r) {
      if (String(r[0]).indexOf(idStart) === 0) count++;
    });
  }

  return `${idStart}${String(count + 1).padStart(3, '0')}`;
}

function parseDateFromWeb_(value) {
  if (!value) return null;

  const parts = String(value).split('-');
  if (parts.length !== 3) return null;

  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function formatLastRowDates_(sheet, rowNumber, headers) {
  const dateHeaders = ['วันที่ต้องทำ', 'วันที่ต้องตาม', 'Deadline', 'Due Date', 'Post Date', 'วันที่โพสต์', 'วันที่'];

  dateHeaders.forEach(function (headerName) {
    const index = headers.indexOf(headerName);
    if (index !== -1) {
      sheet.getRange(rowNumber, index + 1).setNumberFormat('dd/mm/yyyy');
    }
  });
}
