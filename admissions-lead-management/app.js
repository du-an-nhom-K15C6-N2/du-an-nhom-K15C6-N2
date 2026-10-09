// Cấu hình trạng thái ứng dụng
let currentPage = 1;
const pageSize = 10;
let currentQuickRange = 'All';
let currentSelectedLeadId = null;

// Mock Data phục vụ demo trực quan khi mở trực tiếp file HTML không qua server API
const fallbackLeads = [
    {
        id: 1,
        fullName: "Nguyễn Văn Hùng (Phụ huynh em Nguyễn Hoàng Nam)",
        phoneNumber: "0912345678",
        email: "hung.nguyen@gmail.com",
        majorInterest: "Kỹ thuật Phần mềm (CNTT)",
        address: "Cầu Giấy, Hà Nội",
        status: 4, // CallAgainLater
        statusName: "Hẹn gọi lại sau",
        source: 2,
        sourceName: "Hotline Tuyển sinh",
        assignedCounselorId: 1,
        assignedCounselorName: "Nguyễn Thuỳ Linh",
        createdDate: "2026-03-05T08:00:00Z",
        lastInteractionDate: "2026-03-15T14:30:00Z",
        latestInteraction: {
            id: 101,
            interactionDate: "2026-03-15T14:30:00Z",
            channelName: "Cuộc gọi điện thoại",
            content: "Trao đổi 15 phút: Phụ huynh hỏi kỹ về học phí kỳ 1 và chương trình học bổng 50% kỳ đầu. Đã giải thích chính sách học bổng theo điểm thi IELTS 6.5 của con. Bố dặn tháng sau con thi tốt nghiệp xong sẽ gọi lại để nộp hồ sơ xét tuyển sớm.",
            outcome: "Phụ huynh rất quan tâm, hẹn tháng sau gọi lại khi con thi xong.",
            counselorName: "Nguyễn Thuỳ Linh"
        },
        interactions: [
            {
                id: 101,
                interactionDate: "2026-03-15T14:30:00Z",
                channelName: "Cuộc gọi điện thoại",
                content: "Trao đổi 15 phút: Phụ huynh hỏi kỹ về học phí kỳ 1 và chương trình học bổng 50% kỳ đầu. Đã giải thích chính sách học bổng theo điểm thi IELTS 6.5 của con. Bố dặn tháng sau con thi tốt nghiệp xong sẽ gọi lại để nộp hồ sơ xét tuyển sớm.",
                outcome: "Phụ huynh rất quan tâm, hẹn tháng sau gọi lại khi con thi xong.",
                counselorName: "Nguyễn Thuỳ Linh"
            }
        ]
    },
    {
        id: 2,
        fullName: "Trần Thị Mai Anh",
        phoneNumber: "0988776655",
        email: "maianh.tran@gmail.com",
        majorInterest: "Truyền thông Đa phương tiện",
        address: "Thanh Xuân, Hà Nội",
        status: 2, // Consulting
        statusName: "Đang tư vấn",
        source: 0,
        sourceName: "Facebook Ads",
        assignedCounselorId: 1,
        assignedCounselorName: "Nguyễn Thuỳ Linh",
        createdDate: "2026-03-10T11:00:00Z",
        lastInteractionDate: "2026-03-22T10:15:00Z",
        latestInteraction: {
            id: 102,
            interactionDate: "2026-03-22T10:15:00Z",
            channelName: "Tin nhắn Zalo",
            content: "Gửi đề cương đào tạo ngành Truyền thông và portfolio mẫu của sinh viên khoá trước qua Zalo. Học sinh băn khoăn giữa học tại trường và học FPT Arena.",
            outcome: "Đã gửi tài liệu tham khảo, hẹn tư vấn trực tiếp cùng phụ huynh.",
            counselorName: "Nguyễn Thuỳ Linh"
        },
        interactions: [
            {
                id: 102,
                interactionDate: "2026-03-22T10:15:00Z",
                channelName: "Tin nhắn Zalo",
                content: "Gửi đề cương đào tạo ngành Truyền thông và portfolio mẫu của sinh viên khoá trước qua Zalo. Học sinh băn khoăn giữa học tại trường và học FPT Arena.",
                outcome: "Đã gửi tài liệu tham khảo, hẹn tư vấn trực tiếp cùng phụ huynh.",
                counselorName: "Nguyễn Thuỳ Linh"
            }
        ]
    },
    {
        id: 3,
        fullName: "Phạm Quốc Tuấn",
        phoneNumber: "0901234987",
        email: "tuan.pq@yahoo.com",
        majorInterest: "Quản trị Kinh doanh Quốc tế",
        address: "Hải Phòng",
        status: 3, // ScheduledAppointment
        statusName: "Đã đặt lịch hẹn",
        source: 3,
        sourceName: "Website Landing Page",
        assignedCounselorId: 2,
        assignedCounselorName: "Lê Hoàng Long",
        createdDate: "2026-03-12T09:00:00Z",
        lastInteractionDate: "2026-03-28T16:00:00Z",
        latestInteraction: {
            id: 103,
            interactionDate: "2026-03-28T16:00:00Z",
            channelName: "Cuộc gọi điện thoại",
            content: "Xác nhận lịch hẹn phụ huynh và học sinh đến tham quan cơ sở đào tạo và nộp hồ sơ giữ chỗ chỉ tiêu đợt 1.",
            outcome: "Đã chốt lịch hẹn tham quan cuối tuần.",
            counselorName: "Lê Hoàng Long"
        },
        interactions: [
            {
                id: 103,
                interactionDate: "2026-03-28T16:00:00Z",
                channelName: "Cuộc gọi điện thoại",
                content: "Xác nhận lịch hẹn phụ huynh và học sinh đến tham quan cơ sở đào tạo và nộp hồ sơ giữ chỗ chỉ tiêu đợt 1.",
                outcome: "Đã chốt lịch hẹn tham quan cuối tuần.",
                counselorName: "Lê Hoàng Long"
            }
        ]
    },
    {
        id: 4,
        fullName: "Lê Thị Bích Ngọc",
        phoneNumber: "0934567890",
        email: "bichngoc.le@gmail.com",
        majorInterest: "Logistics và Quản lý Chuỗi cung ứng",
        address: "Bắc Ninh",
        status: 1, // Contacted
        statusName: "Đã liên hệ",
        source: 4,
        sourceName: "Ngày hội tuyển sinh",
        assignedCounselorId: 2,
        assignedCounselorName: "Lê Hoàng Long",
        createdDate: "2026-04-01T10:00:00Z",
        lastInteractionDate: "2026-04-04T15:20:00Z",
        latestInteraction: {
            id: 104,
            interactionDate: "2026-04-04T15:20:00Z",
            channelName: "Cuộc gọi điện thoại",
            content: "Gọi điện giới thiệu cơ hội việc làm ngành Logistics, phụ huynh muốn biết mức học phí toàn khoá.",
            outcome: "Đã gửi bảng dự toán học phí qua Email.",
            counselorName: "Lê Hoàng Long"
        },
        interactions: []
    },
    {
        id: 5,
        fullName: "Hoàng Đức Minh",
        phoneNumber: "0945678123",
        email: "minh.hd@gmail.com",
        majorInterest: "Trí tuệ Nhân tạo & Khoa học Dữ liệu",
        address: "Hà Đông, Hà Nội",
        status: 5, // Enrolled
        statusName: "Đã nhập học",
        source: 5,
        sourceName: "Người quen giới thiệu",
        assignedCounselorId: 3,
        assignedCounselorName: "Trần Minh Quân",
        createdDate: "2026-03-10T08:00:00Z",
        lastInteractionDate: "2026-04-07T09:30:00Z",
        latestInteraction: {
            id: 106,
            interactionDate: "2026-04-07T09:30:00Z",
            channelName: "Gặp trực tiếp tại trường",
            content: "Đến trường nộp hồ sơ gốc và hoàn tất thủ tục nhập học sớm.",
            outcome: "Đã nhập học thành công (Enrolled).",
            counselorName: "Trần Minh Quân"
        },
        interactions: []
    },
    {
        id: 6,
        fullName: "Vũ Đình Trọng",
        phoneNumber: "0923456789",
        email: "trong.vu@outlook.com",
        majorInterest: "An toàn Thông tin (Cybersecurity)",
        address: "Nam Định",
        status: 4, // CallAgainLater
        statusName: "Hẹn gọi lại sau",
        source: 1,
        sourceName: "Google Search",
        assignedCounselorId: 3,
        assignedCounselorName: "Trần Minh Quân",
        createdDate: "2026-03-08T09:00:00Z",
        lastInteractionDate: "2026-03-12T11:20:00Z",
        latestInteraction: {
            id: 105,
            interactionDate: "2026-03-12T11:20:00Z",
            channelName: "Cuộc gọi điện thoại",
            content: "Học sinh muốn học chứng chỉ CompTIA Security+ và CEH song song bằng cử nhân. Trao đổi về lộ trình thực tập tại doanh nghiệp đối tác từ năm thứ 3. Em hẹn sau kỳ thi tốt nghiệp sẽ trao đổi lại cùng mẹ.",
            outcome: "Hẹn gọi lại sau khi thi tốt nghiệp.",
            counselorName: "Trần Minh Quân"
        },
        interactions: []
    }
];

// Khởi chạy khi load trang
document.addEventListener('DOMContentLoaded', () => {
    applyFilter();
});

// Hàm chọn nhanh khoảng thời gian
function selectQuickRange(range, buttonElement) {
    currentQuickRange = range;
    document.querySelectorAll('.quick-range-btn').forEach(btn => {
        btn.classList.remove('tag-active');
    });
    if (buttonElement) {
        buttonElement.classList.add('tag-active');
    }

    // Xóa custom date picker nếu chọn quick option khác Custom
    if (range !== 'Custom') {
        document.getElementById('fromDate').value = '';
        document.getElementById('toDate').value = '';
    }

    applyFilter();
}

// Hàm lấy dữ liệu và hiển thị danh sách Lead
async function applyFilter() {
    const keyword = document.getElementById('keyword').value.trim();
    const status = document.getElementById('statusFilter').value;
    const source = document.getElementById('sourceFilter').value;
    const counselorId = document.getElementById('counselorFilter').value;
    const dateFilterType = document.getElementById('dateFilterType').value;
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const sortBy = document.getElementById('sortBy').value;

    const queryParams = new URLSearchParams({
        PageNumber: currentPage,
        PageSize: pageSize,
        QuickTimeRange: currentQuickRange,
        DateFilterType: dateFilterType,
        SortBy: sortBy,
        SortDescending: 'true'
    });

    if (keyword) queryParams.append('Keyword', keyword);
    if (status !== "") queryParams.append('Status', status);
    if (source !== "") queryParams.append('Source', source);
    if (counselorId !== "") queryParams.append('CounselorId', counselorId);
    if (fromDate) queryParams.append('FromDate', fromDate);
    if (toDate) queryParams.append('ToDate', toDate);

    // A page opened directly from disk has no API origin; use demo data without
    // issuing a relative fetch that is guaranteed to fail under the file: scheme.
    if (window.location.protocol !== 'file:') {
        try {
            const response = await fetch(`/api/leads/search?${queryParams.toString()}`);
            if (response.ok) {
                const data = await response.json();
                renderLeads(data.items, data.totalCount);
                return;
            }
        } catch (err) {
            console.warn("Backend API chưa kết nối, sử dụng mock data để mô phỏng tìm kiếm:", err);
        }
    }

    // Client-side fallback filter mô phỏng logic backend
    filterFallbackData(keyword, status, source, counselorId, currentQuickRange, fromDate, toDate, sortBy);
}

// Logic lọc Client-side tương thích 100% với Backend
function filterFallbackData(keyword, status, source, counselorId, quickRange, fromDate, toDate, sortBy) {
    let results = [...fallbackLeads];

    if (keyword) {
        const kw = keyword.toLowerCase();
        results = results.filter(l => 
            l.fullName.toLowerCase().includes(kw) ||
            l.phoneNumber.includes(kw) ||
            (l.email && l.email.toLowerCase().includes(kw)) ||
            (l.majorInterest && l.majorInterest.toLowerCase().includes(kw)) ||
            (l.latestInteraction && l.latestInteraction.content.toLowerCase().includes(kw))
        );
    }

    if (status !== "") {
        results = results.filter(l => l.status === parseInt(status));
    }

    if (source !== "") {
        results = results.filter(l => l.source === parseInt(source));
    }

    if (counselorId !== "") {
        results = results.filter(l => l.assignedCounselorId === parseInt(counselorId));
    }

    // Lọc thời gian "Tháng trước" (đáp ứng đúng bài toán nghiệp vụ)
    if (quickRange === 'LastMonth') {
        const now = new Date();
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

        results = results.filter(l => {
            if (!l.lastInteractionDate) return false;
            const d = new Date(l.lastInteractionDate);
            return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        });
    }

    renderLeads(results, results.length);
}

// Hiển thị danh sách Lead ra Table
function renderLeads(leads, totalCount) {
    const tbody = document.getElementById('leadTableBody');
    const summary = document.getElementById('resultSummary');
    const paginationInfo = document.getElementById('paginationInfo');

    summary.innerHTML = `Tìm thấy <b class="text-indigo-600">${totalCount}</b> lead phù hợp ${currentQuickRange === 'LastMonth' ? 'có trao đổi trong <span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold">Tháng trước</span>' : ''}`;
    paginationInfo.textContent = `Hiển thị ${leads.length} / ${totalCount} bản ghi`;

    if (!leads || leads.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-12 text-slate-400">
                    <i class="fa-regular fa-folder-open text-4xl mb-2 text-slate-300 block"></i>
                    Không tìm thấy lead nào phù hợp với bộ lọc hiện tại.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = leads.map(lead => {
        const statusBadge = getStatusBadge(lead.status, lead.statusName);
        const lastDateFormatted = lead.lastInteractionDate ? formatDate(lead.lastInteractionDate) : 'Chưa có';
        const noteContent = lead.latestInteraction 
            ? `<div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                 <div class="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                   <span class="font-medium text-indigo-700"><i class="fa-solid fa-phone text-[10px]"></i> ${lead.latestInteraction.channelName || 'Cuộc gọi'}</span>
                   <span class="text-slate-400">${formatDate(lead.latestInteraction.interactionDate)}</span>
                 </div>
                 <p class="text-slate-700 line-clamp-2 italic">"${lead.latestInteraction.content}"</p>
                 <div class="mt-1 text-[11px] font-medium text-emerald-700">➜ Kết quả: ${lead.latestInteraction.outcome || 'Đã ghi nhận'}</div>
               </div>`
            : `<span class="text-xs text-slate-400 italic">Chưa có nhật ký trao đổi</span>`;

        return `
            <tr class="hover:bg-slate-50/80 transition group">
                <td class="py-3 px-4">
                    <div class="font-semibold text-slate-900">${lead.fullName}</div>
                    <div class="text-xs text-indigo-600 font-medium flex items-center gap-1 mt-0.5">
                        <i class="fa-solid fa-phone text-[10px]"></i> ${lead.phoneNumber}
                    </div>
                    ${lead.email ? `<div class="text-[11px] text-slate-400">${lead.email}</div>` : ''}
                </td>
                <td class="py-3 px-4">
                    <span class="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md inline-block">
                        ${lead.majorInterest || 'Chưa chọn ngành'}
                    </span>
                </td>
                <td class="py-3 px-4">
                    ${statusBadge}
                </td>
                <td class="py-3 px-4 text-xs">
                    <div class="font-medium text-slate-700">${lead.sourceName}</div>
                    <div class="text-slate-500 text-[11px] mt-0.5">
                        <i class="fa-regular fa-user text-[10px]"></i> ${lead.assignedCounselorName || 'Chưa phân công'}
                    </div>
                </td>
                <td class="py-3 px-4">
                    ${noteContent}
                </td>
                <td class="py-3 px-4 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="viewHistory(${lead.id})" title="Xem lịch sử trao đổi" class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-medium transition">
                            <i class="fa-solid fa-clock-rotate-left"></i> Lịch sử
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Badge màu cho từng trạng thái Lead
function getStatusBadge(status, label) {
    const badges = {
        0: 'bg-blue-50 text-blue-700 border-blue-200',
        1: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        2: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        3: 'bg-purple-50 text-purple-700 border-purple-200',
        4: 'bg-amber-50 text-amber-700 border-amber-200',
        5: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        6: 'bg-rose-50 text-rose-700 border-rose-200'
    };
    const style = badges[status] || 'bg-slate-100 text-slate-700 border-slate-200';
    return `<span class="px-2.5 py-1 rounded-full text-xs font-medium border ${style} inline-flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-current"></span> ${label}
    </span>`;
}

// Đặt lại toàn bộ bộ lọc
function resetFilters() {
    document.getElementById('keyword').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('sourceFilter').value = '';
    document.getElementById('counselorFilter').value = '';
    document.getElementById('dateFilterType').value = '0';
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('sortBy').value = 'LastInteractionDate';
    selectQuickRange('All', document.querySelector('.quick-range-btn:last-child'));
}

// Xem chi tiết Timeline các cuộc trao đổi trong quá khứ
function viewHistory(leadId) {
    currentSelectedLeadId = leadId;
    const lead = fallbackLeads.find(l => l.id === leadId);
    if (!lead) return;

    document.getElementById('modalLeadName').textContent = lead.fullName;
    document.getElementById('modalLeadPhone').textContent = `SĐT: ${lead.phoneNumber} | Ngành: ${lead.majorInterest}`;

    const timelineContainer = document.getElementById('modalTimeline');
    const notes = lead.interactions && lead.interactions.length > 0 
        ? lead.interactions 
        : (lead.latestInteraction ? [lead.latestInteraction] : []);

    if (notes.length === 0) {
        timelineContainer.innerHTML = '<p class="text-xs text-slate-400 italic">Chưa có lịch sử cuộc gọi nào.</p>';
    } else {
        timelineContainer.innerHTML = notes.map(n => `
            <div class="relative pl-2">
                <span class="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-indigo-600 ring-4 ring-white"></span>
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                    <div class="flex justify-between items-center text-slate-500 mb-1 text-[11px]">
                        <span class="font-semibold text-slate-800">${n.counselorName} • ${n.channelName || 'Cuộc gọi'}</span>
                        <span>${formatDate(n.interactionDate)}</span>
                    </div>
                    <p class="text-slate-700 leading-relaxed">${n.content}</p>
                    <div class="mt-2 text-emerald-700 font-medium">✓ Kết quả: ${n.outcome}</div>
                </div>
            </div>
        `).join('');
    }

    document.getElementById('historyModal').classList.remove('hidden');
}

// Lưu ghi chú cuộc trao đổi mới khi khách vừa gọi lại
function saveNewInteraction() {
    const content = document.getElementById('newInteractionContent').value.trim();
    const outcome = document.getElementById('newInteractionOutcome').value.trim();

    if (!content) {
        alert('Vui lòng nhập nội dung trao đổi!');
        return;
    }

    const lead = fallbackLeads.find(l => l.id === currentSelectedLeadId);
    if (lead) {
        const newNote = {
            id: Date.now(),
            interactionDate: new Date().toISOString(),
            channelName: "Cuộc gọi điện thoại (Khách gọi lại)",
            content: content,
            outcome: outcome || "Đã trao đổi tiếp",
            counselorName: "Nguyễn Thuỳ Linh"
        };
        lead.interactions.unshift(newNote);
        lead.latestInteraction = newNote;
        lead.lastInteractionDate = newNote.interactionDate;

        document.getElementById('newInteractionContent').value = '';
        document.getElementById('newInteractionOutcome').value = '';
        viewHistory(currentSelectedLeadId);
        applyFilter();
    }
}

function closeModal() {
    document.getElementById('historyModal').classList.add('hidden');
}

function formatDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins} ${day}/${month}/${year}`;
}
