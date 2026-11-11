// 페이지 안에 넣는 테스트 도우미 (실제 화면 함수만 호출한다)
module.exports = `
window.T = {
  add(o) {
    openAddModal();
    if (o.type === 'book') document.querySelector('#typePicker [data-type="book"]').click();
    if (o.status && o.status !== 'watching') document.querySelector('#statusPicker .status-option[data-status="' + o.status + '"]').click();
    document.getElementById('fTitle').value = o.title;
    if (o.parts) {
      const cb = document.getElementById('fUseParts'); cb.checked = true; togglePartsMode(true);
      while (state.formParts.length < o.parts.length) addPartRow();
      o.parts.forEach((n, i) => { onPartInput(i, 'total', String(n)); });
      renderPartsEditor();
      if (o.curPart != null) { document.getElementById('fCurPart').value = String(o.curPart); state.formCurPart = o.curPart; }
      document.getElementById('fCurPartEp').value = o.curPartEp != null ? String(o.curPartEp) : '';
    } else {
      document.getElementById('fTotalEp').value = o.total != null ? String(o.total) : '';
      document.getElementById('fCurrentEp').value = o.cur != null ? String(o.cur) : '';
    }
    if (o.otts) state.selectedOtts = o.otts.slice();
    if (o.start !== undefined) document.getElementById('fStartDate').value = o.start;
    saveContent(new Event('submit'));
    return state.items[0].id;
  },
  item(id) { return state.items.find(i => i.id === id); },
  plan(o) { // {date, itemId, eps, text}
    openPlanEditor(o.date);
    if (o.itemId) planPickItem(o.itemId);
    (o.eps || []).forEach(g => togglePlanEp(g));
    document.getElementById('planDate').value = o.date;
    document.getElementById('planText').value = o.text || '';
    onPlanTextInput();
    const before = new Set(state.plans.map(p => p.id));
    savePlan();
    const np = state.plans.find(p => !before.has(p.id));
    return np ? np.id : null;
  },
  home() { return [...document.querySelectorAll('#homePlan .plan-row')].map(r => (r.classList.contains('done') ? '✓ ' : '○ ') + r.querySelector('.plan-row-line').textContent); },
  homeHead() { return document.querySelector('#homePlan .home-plan-title').textContent.replace(/\\s+/g, ' ').trim(); },
  dayRows(day) { return [...document.querySelectorAll('#planBody .plan-day[data-day="' + day + '"] .plan-row')].map(r => (r.classList.contains('done') ? '✓ ' : '○ ') + r.querySelector('.plan-row-line').textContent); },
  toast() { const t = document.getElementById('toast'); return t ? t.textContent : ''; },
  modalOpen(id) { return document.getElementById(id).classList.contains('active'); },
  confirmYes() { document.getElementById('confirmBtn').click(); },
  seen(id) { return [...seenSet(T.item(id))].sort((a,b)=>a-b); }
};
`;
