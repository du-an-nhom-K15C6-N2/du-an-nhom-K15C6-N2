// ==============================================================================================
// DỰ ÁN: HỆ THỐNG QUẢN LÝ & LỌC LEAD DÀNH CHO TƯ VẤN TUYỂN SINH
// TOÀN BỘ MÃ NGUỒN TRONG 1 FILE DUY NHẤT (C# ASP.NET CORE / VISUAL STUDIO)
// 
// Bao gồm đầy đủ 4 tiêu chí nghiệm thu:
// 1. Chuẩn hoá tham số truy vấn & Tối ưu lọc thời gian (Normalized Query & Time Range Indexing)
// 2. Xây dựng API tìm kiếm & lọc lead đa điều kiện (RESTful API / LINQ Performance)
// 3. Xây dựng giao diện tìm kiếm & bộ lọc lead đa điều kiện (Embedded Responsive UI + Nút "Tháng trước")
// 4. Kiểm thử chức năng tìm kiếm và lọc lead (Built-in Unit Test Suite & Test Runner)
// ==============================================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Cấu hình dịch vụ
builder.Services.AddControllers()
    .AddJsonOptions(opt => opt.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Admissions Lead API", Version = "v1", Description = "API Tư vấn Tuyển sinh - Lọc Lead đa điều kiện" });
});

// Cấu hình Database In-Memory (Chạy ngay lập tức trong Visual Studio không cần cấu hình SQL Server)
builder.Services.AddDbContext<AdmissionsDbContext>(opt => opt.UseInMemoryDatabase("AdmissionsLeadDb"));
builder.Services.AddScoped<ILeadService, LeadService>();

builder.Services.AddCors(opt => opt.AddPolicy("AllowAll", p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();

// Khởi tạo dữ liệu mẫu khi chạy ứng dụng
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AdmissionsDbContext>();
    DbSeeder.SeedData(db);
}

app.UseCors("AllowAll");
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapControllers();

// Phục vụ Giao diện Web trực quan ngay tại đường dẫn gốc "/"
app.MapGet("/", () => Results.Content(EmbeddedWebUI.HtmlContent, "text/html; charset=utf-8"));

// Chạy ứng dụng
app.Run();


#region 1. ENUMS VÀ ENTITY MODELS

namespace AdmissionsLeadApp.Models
{
    public enum LeadStatus
    {
        New = 0,                    // Mới tiếp nhận
        Contacted = 1,              // Đã liên hệ
        Consulting = 2,             // Đang tư vấn chuyên sâu
        ScheduledAppointment = 3,  // Đã hẹn lịch lên trường
        CallAgainLater = 4,        // Hẹn gọi lại sau
        Enrolled = 5,               // Đã nhập học
        Lost = 6                    // Không có nhu cầu
    }

    public enum LeadSource
    {
        FacebookAds = 0,
        GoogleSearch = 1,
        Hotline = 2,
        WebsiteLandingPage = 3,
        EducationFair = 4,          // Ngày hội tuyển sinh
        Referral = 5,               // Học viên cũ giới thiệu
        Direct = 6                  // Đến trực tiếp
    }

    public enum InteractionChannel
    {
        PhoneCall = 0,
        Zalo = 1,
        DirectMeeting = 2,
        Email = 3
    }

    public enum QuickTimeRangeOption
    {
        All = 0,
        Today = 1,
        ThisMonth = 2,
        LastMonth = 3,              // Tháng trước (đáp ứng đúng bài toán khi khách gọi lại)
        Last30Days = 4,
        Custom = 5
    }

    public enum DateFilterType
    {
        LastInteractionDate = 0,    // Ngày trao đổi gần nhất
        CreatedDate = 1             // Ngày tiếp nhận lead
    }

    public class Counselor
    {
        [Key]
        public int Id { get; set; }
        [Required, MaxLength(100)]
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string Department { get; set; } = "Phòng Tuyển sinh";
        public bool IsActive { get; set; } = true;
        public virtual ICollection<Lead> AssignedLeads { get; set; } = new List<Lead>();
    }

    public class ConsultationNote
    {
        [Key]
        public int Id { get; set; }
        public int LeadId { get; set; }
        [ForeignKey(nameof(LeadId))]
        public virtual Lead? Lead { get; set; }

        public int CounselorId { get; set; }
        [ForeignKey(nameof(CounselorId))]
        public virtual Counselor? Counselor { get; set; }

        public DateTime InteractionDate { get; set; }
        public InteractionChannel Channel { get; set; } = InteractionChannel.PhoneCall;
        [Required, MaxLength(2000)]
        public string Content { get; set; } = string.Empty;
        public string Outcome { get; set; } = string.Empty;
        public DateTime? NextAppointmentDate { get; set; }
    }

    public class Lead
    {
        [Key]
        public int Id { get; set; }
        [Required, MaxLength(120)]
        public string FullName { get; set; } = string.Empty;
        [Required, MaxLength(20)]
        public string PhoneNumber { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? MajorInterest { get; set; } // Ngành học quan tâm
        public string? Address { get; set; }
        public LeadStatus Status { get; set; } = LeadStatus.New;
        public LeadSource Source { get; set; } = LeadSource.Hotline;

        public int? AssignedCounselorId { get; set; }
        [ForeignKey(nameof(AssignedCounselorId))]
        public virtual Counselor? AssignedCounselor { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Ngày trao đổi gần nhất - được đánh Index để lọc thời gian siêu tốc
        /// </summary>
        public DateTime? LastInteractionDate { get; set; }

        public virtual ICollection<ConsultationNote> ConsultationNotes { get; set; } = new List<ConsultationNote>();
    }
}

#endregion


#region 2. DATABASE CONTEXT VÀ TỐI ƯU HOÁ INDEX

namespace AdmissionsLeadApp.Data
{
    using AdmissionsLeadApp.Models;

    public class AdmissionsDbContext : DbContext
    {
        public AdmissionsDbContext(DbContextOptions<AdmissionsDbContext> options) : base(options) { }

        public DbSet<Lead> Leads => Set<Lead>();
        public DbSet<ConsultationNote> ConsultationNotes => Set<ConsultationNote>();
        public DbSet<Counselor> Counselors => Set<Counselor>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // 1. Index tra cứu nhanh SĐT khi khách gọi lại
            modelBuilder.Entity<Lead>().HasIndex(l => l.PhoneNumber).HasDatabaseName("IX_Leads_PhoneNumber");

            // 2. Index lọc thời gian trao đổi gần nhất
            modelBuilder.Entity<Lead>().HasIndex(l => l.LastInteractionDate).HasDatabaseName("IX_Leads_LastInteractionDate");

            // 3. Composite Index tối ưu bộ lọc đa điều kiện: Tư vấn viên + Trạng thái + Thời gian
            modelBuilder.Entity<Lead>()
                .HasIndex(l => new { l.AssignedCounselorId, l.Status, l.LastInteractionDate })
                .HasDatabaseName("IX_Leads_Counselor_Status_InteractionDate");

            // 4. Index lịch sử trao đổi
            modelBuilder.Entity<ConsultationNote>()
                .HasIndex(cn => new { cn.LeadId, cn.InteractionDate })
                .HasDatabaseName("IX_ConsultationNotes_Lead_Date");
        }
    }

    public static class DbSeeder
    {
        public static void SeedData(AdmissionsDbContext db)
        {
            if (db.Leads.Any()) return;

            var c1 = new Counselor { Id = 1, FullName = "Nguyễn Thuỳ Linh", Department = "Tuyển sinh Khối CNTT" };
            var c2 = new Counselor { Id = 2, FullName = "Lê Hoàng Long", Department = "Tuyển sinh Khối Kinh tế" };
            var c3 = new Counselor { Id = 3, FullName = "Trần Minh Quân", Department = "Tuyển sinh Quốc tế" };
            db.Counselors.AddRange(c1, c2, c3);
            db.SaveChanges();

            var now = DateTime.Now;
            var lastMonth = now.AddMonths(-1);

            var leads = new List<Lead>
            {
                // Lead 1: Trao đổi từ THÁNG TRƯỚC (Hỏi học bổng IELTS) - Đúng User Story
                new Lead
                {
                    Id = 1,
                    FullName = "Nguyễn Văn Hùng (Bố em Nam)",
                    PhoneNumber = "0912345678",
                    Email = "hung.nguyen@gmail.com",
                    MajorInterest = "Kỹ thuật Phần mềm (CNTT)",
                    Status = LeadStatus.CallAgainLater,
                    Source = LeadSource.Hotline,
                    AssignedCounselorId = 1,
                    CreatedDate = lastMonth.AddDays(-10),
                    LastInteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 15, 14, 30, 0),
                    ConsultationNotes = new List<ConsultationNote>
                    {
                        new ConsultationNote
                        {
                            CounselorId = 1,
                            InteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 15, 14, 30, 0),
                            Channel = InteractionChannel.PhoneCall,
                            Content = "Trao đổi 15 phút: Phụ huynh hỏi kỹ về học phí kỳ 1 và chính sách học bổng 50% theo IELTS 6.5 của con. Bố hẹn tháng sau con thi xong tốt nghiệp sẽ gọi lại để nộp hồ sơ.",
                            Outcome = "Rất tiềm năng, hẹn tháng sau gọi lại."
                        }
                    }
                },
                // Lead 2: Trao đổi từ THÁNG TRƯỚC (Zalo - Ngành Đa phương tiện)
                new Lead
                {
                    Id = 2,
                    FullName = "Trần Thị Mai Anh",
                    PhoneNumber = "0988776655",
                    Email = "maianh.tran@gmail.com",
                    MajorInterest = "Truyền thông Đa phương tiện",
                    Status = LeadStatus.Consulting,
                    Source = LeadSource.FacebookAds,
                    AssignedCounselorId = 1,
                    CreatedDate = lastMonth.AddDays(-5),
                    LastInteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 22, 10, 15, 0),
                    ConsultationNotes = new List<ConsultationNote>
                    {
                        new ConsultationNote
                        {
                            CounselorId = 1,
                            InteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 22, 10, 15, 0),
                            Channel = InteractionChannel.Zalo,
                            Content = "Đã gửi đề cương chương trình Thiết kế đồ họa & Multimedia qua Zalo. Học sinh phân vân học phí.",
                            Outcome = "Đã gửi tài liệu, hẹn trao đổi cùng phụ huynh."
                        }
                    }
                },
                // Lead 3: Trao đổi THÁNG NÀY (Hôm qua)
                new Lead
                {
                    Id = 3,
                    FullName = "Lê Thị Bích Ngọc",
                    PhoneNumber = "0934567890",
                    Email = "bichngoc.le@gmail.com",
                    MajorInterest = "Logistics và Chuỗi cung ứng",
                    Status = LeadStatus.Contacted,
                    Source = LeadSource.EducationFair,
                    AssignedCounselorId = 2,
                    CreatedDate = now.AddDays(-8),
                    LastInteractionDate = now.AddDays(-1),
                    ConsultationNotes = new List<ConsultationNote>
                    {
                        new ConsultationNote
                        {
                            CounselorId = 2,
                            InteractionDate = now.AddDays(-1),
                            Channel = InteractionChannel.PhoneCall,
                            Content = "Gọi điện giới thiệu cơ hội việc làm ngành Logistics, gửi dự toán học phí toàn khoá.",
                            Outcome = "Phụ huynh đang cân nhắc."
                        }
                    }
                }
            };

            db.Leads.AddRange(leads);
            db.SaveChanges();
        }
    }
}

#endregion


#region 3. CHUẨN HOÁ THAM SỐ TRUY VẤN VÀ DTOS

namespace AdmissionsLeadApp.DTOs
{
    using AdmissionsLeadApp.Models;

    public class LeadFilterQuery : IValidatableObject
    {
        private string? _keyword;
        private int _pageNumber = 1;
        private int _pageSize = 10;

        public string? Keyword
        {
            get => _keyword;
            set => _keyword = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        public LeadStatus? Status { get; set; }
        public LeadSource? Source { get; set; }
        public int? CounselorId { get; set; }
        public DateFilterType DateFilterType { get; set; } = DateFilterType.LastInteractionDate;
        public QuickTimeRangeOption QuickTimeRange { get; set; } = QuickTimeRangeOption.All;
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }

        public int PageNumber
        {
            get => _pageNumber;
            set => _pageNumber = value < 1 ? 1 : value;
        }

        public int PageSize
        {
            get => _pageSize;
            set => _pageSize = value switch { < 1 => 10, > 100 => 100, _ => value };
        }

        public string SortBy { get; set; } = "LastInteractionDate";
        public bool SortDescending { get; set; } = true;

        /// <summary>
        /// Chuẩn hóa mốc thời gian để tối ưu truy vấn Index trong Database
        /// </summary>
        public (DateTime? Start, DateTime? End) GetNormalizedDateRange(DateTime? refDate = null)
        {
            var now = refDate ?? DateTime.Now;
            switch (QuickTimeRange)
            {
                case QuickTimeRangeOption.LastMonth:
                    // Tính chính xác: 00:00:00 ngày đầu tháng trước -> 23:59:59 ngày cuối tháng trước
                    var firstDayThisMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0);
                    var startLastMonth = firstDayThisMonth.AddMonths(-1);
                    var endLastMonth = firstDayThisMonth.AddTicks(-1);
                    return (startLastMonth, endLastMonth);

                case QuickTimeRangeOption.ThisMonth:
                    var startThisMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0);
                    var endThisMonth = startThisMonth.AddMonths(1).AddTicks(-1);
                    return (startThisMonth, endThisMonth);

                case QuickTimeRangeOption.Today:
                    return (now.Date, now.Date.AddDays(1).AddTicks(-1));

                case QuickTimeRangeOption.Custom:
                default:
                    return (FromDate?.Date, ToDate?.Date.AddDays(1).AddTicks(-1));
            }
        }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            if (FromDate.HasValue && ToDate.HasValue && FromDate.Value.Date > ToDate.Value.Date)
            {
                yield return new ValidationResult("Ngày bắt đầu không được lớn hơn ngày kết thúc.", new[] { nameof(FromDate), nameof(ToDate) });
            }
        }
    }

    public class PagedResult<T>
    {
        public IReadOnlyList<T> Items { get; set; } = new List<T>();
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public int TotalPages => (int)Math.Ceiling((double)TotalCount / (PageSize > 0 ? PageSize : 10));

        public PagedResult(IReadOnlyList<T> items, int totalCount, int pageNumber, int pageSize)
        {
            Items = items;
            TotalCount = totalCount;
            PageNumber = pageNumber;
            PageSize = pageSize;
        }
    }

    public class LeadResponseDto
    {
        public int Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? MajorInterest { get; set; }
        public LeadStatus Status { get; set; }
        public string StatusName { get; set; } = string.Empty;
        public LeadSource Source { get; set; }
        public string SourceName { get; set; } = string.Empty;
        public int? AssignedCounselorId { get; set; }
        public string? AssignedCounselorName { get; set; }
        public DateTime CreatedDate { get; set; }
        public DateTime? LastInteractionDate { get; set; }
        public ConsultationNoteDto? LatestInteraction { get; set; }
        public List<ConsultationNoteDto> Interactions { get; set; } = new();
    }

    public class ConsultationNoteDto
    {
        public int Id { get; set; }
        public DateTime InteractionDate { get; set; }
        public string ChannelName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Outcome { get; set; } = string.Empty;
        public string CounselorName { get; set; } = string.Empty;
    }
}

#endregion


#region 4. SERVICE XỬ LÝ NGHIỆP VỤ VÀ LINQ OPTIMIZATION

namespace AdmissionsLeadApp.Services
{
    using AdmissionsLeadApp.Data;
    using AdmissionsLeadApp.DTOs;
    using AdmissionsLeadApp.Models;

    public interface ILeadService
    {
        Task<PagedResult<LeadResponseDto>> SearchAndFilterLeadsAsync(LeadFilterQuery query, CancellationToken ct = default);
        Task<LeadResponseDto?> GetLeadByIdAsync(int id, CancellationToken ct = default);
        Task<ConsultationNoteDto> AddInteractionAsync(int leadId, int counselorId, string content, string outcome);
    }

    public class LeadService : ILeadService
    {
        private readonly AdmissionsDbContext _db;

        public LeadService(AdmissionsDbContext db) => _db = db;

        public async Task<PagedResult<LeadResponseDto>> SearchAndFilterLeadsAsync(LeadFilterQuery query, CancellationToken ct = default)
        {
            var (start, end) = query.GetNormalizedDateRange();

            // Truy vấn tối ưu với AsNoTracking và Include
            var queryable = _db.Leads
                .AsNoTracking()
                .Include(l => l.AssignedCounselor)
                .Include(l => l.ConsultationNotes)
                    .ThenInclude(cn => cn.Counselor)
                .AsQueryable();

            // 1. Lọc Trạng thái
            if (query.Status.HasValue) queryable = queryable.Where(l => l.Status == query.Status.Value);

            // 2. Lọc Nguồn
            if (query.Source.HasValue) queryable = queryable.Where(l => l.Source == query.Source.Value);

            // 3. Lọc Người phụ trách
            if (query.CounselorId.HasValue) queryable = queryable.Where(l => l.AssignedCounselorId == query.CounselorId.Value);

            // 4. Tối ưu lọc thời gian
            if (query.DateFilterType == DateFilterType.LastInteractionDate)
            {
                if (start.HasValue) queryable = queryable.Where(l => l.LastInteractionDate >= start.Value);
                if (end.HasValue) queryable = queryable.Where(l => l.LastInteractionDate <= end.Value);
            }
            else
            {
                if (start.HasValue) queryable = queryable.Where(l => l.CreatedDate >= start.Value);
                if (end.HasValue) queryable = queryable.Where(l => l.CreatedDate <= end.Value);
            }

            // 5. Tìm kiếm từ khóa: Tên, SĐT, Email hoặc NỘI DUNG CUỘC TRAO ĐỔI CŨ
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var kw = query.Keyword.Trim();
                queryable = queryable.Where(l =>
                    EF.Functions.Like(l.FullName, $"%{kw}%") ||
                    l.PhoneNumber.Contains(kw) ||
                    (l.MajorInterest != null && EF.Functions.Like(l.MajorInterest, $"%{kw}%")) ||
                    l.ConsultationNotes.Any(cn => EF.Functions.Like(cn.Content, $"%{kw}%") || EF.Functions.Like(cn.Outcome, $"%{kw}%"))
                );
            }

            var totalCount = await queryable.CountAsync(ct);

            var items = await queryable
                .OrderByDescending(l => l.LastInteractionDate ?? l.CreatedDate)
                .Skip((query.PageNumber - 1) * query.PageSize)
                .Take(query.PageSize)
                .ToListAsync(ct);

            var dtos = items.Select(l =>
            {
                var notes = l.ConsultationNotes.OrderByDescending(n => n.InteractionDate).Select(n => new ConsultationNoteDto
                {
                    Id = n.Id,
                    InteractionDate = n.InteractionDate,
                    ChannelName = n.Channel.ToString(),
                    Content = n.Content,
                    Outcome = n.Outcome,
                    CounselorName = n.Counselor?.FullName ?? "Tư vấn viên"
                }).ToList();

                return new LeadResponseDto
                {
                    Id = l.Id,
                    FullName = l.FullName,
                    PhoneNumber = l.PhoneNumber,
                    Email = l.Email,
                    MajorInterest = l.MajorInterest,
                    Status = l.Status,
                    StatusName = l.Status switch {
                        LeadStatus.CallAgainLater => "Hẹn gọi lại sau",
                        LeadStatus.Consulting => "Đang tư vấn",
                        LeadStatus.Contacted => "Đã liên hệ",
                        _ => l.Status.ToString()
                    },
                    Source = l.Source,
                    SourceName = l.Source switch {
                        LeadSource.Hotline => "Hotline",
                        LeadSource.FacebookAds => "Facebook Ads",
                        _ => l.Source.ToString()
                    },
                    AssignedCounselorId = l.AssignedCounselorId,
                    AssignedCounselorName = l.AssignedCounselor?.FullName,
                    CreatedDate = l.CreatedDate,
                    LastInteractionDate = l.LastInteractionDate,
                    LatestInteraction = notes.FirstOrDefault(),
                    Interactions = notes
                };
            }).ToList();

            return new PagedResult<LeadResponseDto>(dtos, totalCount, query.PageNumber, query.PageSize);
        }

        public async Task<LeadResponseDto?> GetLeadByIdAsync(int id, CancellationToken ct = default)
        {
            var res = await SearchAndFilterLeadsAsync(new LeadFilterQuery { PageSize = 1 }, ct);
            return res.Items.FirstOrDefault(i => i.Id == id);
        }

        public async Task<ConsultationNoteDto> AddInteractionAsync(int leadId, int counselorId, string content, string outcome)
        {
            var lead = await _db.Leads.FindAsync(leadId);
            if (lead == null) throw new KeyNotFoundException("Không tìm thấy Lead");

            var now = DateTime.UtcNow;
            var note = new ConsultationNote
            {
                LeadId = leadId,
                CounselorId = counselorId,
                InteractionDate = now,
                Content = content,
                Outcome = outcome
            };
            lead.LastInteractionDate = now;
            _db.ConsultationNotes.Add(note);
            await _db.SaveChangesAsync();

            return new ConsultationNoteDto
            {
                Id = note.Id,
                InteractionDate = now,
                ChannelName = "Cuộc gọi thoại",
                Content = content,
                Outcome = outcome,
                CounselorName = "Tư vấn viên"
            };
        }
    }
}

#endregion


#region 5. RESTFUL API CONTROLLERS

namespace AdmissionsLeadApp.Controllers
{
    using AdmissionsLeadApp.DTOs;
    using AdmissionsLeadApp.Services;

    [ApiController]
    [Route("api/[controller]")]
    public class LeadsController : ControllerBase
    {
        private readonly ILeadService _service;
        private readonly AdmissionsLeadApp.Data.AdmissionsDbContext _db;

        public LeadsController(ILeadService service, AdmissionsLeadApp.Data.AdmissionsDbContext db)
        {
            _service = service;
            _db = db;
        }

        /// <summary>
        /// API tìm kiếm và lọc lead theo trạng thái, nguồn, người phụ trách và khoảng thời gian
        /// </summary>
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] LeadFilterQuery query, CancellationToken ct)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var result = await _service.SearchAndFilterLeadsAsync(query, ct);
            return Ok(result);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id, CancellationToken ct)
        {
            var item = await _service.GetLeadByIdAsync(id, ct);
            return item == null ? NotFound() : Ok(item);
        }

        [HttpPost("{id:int}/interactions")]
        public async Task<IActionResult> AddNote(int id, [FromBody] AddNoteRequest req)
        {
            var res = await _service.AddInteractionAsync(id, req.CounselorId, req.Content, req.Outcome);
            return Ok(res);
        }

        /// <summary>
        /// Chạy bộ kiểm thử tự động ngay trên API
        /// </summary>
        [HttpGet("run-tests")]
        public async Task<IActionResult> RunUnitTests()
        {
            var runner = new AdmissionsLeadApp.Tests.EmbeddedTestRunner(_db, _service);
            var report = await runner.RunAllTestsAsync();
            return Ok(report);
        }
    }

    public class AddNoteRequest
    {
        public int CounselorId { get; set; } = 1;
        public string Content { get; set; } = string.Empty;
        public string Outcome { get; set; } = string.Empty;
    }
}

#endregion


#region 6. GIAO DIỆN WEB NHÚNG SẴN (EMBEDDED RESPONSIVE UI)

namespace AdmissionsLeadApp
{
    public static class EmbeddedWebUI
    {
        public const string HtmlContent = @"<!DOCTYPE html>
<html lang=""vi"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Cổng Tư Vấn Tuyển Sinh - Tra Cứu & Lọc Lead</title>
    <script src=""https://cdn.tailwindcss.com""></script>
    <link href=""https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"" rel=""stylesheet"">
    <style>
        .tag-active { background-color: #4f46e5 !important; color: white !important; }
    </style>
</head>
<body class=""bg-slate-50 text-slate-800 min-h-screen"">

    <header class=""bg-indigo-900 text-white shadow-md sticky top-0 z-30"">
        <div class=""max-w-7xl mx-auto px-4 py-3.5 flex justify-between items-center"">
            <div class=""flex items-center space-x-3"">
                <i class=""fa-solid fa-graduation-cap text-2xl text-amber-400""></i>
                <div>
                    <h1 class=""text-lg font-bold"">CRM TƯ VẤN TUYỂN SINH - BỘ LỌC LEAD ĐA ĐIỀU KIỆN</h1>
                    <p class=""text-xs text-indigo-200"">Tìm kiếm và truy xuất nhanh cuộc trao đổi tháng trước khi khách gọi lại</p>
                </div>
            </div>
            <a href=""/api/leads/run-tests"" target=""_blank"" class=""px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 rounded-lg text-xs font-medium border border-indigo-500"">
                <i class=""fa-solid fa-vial-circle-check""></i> Chạy Unit Tests
            </a>
        </div>
    </header>

    <main class=""max-w-7xl mx-auto px-4 py-6 space-y-6"">
        
        <!-- Hộp cảnh báo nghiệp vụ -->
        <div class=""bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm flex items-center justify-between"">
            <div class=""flex items-center space-x-3"">
                <i class=""fa-solid fa-phone-volume text-amber-600 text-2xl""></i>
                <div>
                    <h2 class=""text-sm font-semibold text-amber-800"">Tình huống: Khách hàng gọi lại sau 1 tháng</h2>
                    <p class=""text-xs text-amber-700"">Bấm ngay nút <b>[⚡ Cuộc gọi tháng trước]</b> bên dưới để tra cứu ngay nội dung ghi chú trao đổi lần trước (học phí, học bổng IELTS, ngành học...).</p>
                </div>
            </div>
        </div>

        <!-- Bộ Lọc Đa Điều Kiện -->
        <section class=""bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4"">
            <!-- Ô tìm kiếm từ khóa -->
            <div class=""flex gap-3"">
                <div class=""relative flex-1"">
                    <i class=""fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400""></i>
                    <input type=""text"" id=""keyword"" placeholder=""Nhập Số điện thoại (ví dụ: 0912345678), Họ tên, hoặc nội dung trao đổi cũ (IELTS, học phí)..."" 
                           class=""w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500"">
                </div>
                <button onclick=""applyFilter()"" class=""px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm"">
                    <i class=""fa-solid fa-filter""></i> Lọc dữ liệu
                </button>
            </div>

            <!-- Nút chọn nhanh thời gian -->
            <div class=""border-t border-b border-slate-100 py-3 flex flex-wrap items-center gap-2"">
                <span class=""text-xs font-semibold text-slate-500 uppercase mr-1""><i class=""fa-regular fa-clock""></i> Khoảng thời gian:</span>
                <button onclick=""setQuickRange('LastMonth', this)"" class=""quick-btn px-3 py-1.5 rounded-md text-xs font-medium border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 tag-active"">
                    ⚡ Cuộc gọi tháng trước (Tháng trước)
                </button>
                <button onclick=""setQuickRange('ThisMonth', this)"" class=""quick-btn px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50"">
                    Tháng này
                </button>
                <button onclick=""setQuickRange('Today', this)"" class=""quick-btn px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50"">
                    Hôm nay
                </button>
                <button onclick=""setQuickRange('All', this)"" class=""quick-btn px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50"">
                    Tất cả thời gian
                </button>
            </div>

            <!-- Các tiêu chí lọc Dropdown -->
            <div class=""grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"">
                <div>
                    <label class=""block font-medium text-slate-600 mb-1"">Trạng thái Lead</label>
                    <select id=""statusFilter"" class=""w-full p-2 border border-slate-300 rounded-lg outline-none"">
                        <option value="""">-- Tất cả trạng thái --</option>
                        <option value=""4"">Hẹn gọi lại sau</option>
                        <option value=""2"">Đang tư vấn</option>
                        <option value=""1"">Đã liên hệ</option>
                    </select>
                </div>
                <div>
                    <label class=""block font-medium text-slate-600 mb-1"">Nguồn tiếp cận</label>
                    <select id=""sourceFilter"" class=""w-full p-2 border border-slate-300 rounded-lg outline-none"">
                        <option value="""">-- Tất cả nguồn --</option>
                        <option value=""2"">Hotline Tuyển sinh</option>
                        <option value=""0"">Facebook Ads</option>
                        <option value=""4"">Ngày hội tuyển sinh</option>
                    </select>
                </div>
                <div>
                    <label class=""block font-medium text-slate-600 mb-1"">Tư vấn viên phụ trách</label>
                    <select id=""counselorFilter"" class=""w-full p-2 border border-slate-300 rounded-lg outline-none"">
                        <option value="""">-- Tất cả tư vấn viên --</option>
                        <option value=""1"">Nguyễn Thuỳ Linh</option>
                        <option value=""2"">Lê Hoàng Long</option>
                    </select>
                </div>
                <div>
                    <label class=""block font-medium text-slate-600 mb-1"">Tiêu chí ngày</label>
                    <select id=""dateFilterType"" class=""w-full p-2 border border-slate-300 rounded-lg outline-none"">
                        <option value=""0"">Ngày trao đổi gần nhất</option>
                        <option value=""1"">Ngày tiếp nhận Lead</option>
                    </select>
                </div>
            </div>
        </section>

        <!-- Thống kê kết quả -->
        <div id=""summaryText"" class=""text-xs text-slate-600 px-1 font-medium"">Đang tải dữ liệu...</div>

        <!-- Bảng danh sách Lead -->
        <section class=""bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"">
            <table class=""w-full text-left border-collapse text-sm"">
                <thead class=""bg-slate-100 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200"">
                    <tr>
                        <th class=""py-3 px-4"">Khách hàng / SĐT</th>
                        <th class=""py-3 px-4"">Ngành quan tâm</th>
                        <th class=""py-3 px-4"">Trạng thái</th>
                        <th class=""py-3 px-4"">Nguồn & Phụ trách</th>
                        <th class=""py-3 px-4 w-5/12"">Cuộc trao đổi gần nhất (Ghi chú quá khứ)</th>
                    </tr>
                </thead>
                <tbody id=""tableBody"" class=""divide-y divide-slate-100""></tbody>
            </table>
        </section>
    </main>

    <script>
        let currentRange = 'LastMonth';

        function setQuickRange(range, btn) {
            currentRange = range;
            document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('tag-active'));
            btn.classList.add('tag-active');
            applyFilter();
        }

        async function applyFilter() {
            const kw = document.getElementById('keyword').value.trim();
            const status = document.getElementById('statusFilter').value;
            const source = document.getElementById('sourceFilter').value;
            const counselor = document.getElementById('counselorFilter').value;
            const dateType = document.getElementById('dateFilterType').value;

            const params = new URLSearchParams({
                QuickTimeRange: currentRange,
                DateFilterType: dateType
            });
            if (kw) params.append('Keyword', kw);
            if (status) params.append('Status', status);
            if (source) params.append('Source', source);
            if (counselor) params.append('CounselorId', counselor);

            try {
                const res = await fetch('/api/leads/search?' + params.toString());
                const data = await res.json();
                renderTable(data.items, data.totalCount);
            } catch (e) {
                console.error(e);
            }
        }

        function renderTable(leads, total) {
            const tbody = document.getElementById('tableBody');
            document.getElementById('summaryText').innerHTML = `Tìm thấy <b class=""text-indigo-600"">${total}</b> lead phù hợp ${currentRange === 'LastMonth' ? 'có trao đổi trong <span class=""bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold"">Tháng trước</span>' : ''}`;

            if (!leads || leads.length === 0) {
                tbody.innerHTML = '<tr><td colspan=""5"" class=""text-center py-8 text-slate-400"">Không có lead nào phù hợp bộ lọc.</td></tr>';
                return;
            }

            tbody.innerHTML = leads.map(l => `
                <tr class=""hover:bg-slate-50 transition"">
                    <td class=""py-3 px-4"">
                        <div class=""font-semibold text-slate-900"">${l.fullName}</div>
                        <div class=""text-xs text-indigo-600 font-medium""><i class=""fa-solid fa-phone""></i> ${l.phoneNumber}</div>
                    </td>
                    <td class=""py-3 px-4 text-xs font-medium text-slate-700"">${l.majorInterest || 'Chưa rõ'}</td>
                    <td class=""py-3 px-4"">
                        <span class=""px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"">${l.statusName}</span>
                    </td>
                    <td class=""py-3 px-4 text-xs"">
                        <div class=""font-medium"">${l.sourceName}</div>
                        <div class=""text-slate-500 text-[11px]"">${l.assignedCounselorName || 'Chưa phân công'}</div>
                    </td>
                    <td class=""py-3 px-4"">
                        ${l.latestInteraction ? `
                            <div class=""bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs"">
                                <div class=""text-[11px] text-slate-500 mb-1 font-medium text-indigo-700"">
                                    <i class=""fa-solid fa-phone""></i> ${new Date(l.latestInteraction.interactionDate).toLocaleDateString('vi-VN')}
                                </div>
                                <p class=""text-slate-700 italic"">""${l.latestInteraction.content}""</p>
                                <div class=""mt-1 text-emerald-700 font-medium text-[11px]"">➜ ${l.latestInteraction.outcome}</div>
                            </div>
                        ` : '<span class=""text-xs text-slate-400"">Chưa có ghi chú</span>'}
                    </td>
                </tr>
            `).join('');
        }

        // Tự động tải lần đầu với bộ lọc tháng trước
        document.addEventListener('DOMContentLoaded', applyFilter);
    </script>
</body>
</html>";
    }
}

#endregion


#region 7. BỘ KIỂM THỬ TỰ ĐỘNG (UNIT TEST RUNNER)

namespace AdmissionsLeadApp.Tests
{
    using AdmissionsLeadApp.Data;
    using AdmissionsLeadApp.DTOs;
    using AdmissionsLeadApp.Models;
    using AdmissionsLeadApp.Services;

    public class EmbeddedTestRunner
    {
        private readonly AdmissionsDbContext _db;
        private readonly ILeadService _service;

        public EmbeddedTestRunner(AdmissionsDbContext db, ILeadService service)
        {
            _db = db;
            _service = service;
        }

        public async Task<object> RunAllTestsAsync()
        {
            var results = new List<object>();

            // Test 1: Lọc đúng các lead có cuộc gọi từ tháng trước
            try
            {
                var q1 = new LeadFilterQuery { QuickTimeRange = QuickTimeRangeOption.LastMonth };
                var r1 = await _service.SearchAndFilterLeadsAsync(q1);
                bool pass1 = r1.TotalCount == 2 && r1.Items.All(i => i.Id == 1 || i.Id == 2);
                results.Add(new { TestName = "Filter_ByLastMonth_ReturnsPreviousMonthInteractions", Passed = pass1, Expected = 2, Actual = r1.TotalCount });
            }
            catch (Exception ex) { results.Add(new { TestName = "Filter_ByLastMonth", Passed = false, Error = ex.Message }); }

            // Test 2: Tìm kiếm tức thì theo SĐT khi khách gọi lại
            try
            {
                var q2 = new LeadFilterQuery { Keyword = "0912345678" };
                var r2 = await _service.SearchAndFilterLeadsAsync(q2);
                bool pass2 = r2.TotalCount == 1 && r2.Items[0].FullName.Contains("Nguyễn Văn Hùng");
                results.Add(new { TestName = "Search_ByPhoneNumber_WhenCustomerCallsBack", Passed = pass2, FoundName = r2.Items.FirstOrDefault()?.FullName });
            }
            catch (Exception ex) { results.Add(new { TestName = "Search_ByPhoneNumber", Passed = false, Error = ex.Message }); }

            // Test 3: Tìm kiếm theo nội dung cuộc trao đổi cũ (ví dụ: IELTS 6.5)
            try
            {
                var q3 = new LeadFilterQuery { Keyword = "IELTS 6.5" };
                var r3 = await _service.SearchAndFilterLeadsAsync(q3);
                bool pass3 = r3.TotalCount == 1 && r3.Items[0].Id == 1;
                results.Add(new { TestName = "Search_ByPastDiscussionNotes_KeywordMatch", Passed = pass3, MatchedLeadId = r3.Items.FirstOrDefault()?.Id });
            }
            catch (Exception ex) { results.Add(new { TestName = "Search_ByPastNotes", Passed = false, Error = ex.Message }); }

            // Test 4: Lọc đa điều kiện: Trạng thái + Nguồn + Tư vấn viên
            try
            {
                var q4 = new LeadFilterQuery { Status = LeadStatus.CallAgainLater, Source = LeadSource.Hotline, CounselorId = 1 };
                var r4 = await _service.SearchAndFilterLeadsAsync(q4);
                bool pass4 = r4.TotalCount == 1 && r4.Items[0].Id == 1;
                results.Add(new { TestName = "Filter_MultiCondition_Status_Source_Counselor", Passed = pass4, MatchedCount = r4.TotalCount });
            }
            catch (Exception ex) { results.Add(new { TestName = "Filter_MultiCondition", Passed = false, Error = ex.Message }); }

            // Test 5: Boundary Validation khi FromDate > ToDate
            try
            {
                var q5 = new LeadFilterQuery { FromDate = DateTime.Now, ToDate = DateTime.Now.AddDays(-5) };
                var valContext = new ValidationContext(q5);
                var valErrors = new List<ValidationResult>();
                bool isValid = Validator.TryValidateObject(q5, valContext, valErrors, true);
                bool pass5 = !isValid && valErrors.Any(e => e.ErrorMessage!.Contains("không được lớn hơn"));
                results.Add(new { TestName = "Validation_DateRange_FromDateGreaterThanToDate", Passed = pass5, ErrorMessage = valErrors.FirstOrDefault()?.ErrorMessage });
            }
            catch (Exception ex) { results.Add(new { TestName = "Validation_DateRange", Passed = false, Error = ex.Message }); }

            return new
            {
                TotalTests = results.Count,
                Success = results.All(r => (bool)((dynamic)r).Passed),
                Details = results
            };
        }
    }
}

#endregion
