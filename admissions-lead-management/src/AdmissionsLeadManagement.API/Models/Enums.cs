namespace AdmissionsLeadManagement.API.Models
{
    public enum LeadStatus
    {
        New = 0,                    // Mới tiếp nhận
        Contacted = 1,              // Đã liên hệ
        Consulting = 2,             // Đang tư vấn chuyên sâu
        ScheduledAppointment = 3,  // Đã hẹn lịch lên trường/phỏng vấn
        CallAgainLater = 4,        // Hẹn gọi lại sau
        Enrolled = 5,               // Đã đăng ký/nhập học
        Lost = 6                    // Không có nhu cầu/Hủy
    }

    public enum LeadSource
    {
        FacebookAds = 0,
        GoogleSearch = 1,
        Hotline = 2,
        WebsiteLandingPage = 3,
        EducationFair = 4,          // Ngày hội tuyển sinh/hướng nghiệp
        Referral = 5,               // Học viên cũ/người quen giới thiệu
        Direct = 6                  // Trực tiếp tại văn phòng
    }

    public enum InteractionChannel
    {
        PhoneCall = 0,
        Zalo = 1,
        DirectMeeting = 2,
        Email = 3,
        FacebookMessenger = 4
    }

    public enum QuickTimeRangeOption
    {
        All = 0,
        Today = 1,
        ThisWeek = 2,
        ThisMonth = 3,
        LastMonth = 4,              // Tháng trước (đáp ứng đúng User Story)
        Last30Days = 5,
        Custom = 6                  // Tùy chọn khoảng ngày
    }

    public enum DateFilterType
    {
        LastInteractionDate = 0,    // Lọc theo ngày trao đổi gần nhất
        CreatedDate = 1             // Lọc theo ngày tiếp nhận lead
    }
}
