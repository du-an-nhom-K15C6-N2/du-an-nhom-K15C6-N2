using System.ComponentModel.DataAnnotations;
using AdmissionsLeadManagement.API.Models;

namespace AdmissionsLeadManagement.API.DTOs
{
    /// <summary>
    /// Tham số truy vấn đã được chuẩn hóa để tìm kiếm và lọc Lead đa điều kiện
    /// </summary>
    public class LeadFilterQuery : IValidatableObject
    {
        private string? _keyword;
        private int _pageNumber = 1;
        private int _pageSize = 10;

        /// <summary>
        /// Từ khóa tìm kiếm: Tìm theo Họ tên, SĐT, Email hoặc Nội dung cuộc trao đổi
        /// </summary>
        public string? Keyword
        {
            get => _keyword;
            set => _keyword = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        /// <summary>
        /// Lọc theo trạng thái lead
        /// </summary>
        public LeadStatus? Status { get; set; }

        /// <summary>
        /// Lọc theo nguồn tiếp cận
        /// </summary>
        public LeadSource? Source { get; set; }

        /// <summary>
        /// Lọc theo chuyên viên tư vấn phụ trách
        /// </summary>
        public int? CounselorId { get; set; }

        /// <summary>
        /// Tiêu chí ngày lọc: LastInteractionDate (ngày trao đổi) hoặc CreatedDate (ngày tạo)
        /// </summary>
        public DateFilterType DateFilterType { get; set; } = DateFilterType.LastInteractionDate;

        /// <summary>
        /// Tùy chọn lọc nhanh thời gian (Tháng trước, Tháng này, 7 ngày qua,...)
        /// </summary>
        public QuickTimeRangeOption QuickTimeRange { get; set; } = QuickTimeRangeOption.All;

        /// <summary>
        /// Từ ngày (bắt đầu khoảng thời gian)
        /// </summary>
        public DateTime? FromDate { get; set; }

        /// <summary>
        /// Đến ngày (kết thúc khoảng thời gian)
        /// </summary>
        public DateTime? ToDate { get; set; }

        /// <summary>
        /// Trang hiện tại (Mặc định 1)
        /// </summary>
        public int PageNumber
        {
            get => _pageNumber;
            set => _pageNumber = value < 1 ? 1 : value;
        }

        /// <summary>
        /// Kích thước trang (Mặc định 10, tối đa 100)
        /// </summary>
        public int PageSize
        {
            get => _pageSize;
            set => _pageSize = value switch
            {
                < 1 => 10,
                > 100 => 100,
                _ => value
            };
        }

        /// <summary>
        /// Sắp xếp theo trường (Mặc định: LastInteractionDate)
        /// </summary>
        public string SortBy { get; set; } = "LastInteractionDate";

        /// <summary>
        /// Sắp xếp giảm dần (Mặc định: true - cuộc trao đổi gần nhất lên đầu)
        /// </summary>
        public bool SortDescending { get; set; } = true;

        /// <summary>
        /// Chuẩn hóa khoảng thời gian tìm kiếm dựa trên QuickTimeRange hoặc FromDate/ToDate
        /// </summary>
        /// <param name="referenceDate">Thời điểm tham chiếu (mặc định DateTime.Now)</param>
        public (DateTime? Start, DateTime? End) GetNormalizedDateRange(DateTime? referenceDate = null)
        {
            var now = referenceDate ?? DateTime.Now;

            switch (QuickTimeRange)
            {
                case QuickTimeRangeOption.Today:
                    var todayStart = now.Date;
                    var todayEnd = todayStart.AddDays(1).AddTicks(-1);
                    return (todayStart, todayEnd);

                case QuickTimeRangeOption.ThisWeek:
                    int diff = (7 + (now.DayOfWeek - DayOfWeek.Monday)) % 7;
                    var weekStart = now.Date.AddDays(-1 * diff);
                    var weekEnd = weekStart.AddDays(7).AddTicks(-1);
                    return (weekStart, weekEnd);

                case QuickTimeRangeOption.ThisMonth:
                    var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0);
                    var monthEnd = monthStart.AddMonths(1).AddTicks(-1);
                    return (monthStart, monthEnd);

                case QuickTimeRangeOption.LastMonth:
                    // Đáp ứng trực tiếp yêu cầu: "tìm lại được cuộc trao đổi từ tháng trước khi khách gọi lại"
                    var firstDayOfThisMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0);
                    var lastMonthStart = firstDayOfThisMonth.AddMonths(-1);
                    var lastMonthEnd = firstDayOfThisMonth.AddTicks(-1);
                    return (lastMonthStart, lastMonthEnd);

                case QuickTimeRangeOption.Last30Days:
                    var last30DaysStart = now.Date.AddDays(-30);
                    var last30DaysEnd = now.Date.AddDays(1).AddTicks(-1);
                    return (last30DaysStart, last30DaysEnd);

                case QuickTimeRangeOption.Custom:
                default:
                    DateTime? normalizedStart = FromDate.HasValue ? FromDate.Value.Date : null;
                    DateTime? normalizedEnd = ToDate.HasValue ? ToDate.Value.Date.AddDays(1).AddTicks(-1) : null;
                    return (normalizedStart, normalizedEnd);
            }
        }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            if (FromDate.HasValue && ToDate.HasValue && FromDate.Value.Date > ToDate.Value.Date)
            {
                yield return new ValidationResult(
                    "Ngày bắt đầu (FromDate) không được lớn hơn ngày kết thúc (ToDate).",
                    new[] { nameof(FromDate), nameof(ToDate) }
                );
            }
        }
    }
}
