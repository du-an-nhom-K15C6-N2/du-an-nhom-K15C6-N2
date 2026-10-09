using Microsoft.AspNetCore.Mvc;
using AdmissionsLeadManagement.API.DTOs;
using AdmissionsLeadManagement.API.Models;
using AdmissionsLeadManagement.API.Services;

namespace AdmissionsLeadManagement.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LeadsController : ControllerBase
    {
        private readonly ILeadService _leadService;
        private readonly ILogger<LeadsController> _logger;

        public LeadsController(ILeadService leadService, ILogger<LeadsController> logger)
        {
            _leadService = leadService;
            _logger = logger;
        }

        /// <summary>
        /// API tìm kiếm và lọc lead đa điều kiện: trạng thái, nguồn, người phụ trách và khoảng thời gian
        /// </summary>
        /// <param name="query">Các tham số lọc đã được chuẩn hóa</param>
        /// <returns>Danh sách lead phân trang kèm thông tin cuộc trao đổi gần nhất</returns>
        [HttpGet("search")]
        [ProducesResponseType(typeof(PagedResult<LeadResponseDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> SearchAndFilterLeads([FromQuery] LeadFilterQuery query, CancellationToken cancellationToken)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var result = await _leadService.SearchAndFilterLeadsAsync(query, cancellationToken);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi xảy ra khi tìm kiếm và lọc lead");
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Đã xảy ra lỗi trong quá trình xử lý tìm kiếm lead." });
            }
        }

        /// <summary>
        /// Xem chi tiết lead và toàn bộ lịch sử các cuộc trao đổi
        /// </summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(LeadResponseDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetLeadDetails(int id, CancellationToken cancellationToken)
        {
            var lead = await _leadService.GetLeadDetailsAsync(id, cancellationToken);
            if (lead == null)
            {
                return NotFound(new { message = $"Không tìm thấy lead với ID = {id}" });
            }

            return Ok(lead);
        }

        /// <summary>
        /// Lấy dữ liệu các bộ lọc (Danh sách Tư vấn viên, Trạng thái, Nguồn) phục vụ giao diện
        /// </summary>
        [HttpGet("filter-options")]
        public async Task<IActionResult> GetFilterOptions(CancellationToken cancellationToken)
        {
            var counselors = await _leadService.GetCounselorsAsync(cancellationToken);

            var statuses = Enum.GetValues<LeadStatus>()
                .Select(s => new { Id = (int)s, Name = s.ToString(), Label = GetStatusLabel(s) });

            var sources = Enum.GetValues<LeadSource>()
                .Select(s => new { Id = (int)s, Name = s.ToString(), Label = GetSourceLabel(s) });

            return Ok(new
            {
                Counselors = counselors.Select(c => new { c.Id, c.FullName, c.Department }),
                Statuses = statuses,
                Sources = sources
            });
        }

        /// <summary>
        /// Thêm ghi chú cuộc trao đổi mới khi khách gọi lại
        /// </summary>
        [HttpPost("{id:int}/interactions")]
        [ProducesResponseType(typeof(ConsultationNoteDto), StatusCodes.Status201Created)]
        public async Task<IActionResult> AddInteraction(int id, [FromBody] AddInteractionRequest request)
        {
            try
            {
                var note = await _leadService.AddConsultationNoteAsync(
                    id,
                    request.CounselorId,
                    request.Content,
                    request.Channel,
                    request.Outcome,
                    request.NextAppointmentDate
                );

                return CreatedAtAction(nameof(GetLeadDetails), new { id }, note);
            }
            catch (KeyNotFoundException knf)
            {
                return NotFound(new { message = knf.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi thêm ghi chú trao đổi");
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Không thể lưu ghi chú trao đổi." });
            }
        }

        private static string GetStatusLabel(LeadStatus status) => status switch
        {
            LeadStatus.New => "Mới tiếp nhận",
            LeadStatus.Contacted => "Đã liên hệ",
            LeadStatus.Consulting => "Đang tư vấn",
            LeadStatus.ScheduledAppointment => "Đã đặt lịch hẹn",
            LeadStatus.CallAgainLater => "Hẹn gọi lại",
            LeadStatus.Enrolled => "Đã nhập học",
            LeadStatus.Lost => "Không có nhu cầu",
            _ => status.ToString()
        };

        private static string GetSourceLabel(LeadSource source) => source switch
        {
            LeadSource.FacebookAds => "Facebook Ads",
            LeadSource.GoogleSearch => "Google Search",
            LeadSource.Hotline => "Hotline Tuyển sinh",
            LeadSource.WebsiteLandingPage => "Website Landing Page",
            LeadSource.EducationFair => "Ngày hội tuyển sinh",
            LeadSource.Referral => "Người quen giới thiệu",
            LeadSource.Direct => "Đến trực tiếp",
            _ => source.ToString()
        };
    }

    public class AddInteractionRequest
    {
        public int CounselorId { get; set; }
        public string Content { get; set; } = string.Empty;
        public InteractionChannel Channel { get; set; } = InteractionChannel.PhoneCall;
        public string Outcome { get; set; } = string.Empty;
        public DateTime? NextAppointmentDate { get; set; }
    }
}
