initPage(async () => {
  setTitle('Lịch sử thao tác');
  document.getElementById('filterAction').onchange = load;
  await load();
});

async function load() {
  const action = document.getElementById('filterAction').value;
  const list = await api('/audit' + (action ? '?action=' + action : ''));
  document.getElementById('tbody').innerHTML = list.map((a) => `
    <tr>
      <td class="muted" style="white-space:nowrap">${fmtDateTime(a.created_at)}</td>
      <td><div class="user-cell">${avatar(a.actor_name, 'sm')}<span class="strong">${esc(a.actor_name)}</span></div></td>
      <td>${actionBadge(a.action)}</td>
      <td><div class="user-cell">${avatar(a.target_name, 'sm')}<span class="strong">${esc(a.target_name)}</span></div></td>
      <td><span class="badge ${roleColor(a.role_code)}">${esc(a.role_name)}</span></td>
    </tr>`).join('') ||
    '<tr><td colspan="5"><div class="empty"><div class="big">🕓</div>Chưa có thao tác nào</div></td></tr>';
}
