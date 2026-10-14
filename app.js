// ===== 纯本地版：localStorage 存储 =====
const STORE_KEY = 'hospital_bill_records';
const BROTHERS = ['老大', '老二', '老三'];
const ASSISTANT = '助理';

// ===== 数据操作 =====
function getRecords() {
  const raw = localStorage.getItem(STORE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveRecords(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

function addRecord(record) {
  const list = getRecords();
  list.unshift({
    id: Date.now(),
    date: '',
    amount: 0,
    type: '',
    handler: '',
    remark: '',
    share: true,
    ...record
  });
  saveRecords(list);
}

function deleteRecord(id) {
  const list = getRecords().filter(r => r.id !== id);
  saveRecords(list);
}

function clearAll() {
  if (confirm('确定清空所有记录？此操作不可恢复！')) {
    localStorage.removeItem(STORE_KEY);
    return true;
  }
  return false;
}

// ===== 主页加载 =====
function loadHomeData() {
  const records = getRecords();
  const total = records.reduce((s, r) => s + Number(r.amount || 0), 0);
  const shareTotal = records.filter(r => r.share).reduce((s, r) => s + Number(r.amount || 0), 0);
  const assistantTotal = records.filter(r => !r.share).reduce((s, r) => s + Number(r.amount || 0), 0);

  document.getElementById('totalAmount').textContent = '￥' + total.toFixed(2);
  document.getElementById('shareAmount').textContent = '￥' + shareTotal.toFixed(2);
  document.getElementById('assistantAmount').textContent = '￥' + assistantTotal.toFixed(2);
  document.getElementById('recordCount').textContent = records.length;

  const list = document.getElementById('recordList');
  if (records.length === 0) {
    list.innerHTML = '<p class="empty">还没有记录，先记一笔吧</p>';
    return;
  }

  list.innerHTML = records.map(r => `
    <div class="record-item">
      <div class="record-top">
        <span class="record-date">${r.date}</span>
        <span class="record-amount">￥${Number(r.amount).toFixed(2)}</span>
      </div>
      <div class="record-mid">
        <span class="record-type">${r.type}</span>
        <span class="record-handler">经手：${r.handler}</span>
      </div>
      <div class="record-bottom">
        <span class="record-share ${r.share ? 'share-yes' : 'share-no'}">
          ${r.share ? '✓ 参与分摊' : '✕ 不摊·助理垫付'}
        </span>
        ${r.remark ? `<span class="record-remark">${r.remark}</span>` : ''}
        <button class="del-btn" onclick="deleteRecord(${r.id})">删除</button>
      </div>
    </div>
  `).join('');
}

// ===== 保存记录（add.html 用）=====
function saveRecord() {
  const date = document.getElementById('date').value;
  const amount = document.getElementById('amount').value;
  const type = document.getElementById('type').value;
  const handler = document.getElementById('handler').value;
  const remark = document.getElementById('remark').value;
  const share = document.getElementById('share').checked;

  if (!date || !amount || Number(amount) <= 0) {
    alert('请填好日期和金额');
    return;
  }

  addRecord({ date, amount: Number(amount), type, handler, remark, share });
  alert('保存成功！');
  window.location.href = 'index.html';
}

// ===== 删除（主页用）=====
function deleteRecord(id) {
  if (!confirm('确定删除这笔记录？')) return;
  deleteRecord(id);
  loadHomeData();
}

// ===== 结算页加载（settle.html 用）=====
function loadSettleData() {
  const records = getRecords();
  const shareList = records.filter(r => r.share);
  const shareTotal = shareList.reduce((s, r) => s + Number(r.amount), 0);
  const assistantTotal = records.filter(r => !r.share).reduce((s, r) => s + Number(r.amount), 0);
  const per = shareTotal / BROTHERS.length;

  const shareEl = document.getElementById('shareTotal');
  const perEl = document.getElementById('perBrother');
  const astEl = document.getElementById('assistantTotal');
  if (shareEl) shareEl.textContent = '￥' + shareTotal.toFixed(2);
  if (perEl) perEl.textContent = '￥' + per.toFixed(2);
  if (astEl) astEl.textContent = '￥' + assistantTotal.toFixed(2);

  // 兄弟统计
  const paidMap = {};
  BROTHERS.forEach(b => paidMap[b] = 0);
  shareList.forEach(r => { if (paidMap[r.handler] !== undefined) paidMap[r.handler] += Number(r.amount); });

  const brotherStats = BROTHERS.map(name => {
    const paid = paidMap[name];
    const diff = paid - per;
    return { name, paid, should: per, diff };
  });

  const bsEl = document.getElementById('brotherStats');
  if (bsEl) {
    bsEl.innerHTML = brotherStats.map(b => `
      <div class="brother-row">
        <strong>${b.name}</strong>
        <span>实付 ￥${b.paid.toFixed(2)} / 应摊 ￥${b.should.toFixed(2)}</span>
        <span class="${b.diff >= 0 ? 'green' : 'red'}">
          ${b.diff >= 0 ? '应收回 ￥' + b.diff.toFixed(2) : '需补交 ￥' + (-b.diff).toFixed(2)}
        </span>
      </div>
    `).join('');
  }

  // 建议转账
  const creditors = brotherStats.filter(b => b.diff > 0.01).map(b => ({ name: b.name, amount: b.diff }));
  const debtors = brotherStats.filter(b => b.diff < -0.01).map(b => ({ name: b.name, amount: -b.diff }));
  const transfers = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const c = creditors[i], d = debtors[j];
    const m = Math.min(c.amount, d.amount);
    transfers.push(`<div class="transfer-item">${d.name} <strong>→</strong> ${c.name} <strong>￥${m.toFixed(2)}</strong></div>`);
    c.amount -= m; d.amount -= m;
    if (c.amount < 0.01) i++;
    if (d.amount < 0.01) j++;
  }
  const tfEl = document.getElementById('transfers');
  if (tfEl) {
    tfEl.innerHTML = transfers.length ? transfers.join('') : '<p class="empty">已平，不用转账</p>';
  }

  // 经手人汇总
  const handlerMap = {};
  records.forEach(r => { handlerMap[r.handler] = (handlerMap[r.handler] || 0) + Number(r.amount); });
  const hsEl = document.getElementById('handlerStats');
  if (hsEl) {
    hsEl.innerHTML = Object.entries(handlerMap).map(([k, v]) => `
      <div class="handler-row"><span>${k}</span><strong>￥${v.toFixed(2)}</strong></div>
    `).join('');
  }
}

// ===== 导出 CSV =====
function exportCSV() {
  const records = getRecords();
  const csv = '\uFEFF日期,金额,费用种类,经手人,是否分摊,备注\n' +
    records.map(r => `"${r.date}",${r.amount},"${r.type}","${r.handler}","${r.share ? '是' : '否'}","${r.remark || ''}"`).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '住院买药记账_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}

// ===== 清空 =====
function clearAllConfirm() {
  if (clearAll()) {
    alert('已清空');
    window.location.href = 'index.html';
  }
}
