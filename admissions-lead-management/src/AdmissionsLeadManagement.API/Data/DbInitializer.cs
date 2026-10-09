using AdmissionsLeadManagement.API.Models;

namespace AdmissionsLeadManagement.API.Data
{
    public static class DbInitializer
    {
        public static void Initialize(AdmissionsDbContext context)
        {
            if (context.Leads.Any())
            {
                return; // Đã có dữ liệu
            }

            var now = DateTime.Now;
            var lastMonth = now.AddMonths(-1);

            // 1. Tạo danh sách Tư vấn viên tuyển sinh
            var counselor1 = new Counselor { Id = 1, FullName = "Nguyễn Thuỳ Linh", Email = "linh.nt@admission.edu.vn", PhoneNumber = "0987654321", Department = "Tư vấn Tuyển sinh Khối CNTT" };
            var counselor2 = new Counselor { Id = 2, FullName = "Lê Hoàng Long", Email = "long.lh@admission.edu.vn", PhoneNumber = "0976543210", Department = "Tư vấn Tuyển sinh Khối Kinh tế" };
            var counselor3 = new Counselor { Id = 3, FullName = "Trần Minh Quân", Email = "quan.tm@admission.edu.vn", PhoneNumber = "0965432109", Department = "Tư vấn Tuyển sinh Quốc tế" };

            context.Counselors.AddRange(counselor1, counselor2, counselor3);
            context.SaveChanges();

            // 2. Tạo danh sách Lead mẫu kèm cuộc trao đổi từ THÁNG TRƯỚC và các thời điểm khác
            var leads = new List<Lead>
            {
                new Lead
                {
                    FullName = "Nguyễn Văn Hùng (Phụ huynh em Nguyễn Hoàng Nam)",
                    PhoneNumber = "0912345678",
                    Email = "hung.nguyen@gmail.com",
                    MajorInterest = "Kỹ thuật Phần mềm (CNTT)",
                    Address = "Cầu Giấy, Hà Nội",
                    Status = LeadStatus.CallAgainLater,
                    Source = LeadSource.Hotline,
                    AssignedCounselorId = 1,
                    CreatedDate = lastMonth.AddDays(-10),
                    LastInteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 15, 14, 30, 0),
                    InitialNote = "Phụ huynh gọi hotline hỏi về điểm chuẩn xét tuyển học bạ ngành Kỹ thuật phần mềm.",
                    ConsultationNotes = new List<ConsultationNote>
                    {
                        new ConsultationNote
                        {
                            CounselorId = 1,
                            InteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 15, 14, 30, 0),
                            Channel = InteractionChannel.PhoneCall,
                            Content = "Trao đổi 15 phút: Phụ huynh hỏi kỹ về học phí kỳ 1 và chương trình học bổng 50% kỳ đầu. Đã giải thích chính sách học bổng theo điểm thi IELTS 6.5 của con. Bố dặn tháng sau con thi tốt nghiệp xong sẽ gọi lại để nộp hồ sơ xét tuyển sớm.",
                            Outcome = "Phụ huynh rất quan tâm, hẹn tháng sau gọi lại khi con thi xong.",
                            NextAppointmentDate = now.AddDays(2)
                        }
                    }
                },
                new Lead
                {
                    FullName = "Trần Thị Mai Anh",
                    PhoneNumber = "0988776655",
                    Email = "maianh.tran@gmail.com",
                    MajorInterest = "Truyền thông Đa phương tiện",
                    Address = "Thanh Xuân, Hà Nội",
                    Status = LeadStatus.Consulting,
                    Source = LeadSource.FacebookAds,
                    AssignedCounselorId = 1,
                    CreatedDate = lastMonth.AddDays(-5),
                    LastInteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 22, 10, 15, 0),
                    InitialNote = "Điền form Facebook Ads hỏi chỉ tiêu tuyển sinh chuyên ngành Thiết kế đồ họa và Multimedia.",
                    ConsultationNotes = new List<ConsultationNote>
                    {
                        new ConsultationNote
                        {
                            CounselorId = 1,
                            InteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 22, 10, 15, 0),
                            Channel = InteractionChannel.Zalo,
                            Content = "Gửi đề cương đào tạo ngành Truyền thông và portfolio mẫu của sinh viên khoá trước qua Zalo. Học sinh băn khoăn giữa học tại trường và học FPT Arena.",
                            Outcome = "Đã gửi tài liệu tham khảo, hẹn tư vấn trực tiếp cùng phụ huynh.",
                            NextAppointmentDate = now.AddDays(5)
                        }
                    }
                },
                new Lead
                {
                    FullName = "Phạm Quốc Tuấn",
                    PhoneNumber = "0901234987",
                    Email = "tuan.pq@yahoo.com",
                    MajorInterest = "Quản trị Kinh doanh Quốc tế",
                    Address = "Hải Phòng",
                    Status = LeadStatus.ScheduledAppointment,
                    Source = LeadSource.WebsiteLandingPage,
                    AssignedCounselorId = 2,
                    CreatedDate = lastMonth.AddDays(-2),
                    LastInteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 28, 16, 0, 0),
                    InitialNote = "Đăng ký tham gia Ngày hội Open Day.",
                    ConsultationNotes = new List<ConsultationNote>
                    {
                        new ConsultationNote
                        {
                            CounselorId = 2,
                            InteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 28, 16, 0, 0),
                            Channel = InteractionChannel.PhoneCall,
                            Content = "Xác nhận lịch hẹn phụ huynh và học sinh đến tham quan cơ sở đào tạo và ký hợp đồng giữ chỗ chỉ tiêu đợt 1.",
                            Outcome = "Đã chốt lịch hẹn tham quan cuối tuần.",
                            NextAppointmentDate = now.AddDays(3)
                        }
                    }
                },
                new Lead
                {
                    FullName = "Lê Thị Bích Ngọc",
                    PhoneNumber = "0934567890",
                    Email = "bichngoc.le@gmail.com",
                    MajorInterest = "Logistics và Quản lý Chuỗi cung ứng",
                    Address = "Bắc Ninh",
                    Status = LeadStatus.Contacted,
                    Source = LeadSource.EducationFair,
                    AssignedCounselorId = 2,
                    CreatedDate = now.AddDays(-10),
                    LastInteractionDate = now.AddDays(-5),
                    InitialNote = "Tiếp cận tại Ngày hội Hướng nghiệp THPT Chuyên Bắc Ninh.",
                    ConsultationNotes = new List<ConsultationNote>
                    {
                        new ConsultationNote
                        {
                            CounselorId = 2,
                            InteractionDate = now.AddDays(-5),
                            Channel = InteractionChannel.PhoneCall,
                            Content = "Gọi điện giới thiệu cơ hội việc làm ngành Logistics, phụ huynh muốn biết mức học phí toàn khoá.",
                            Outcome = "Đã gửi bảng dự toán học phí qua Email.",
                            NextAppointmentDate = null
                        }
                    }
                },
                new Lead
                {
                    FullName = "Hoàng Đức Minh",
                    PhoneNumber = "0945678123",
                    Email = "minh.hd@gmail.com",
                    MajorInterest = "Trí tuệ Nhân tạo & Khoa học Dữ liệu",
                    Address = "Hà Đông, Hà Nội",
                    Status = LeadStatus.Enrolled,
                    Source = LeadSource.Referral,
                    AssignedCounselorId = 3,
                    CreatedDate = lastMonth.AddDays(-15),
                    LastInteractionDate = now.AddDays(-2),
                    InitialNote = "Anh trai là sinh viên K18 giới thiệu em trai đăng ký học.",
                    ConsultationNotes = new List<ConsultationNote>
                    {
                        new ConsultationNote
                        {
                            CounselorId = 3,
                            InteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 18, 9, 0, 0),
                            Channel = InteractionChannel.PhoneCall,
                            Content = "Tư vấn chương trình đào tạo chuyên sâu AI/Data Science và hỗ trợ hồ sơ học bổng người thân cựu sinh viên.",
                            Outcome = "Hài lòng với chính sách ưu đãi.",
                            NextAppointmentDate = null
                        },
                        new ConsultationNote
                        {
                            CounselorId = 3,
                            InteractionDate = now.AddDays(-2),
                            Channel = InteractionChannel.DirectMeeting,
                            Content = "Đến trường nộp hồ sơ gốc và hoàn tất thủ tục nhập học sớm.",
                            Outcome = "Đã nhập học thành công (Enrolled).",
                            NextAppointmentDate = null
                        }
                    }
                },
                new Lead
                {
                    FullName = "Vũ Đình Trọng",
                    PhoneNumber = "0923456789",
                    Email = "trong.vu@outlook.com",
                    MajorInterest = "An toàn Thông tin (Cybersecurity)",
                    Address = "Nam Định",
                    Status = LeadStatus.CallAgainLater,
                    Source = LeadSource.GoogleSearch,
                    AssignedCounselorId = 3,
                    CreatedDate = lastMonth.AddDays(-12),
                    LastInteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 12, 11, 20, 0),
                    InitialNote = "Tìm kiếm Google về đào tạo Cybersecurity chuẩn quốc tế.",
                    ConsultationNotes = new List<ConsultationNote>
                    {
                        new ConsultationNote
                        {
                            CounselorId = 3,
                            InteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 12, 11, 20, 0),
                            Channel = InteractionChannel.PhoneCall,
                            Content = "Học sinh muốn học chứng chỉ CompTIA Security+ và CEH song song bằng cử nhân. Trao đổi về lộ trình thực tập tại doanh nghiệp đối tác từ năm thứ 3. Em hẹn sau kỳ thi tốt nghiệp sẽ trao đổi lại cùng mẹ.",
                            Outcome = "Hẹn gọi lại sau khi thi tốt nghiệp.",
                            NextAppointmentDate = now.AddDays(7)
                        }
                    }
                }
            };

            context.Leads.AddRange(leads);
            context.SaveChanges();
        }
    }
}
