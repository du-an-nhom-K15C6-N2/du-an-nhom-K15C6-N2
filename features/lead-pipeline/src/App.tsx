import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_LIST = ["Mới", "Đã liên hệ", "Đang tư vấn", "Hẹn học thử", "Chốt", "Từ chối"] as const;
const REJECTION_REASONS = [
  "Không phù hợp nhu cầu",
  "Không liên hệ được",
  "Học phí",
  "Lịch học",
  "Đã chọn nơi khác",
] as const;

type LeadStatus = (typeof STATUS_LIST)[number];
type Lead = {
  id: number;
  name: string;
  phone: string;
  course: string;
  source: string;
  status: LeadStatus;
  nextCallAt: string | null;
  updatedAt: string;
};
type HistoryItem = {
  id: number;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus;
  reason: string | null;
  changedAt: string;
  changedBy: string;
};
type Board = {
  statuses: LeadStatus[];
  counts: Record<LeadStatus, number>;
  leadsByStatus: Record<LeadStatus, Lead[]>;
};
type PendingMove = { lead: Lead; status: LeadStatus };

const STATUS_STYLE: Record<LeadStatus, string> = {
  "Mới": "new",
  "Đã liên hệ": "contacted",
  "Đang tư vấn": "consulting",
  "Hẹn học thử": "trial",
  "Chốt": "won",
  "Từ chối": "rejected",
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Không thể hoàn thành yêu cầu. Vui lòng thử lại.");
  }
  return response.json() as Promise<T>;
}

function formatDate(value: string | null): string {
  if (!value) return "Chưa lên lịch";
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  return `${isToday ? "Hôm nay" : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} · ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  return name.split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

export default function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadBoard = useCallback(async () => {
    const data = await request<Board>("/api/leads");
    setBoard(data);
    setSelectedLead((current) => current ? data.leadsByStatus[current.status].find((lead) => lead.id === current.id) ?? current : null);
  }, []);

  useEffect(() => {
    loadBoard()
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Không thể tải danh sách lead."))
      .finally(() => setLoading(false));
  }, [loadBoard]);

  useEffect(() => {
    if (!selectedLead) {
      setHistory([]);
      return;
    }
    let active = true;
    setHistory([]);
    request<HistoryItem[]>(`/api/leads/${selectedLead.id}/history`)
      .then((items) => {
        if (active) setHistory(items);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải lịch sử lead.");
      });
    return () => {
      active = false;
    };
  }, [selectedLead?.id, historyRefresh]);

  const totalLeads = useMemo(
    () => board ? Object.values(board.counts).reduce((sum, count) => sum + count, 0) : 0,
    [board],
  );

  function askMove(lead: Lead, status: LeadStatus) {
    if (lead.status === status) return;
    setError("");
    setReason("");
    setPendingMove({ lead, status });
  }

  async function confirmMove() {
    if (!pendingMove || saving) return;
    if (pendingMove.status === "Từ chối" && !reason) {
      setError("Vui lòng chọn lý do từ chối.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result = await request<{ board: Board }>("/api/leads/" + pendingMove.lead.id + "/status", {
        method: "PATCH",
        body: JSON.stringify({
          status: pendingMove.status,
          ...(pendingMove.status === "Từ chối" ? { reason } : {}),
        }),
      });
      setBoard(result.board);
      const updated = result.board.leadsByStatus[pendingMove.status].find((lead) => lead.id === pendingMove.lead.id) ?? null;
      if (selectedLead?.id === pendingMove.lead.id) {
        setSelectedLead(updated);
        setHistoryRefresh((current) => current + 1);
      }
      setPendingMove(null);
      setReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật trạng thái.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="loading-screen"><span className="spinner" />Đang tải bảng phễu...</main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Trang chủ bảng phễu">
          <span className="brand-mark">N</span>
          <span className="brand-name">nova<span>edu</span></span>
        </a>
      </header>

      <section className="page-content">
        <div className="breadcrumb"><span>Tuyển sinh</span><span className="breadcrumb-divider">/</span><strong>Phễu tư vấn</strong></div>
        <div className="page-heading">
          <div>
            <span className="eyebrow">QUẢN LÝ TUYỂN SINH</span>
            <h1>Phễu tư vấn</h1>
            <p>Theo sát hành trình, chạm đúng thời điểm.</p>
          </div>
          <div className="summary-card">
            <span className="summary-icon">↗</span>
            <div><strong>{totalLeads}</strong><span>Tổng số lead</span></div>
          </div>
        </div>

        {error && <div className="error-banner" role="alert"><span>!</span>{error}<button onClick={() => setError("")} aria-label="Đóng thông báo">×</button></div>}

        <div className="board-toolbar">
          <div className="view-tabs"><button className="view-tab active">Tất cả lead <span>{totalLeads}</span></button><button className="view-tab" disabled>Ưu tiên hôm nay</button></div>
          <span className="drag-hint"><span aria-hidden="true">⠿</span> Kéo thả lead để đổi trạng thái</span>
        </div>

        {board && (
          <section className="pipeline" aria-label="Bảng phễu lead">
            {board.statuses.map((status, index) => (
              <div
                className={`pipeline-column ${STATUS_STYLE[status]}`}
                key={status}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = Number(event.dataTransfer.getData("text/plain"));
                  const lead = board.leadsByStatus[status].find((item) => item.id === id)
                    ?? Object.values(board.leadsByStatus).flat().find((item) => item.id === id);
                  if (lead) askMove(lead, status);
                }}
              >
                <div className="column-heading">
                  <div className="column-title"><span className="status-dot" /><h2>{status}</h2><span className="count-badge">{board.counts[status]}</span></div>
                  <button className="column-menu" aria-label={`Tùy chọn cột ${status}`} disabled>···</button>
                </div>
                <div className="lead-list">
                  {board.leadsByStatus[status].map((lead) => (
                    <article
                      className={`lead-card ${selectedLead?.id === lead.id ? "selected" : ""}`}
                      key={lead.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(lead.id));
                      }}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <div className="card-topline"><span className="lead-id">LEAD-{String(lead.id).padStart(4, "0")}</span><span className="card-menu">···</span></div>
                      <div className="lead-name-row"><span className={`lead-avatar avatar-${lead.id % 5}`}>{initials(lead.name)}</span><strong>{lead.name}</strong></div>
                      <div className="lead-meta"><span className="meta-icon">▱</span>{lead.phone}</div>
                      <div className="course-tag">{lead.course}</div>
                      <div className="card-footer"><span className="due-date"><span aria-hidden="true">◷</span> {formatDate(lead.nextCallAt)}</span><span className="source-tag">{lead.source}</span></div>
                      <label className="quick-move">
                        <span className="sr-only">Đổi trạng thái cho {lead.name}</span>
                        <select
                          value=""
                          aria-label={`Đổi trạng thái cho ${lead.name}`}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            event.stopPropagation();
                            askMove(lead, event.target.value as LeadStatus);
                          }}
                        >
                          <option value="" disabled>Chuyển đến...</option>
                          {STATUS_LIST.filter((target) => target !== lead.status).map((target) => <option key={target} value={target}>{target}</option>)}
                        </select>
                      </label>
                    </article>
                  ))}
                  {board.counts[status] === 0 && <div className="empty-column">Chưa có lead ở bước này</div>}
                </div>
                <button className="add-lead" disabled><span>＋</span> Thêm lead</button>
                {index === 0 && <span className="column-footnote">Ưu tiên liên hệ sớm</span>}
              </div>
            ))}
          </section>
        )}
      </section>

      {selectedLead && (
        <>
          <button className="drawer-backdrop" onClick={() => setSelectedLead(null)} aria-label="Đóng chi tiết lead" />
          <aside className="detail-drawer" aria-label={`Chi tiết lead ${selectedLead.name}`}>
            <div className="drawer-header"><div><span className="eyebrow">CHI TIẾT LEAD</span><h2>Hồ sơ tư vấn</h2></div><button className="close-button" onClick={() => setSelectedLead(null)} aria-label="Đóng">×</button></div>
            <div className="profile-card">
              <span className={`lead-avatar large avatar-${selectedLead.id % 5}`}>{initials(selectedLead.name)}</span>
              <div><h3>{selectedLead.name}</h3><span className={`status-pill ${STATUS_STYLE[selectedLead.status]}`}>{selectedLead.status}</span></div>
            </div>
            <div className="detail-section"><h3>Thông tin liên hệ</h3><dl><div><dt>Số điện thoại</dt><dd>{selectedLead.phone}</dd></div><div><dt>Khóa học quan tâm</dt><dd>{selectedLead.course}</dd></div><div><dt>Nguồn lead</dt><dd>{selectedLead.source}</dd></div><div><dt>Lịch gọi tiếp theo</dt><dd>{formatDate(selectedLead.nextCallAt)}</dd></div></dl></div>
            <div className="detail-section history-section"><div className="section-heading"><h3>Nhật ký trạng thái</h3><span>{history.length}</span></div>
              {history.length === 0 ? <p className="history-empty">Chưa có lần thay đổi trạng thái nào.</p> : (
                <ol className="history-list">{history.map((item) => (
                  <li key={item.id}><span className="history-marker" /><div className="history-item"><strong>{item.fromStatus ?? "Tạo mới"} <span>→</span> {item.toStatus}</strong><time>{formatTimestamp(item.changedAt)}</time><span className="history-actor">Thực hiện bởi {item.changedBy}</span>{item.reason && <span className="history-reason">Lý do: {item.reason}</span>}</div></li>
                ))}</ol>
              )}
            </div>
          </aside>
        </>
      )}

      {pendingMove && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setPendingMove(null); }}>
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="move-title">
            <div className={`modal-icon ${pendingMove.status === "Từ chối" ? "danger" : ""}`}>{pendingMove.status === "Từ chối" ? "!" : "↗"}</div>
            <button className="close-button modal-close" onClick={() => setPendingMove(null)} aria-label="Đóng" disabled={saving}>×</button>
            <span className="eyebrow">XÁC NHẬN THAY ĐỔI</span>
            <h2 id="move-title">Cập nhật trạng thái lead?</h2>
            <p className="modal-description">Lead <strong>{pendingMove.lead.name}</strong> sẽ được chuyển từ <strong>{pendingMove.lead.status}</strong> sang <strong>{pendingMove.status}</strong>.</p>
            {pendingMove.status === "Từ chối" && (
              <label className="reason-field">Lý do từ chối <span>*</span>
                <select value={reason} onChange={(event) => setReason(event.target.value)} required>
                  <option value="">Chọn lý do từ chối</option>
                  {REJECTION_REASONS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            )}
            <div className="modal-actions"><button className="button-secondary" onClick={() => setPendingMove(null)} disabled={saving}>Hủy</button><button className="button-primary" onClick={confirmMove} disabled={saving}>{saving ? "Đang lưu..." : "Xác nhận chuyển"}</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
