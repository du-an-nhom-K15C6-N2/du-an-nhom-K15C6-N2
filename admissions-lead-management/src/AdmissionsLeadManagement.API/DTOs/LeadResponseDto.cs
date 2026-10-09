using AdmissionsLeadManagement.API.Models;

namespace AdmissionsLeadManagement.API.DTOs
{
    public class LeadResponseDto
    {
        public int Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? MajorInterest { get; set; }
        public string? Address { get; set; }

        public LeadStatus Status { get; set; }
        public string StatusName => Status switch
        {
            LeadStatus.New => "Mới tiếp nhận",
            LeadStatus.Contacted => "Đã liên hệ",
            LeadStatus.Consulting => "Đang tư vấn",
            LeadStatus.ScheduledAppointment => "Đã đặt lịch hẹn",
            LeadStatus.CallAgainLater => "Hẹn gọi lại",
            LeadStatus.Enrolled => "Đã nhập học",
            LeadStatus.Lost => "Không có nhu cầu",
            _ => Status.ToString()
        };

        public LeadSource Source { get; set; }
        public string SourceName => Source switch
        {
            LeadSource.FacebookAds => "Facebook Ads",
            LeadSource.GoogleSearch => "Google Search",
            LeadSource.Hotline => "Hotline Tuyển sinh",
            LeadSource.WebsiteLandingPage => "Landing Page Web",
            EducationFair => "Ngày hội tuyển sinh",
            LeadSource.Referral => "Người quen giới thiệu",
            LeadSource.Direct => "Đến trực tiếp",
            _ => Source.ToString()
        };

        public int? AssignedCounselorId { get; set; }
        public string? AssignedCounselorName { get; set; }

        public DateTime CreatedDate { get; set; }
        public DateTime? LastInteractionDate { get; set; }

        /// <summary>
        /// Cuộc trao đổi gần nhất (giúp tư vấn viên nắm bắt tức thì khi khách gọi lại)
        /// </summary>
        public ConsultationNoteDto? LatestInteraction { get; set; }

        /// <summary>
        /// Toàn bộ lịch sử các cuộc trao đổi
        /// </summary>
        public List<ConsultationNoteDto> Interactions { get; set; } = new List<ConsultationNoteDto>();
    }

    public class ConsultationNoteDto
    {
        public int Id { get; set; }
        public DateTime InteractionDate { get; set; }
        public InteractionChannel Channel { get; set; }
        public string ChannelName => Channel switch
        {
            InteractionChannel.PhoneCall => "Cuộc gọi điện thoại",
            InteractionChannel.Zalo => "Tin nhắn Zalo",
            InteractionChannel.DirectMeeting => "Gặp trực tiếp tại trường",
            InteractionChannel.Email => "Email",
            InteractionChannel.FacebookMessenger => "Facebook Messenger",
            _ => Channel.ToString()
        };
        public string Content { get; set; } = string.Empty;
        public string Outcome { get; set; } = string.Empty;
        public DateTime? NextAppointmentDate { get; set; }
        public string CounselorName { get; set; } = string.Empty;
    }
}
