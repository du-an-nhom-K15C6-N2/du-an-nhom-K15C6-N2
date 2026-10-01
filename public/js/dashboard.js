initPage(async () => {
  setTitle('Tổng quan');
  const s = await api('/stats');
  render(s);
});

function stat(ico, cls, val, label) {
  return `<div class="stat">
    <div class="s-ico ${cls}">${ico}</div>
    <div><div class="s-val">${val}</div><div class="s-label">${label}</div></div>
  </div>`;
}

function render(s) {
  const content = document.getElementById('content');
  const maxCount = Math.max(...s.rolesDistribution.map((r) => r.user_count), 1);

  content.innerHTML = `
    <div class="stat-grid">
      ${stat('👥', 'ico-blue', s.totalUsers, 'Người dùng')}
      ${stat('🛡️', 'ico-violet', s.totalRoles, 'Vai trò')}
      ${stat('🔗', 'ico-green', s.totalAssignments, 'Lượt phân quyền')}
      ${stat('⭐', 'ico-amber', s.admins, 'Quản trị viên')}
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-head"><h3>Phân bố vai trò</h3><span class="sub">theo số người dùng</span></div>
        <div id="distBox"></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Hoạt động gần đây</h3><a href="/audit.html" class="btn ghost sm">Xem tất cả →</a></div>
        <div id="recentBox"></div>
      </div>
    </div>`;

  document.getElementById('distBox').innerHTML = s.rolesDistribution.map((r) => `
    <div class="dist-item">
      <span class="d-name">${roleBadge(r)}</span>
      <div class="progress"><div class="progress-bar" style="width:${Math.round((r.user_count / maxCount) * 100)}%"></div></div>
      <span class="d-count">${r.user_count}</span>
    </div>`).join('');

  document.getElementById('recentBox').innerHTML = s.recent.length
    ? s.recent.map((a) => `
        <div class="dist-item">
          ${avatar(a.actor_name, 'sm')}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px">
              <b>${esc(a.actor_name)}</b> ${a.action === 'assign' ? 'gán' : 'thu hồi'} vai trò
              <b>${esc(a.role_name)}</b> cho <b>${esc(a.target_name)}</b>
            </div>
            <div class="muted" style="font-size:11.5px">${timeAgo(a.created_at)}</div>
          </div>
          ${actionBadge(a.action)}
        </div>`).join('')
    : '<div class="empty"><div class="big">🕓</div>Chưa có hoạt động</div>';
}
