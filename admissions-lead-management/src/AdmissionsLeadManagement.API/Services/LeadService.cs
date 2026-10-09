using Microsoft.EntityFrameworkCore;
using AdmissionsLeadManagement.API.Data;
using AdmissionsLeadManagement.API.DTOs;
using AdmissionsLeadManagement.API.Models;

namespace AdmissionsLeadManagement.API.Services
{
    public class LeadService : ILeadService
    {
        private readonly AdmissionsDbContext _dbContext;
        private readonly ILogger<LeadService> _logger;

        public LeadService(AdmissionsDbContext dbContext, ILogger<LeadService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<PagedResult<LeadResponseDto>> SearchAndFilterLeadsAsync(LeadFilterQuery query, CancellationToken cancellationToken = default)
        {
            // 1. Chuẩn hoá khoảng thời gian truy vấn
            var (startDate, endDate) = query.GetNormalizedDateRange();

            _logger.LogInformation("Lọc Lead: Status={Status}, Source={Source}, Counselor={CounselorId}, Range={Start} đến {End}, Keyword={Keyword}",
                query.Status, query.Source, query.CounselorId, startDate, endDate, query.Keyword);

            // 2. Xây dựng Queryable với AsNoTracking để tối ưu hiệu năng đọc (Read-only)
            var queryable = _dbContext.Leads
                .AsNoTracking()
                .Include(l => l.AssignedCounselor)
                .Include(l => l.ConsultationNotes)
                    .ThenInclude(cn => cn.Counselor)
                .AsQueryable();

            // 3. Lọc theo trạng thái
            if (query.Status.HasValue)
            {
                queryable = queryable.Where(l => l.Status == query.Status.Value);
            }

            // 4. Lọc theo nguồn tiếp cận
            if (query.Source.HasValue)
            {
                queryable = queryable.Where(l => l.Source == query.Source.Value);
            }

            // 5. Lọc theo chuyên viên tư vấn phụ trách
            if (query.CounselorId.HasValue)
            {
                queryable = queryable.Where(l => l.AssignedCounselorId == query.CounselorId.Value);
            }

            // 6. Tối ưu điều kiện lọc lead theo thời gian (LastInteractionDate hoặc CreatedDate)
            if (query.DateFilterType == DateFilterType.LastInteractionDate)
            {
                if (startDate.HasValue)
                {
                    queryable = queryable.Where(l => l.LastInteractionDate.HasValue && l.LastInteractionDate.Value >= startDate.Value);
                }
                if (endDate.HasValue)
                {
                    queryable = queryable.Where(l => l.LastInteractionDate.HasValue && l.LastInteractionDate.Value <= endDate.Value);
                }
            }
            else // CreatedDate
            {
                if (startDate.HasValue)
                {
                    queryable = queryable.Where(l => l.CreatedDate >= startDate.Value);
                }
                if (endDate.HasValue)
                {
                    queryable = queryable.Where(l => l.CreatedDate <= endDate.Value);
                }
            }

            // 7. Tìm kiếm từ khóa đa trường: Tên, SĐT, Email, Ngành học hoặc NỘI DUNG CUỘC TRAO ĐỔI TRONG QUÁ KHỨ
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var keyword = query.Keyword.Trim();

                // Hỗ trợ tìm kiếm theo SĐT không phân biệt dấu/khoảng trắng hoặc nội dung cuộc trao đổi cũ
                queryable = queryable.Where(l =>
                    EF.Functions.Like(l.FullName, $"%{keyword}%") ||
                    l.PhoneNumber.Contains(keyword) ||
                    (l.Email != null && EF.Functions.Like(l.Email, $"%{keyword}%")) ||
                    (l.MajorInterest != null && EF.Functions.Like(l.MajorInterest, $"%{keyword}%")) ||
                    l.ConsultationNotes.Any(cn => EF.Functions.Like(cn.Content, $"%{keyword}%") || EF.Functions.Like(cn.Outcome, $"%{keyword}%"))
                );
            }

            // 8. Đếm tổng số bản ghi trước khi phân trang
            var totalCount = await queryable.CountAsync(cancellationToken);

            // 9. Sắp xếp động (Ưu tiên cuộc trao đổi gần nhất để tư vấn viên xem ngay)
            queryable = query.SortBy?.ToLower() switch
            {
                "fullname" => query.SortDescending
                    ? queryable.OrderByDescending(l => l.FullName)
                    : queryable.OrderBy(l => l.FullName),
                "createddate" => query.SortDescending
                    ? queryable.OrderByDescending(l => l.CreatedDate)
                    : queryable.OrderBy(l => l.CreatedDate),
                "status" => query.SortDescending
                    ? queryable.OrderByDescending(l => l.Status)
                    : queryable.OrderBy(l => l.Status),
                _ => query.SortDescending // Mặc định LastInteractionDate
                    ? queryable.OrderByDescending(l => l.LastInteractionDate ?? l.CreatedDate)
                    : queryable.OrderBy(l => l.LastInteractionDate ?? l.CreatedDate)
            };

            // 10. Phân trang
            var pagedLeads = await queryable
                .Skip((query.PageNumber - 1) * query.PageSize)
                .Take(query.PageSize)
                .ToListAsync(cancellationToken);

            // 11. Ánh xạ sang DTO kèm thông tin cuộc trao đổi gần nhất
            var dtos = pagedLeads.Select(lead =>
            {
                var sortedNotes = lead.ConsultationNotes
                    .OrderByDescending(cn => cn.InteractionDate)
                    .Select(cn => new ConsultationNoteDto
                    {
                        Id = cn.Id,
                        InteractionDate = cn.InteractionDate,
                        Channel = cn.Channel,
                        Content = cn.Content,
                        Outcome = cn.Outcome,
                        NextAppointmentDate = cn.NextAppointmentDate,
                        CounselorName = cn.Counselor?.FullName ?? "Chuyên viên tư vấn"
                    })
                    .ToList();

                return new LeadResponseDto
                {
                    Id = lead.Id,
                    FullName = lead.FullName,
                    PhoneNumber = lead.PhoneNumber,
                    Email = lead.Email,
                    MajorInterest = lead.MajorInterest,
                    Address = lead.Address,
                    Status = lead.Status,
                    Source = lead.Source,
                    AssignedCounselorId = lead.AssignedCounselorId,
                    AssignedCounselorName = lead.AssignedCounselor?.FullName,
                    CreatedDate = lead.CreatedDate,
                    LastInteractionDate = lead.LastInteractionDate,
                    LatestInteraction = sortedNotes.FirstOrDefault(),
                    Interactions = sortedNotes
                };
            }).ToList();

            return new PagedResult<LeadResponseDto>(dtos, totalCount, query.PageNumber, query.PageSize);
        }

        public async Task<LeadResponseDto?> GetLeadDetailsAsync(int id, CancellationToken cancellationToken = default)
        {
            var lead = await _dbContext.Leads
                .AsNoTracking()
                .Include(l => l.AssignedCounselor)
                .Include(l => l.ConsultationNotes)
                    .ThenInclude(cn => cn.Counselor)
                .FirstOrDefaultAsync(l => l.Id == id, cancellationToken);

            if (lead == null) return null;

            var sortedNotes = lead.ConsultationNotes
                .OrderByDescending(cn => cn.InteractionDate)
                .Select(cn => new ConsultationNoteDto
                {
                    Id = cn.Id,
                    InteractionDate = cn.InteractionDate,
                    Channel = cn.Channel,
                    Content = cn.Content,
                    Outcome = cn.Outcome,
                    NextAppointmentDate = cn.NextAppointmentDate,
                    CounselorName = cn.Counselor?.FullName ?? "Chuyên viên tư vấn"
                })
                .ToList();

            return new LeadResponseDto
            {
                Id = lead.Id,
                FullName = lead.FullName,
                PhoneNumber = lead.PhoneNumber,
                Email = lead.Email,
                MajorInterest = lead.MajorInterest,
                Address = lead.Address,
                Status = lead.Status,
                Source = lead.Source,
                AssignedCounselorId = lead.AssignedCounselorId,
                AssignedCounselorName = lead.AssignedCounselor?.FullName,
                CreatedDate = lead.CreatedDate,
                LastInteractionDate = lead.LastInteractionDate,
                LatestInteraction = sortedNotes.FirstOrDefault(),
                Interactions = sortedNotes
            };
        }

        public async Task<List<Counselor>> GetCounselorsAsync(CancellationToken cancellationToken = default)
        {
            return await _dbContext.Counselors
                .AsNoTracking()
                .Where(c => c.IsActive)
                .OrderBy(c => c.FullName)
                .ToListAsync(cancellationToken);
        }

        public async Task<ConsultationNoteDto> AddConsultationNoteAsync(int leadId, int counselorId, string content, InteractionChannel channel, string outcome, DateTime? nextAppointmentDate = null)
        {
            var lead = await _dbContext.Leads.FindAsync(leadId);
            if (lead == null) throw new KeyNotFoundException($"Không tìm thấy Lead ID {leadId}");

            var now = DateTime.UtcNow;
            var note = new ConsultationNote
            {
                LeadId = leadId,
                CounselorId = counselorId,
                InteractionDate = now,
                Channel = channel,
                Content = content,
                Outcome = outcome,
                NextAppointmentDate = nextAppointmentDate
            };

            // Cập nhật ngày trao đổi gần nhất của Lead
            lead.LastInteractionDate = now;

            _dbContext.ConsultationNotes.Add(note);
            await _dbContext.SaveChangesAsync();

            var counselor = await _dbContext.Counselors.FindAsync(counselorId);

            return new ConsultationNoteDto
            {
                Id = note.Id,
                InteractionDate = note.InteractionDate,
                Channel = note.Channel,
                Content = note.Content,
                Outcome = note.Outcome,
                NextAppointmentDate = note.NextAppointmentDate,
                CounselorName = counselor?.FullName ?? "Chuyên viên tư vấn"
            };
        }
    }
}
